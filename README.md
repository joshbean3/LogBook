# Orby

A personal iPhone app for one person's day: a training plan, habits, goals, a journal and an assistant. It ships as a web
app with its own server and database, and inside a Capacitor shell for iOS. The product was renamed from Logbook; the
repo, the packages (`@logbook/*`), the bundle id and the storage keys keep the old name.

Four tabs, one data model:

- **Today**: one page per day. Swipe to the next or the previous day; the week strip under the bar travels with you. The
  hero changes with the time of day and shows the day's training. **Plan your day** sits under it: the day's goal, then
  the to-dos in Anytime, Morning, Afternoon and Evening. Hold a to-do to drag it, or let go for its menu. Habits are a
  grid of tiles: tap one to light it, hold for its sheet. In the evening the day closes with one line on what you learned.
- **Goals**: a goal for the year, the month, the week and the day, drawn as four rings. Each has its steps and its time
  left. When a period ends it asks how it went, and History keeps every one.
- **Fitness** (the route is still `/plan`): the week and the month of the plan, paged by swiping. Hold a session to move
  it. The plan builder writes the next block from your goal and run days. Under the plan, progress: weekly mileage
  against plan, long-run and pace trends, lifts, habits. A person who does not train can switch the tab off in Settings,
  and the app becomes three tabs.
- **Journal**: one line a day (what you learned) and longer entries when you want them, on one page, with the month
  behind it.

And three things that are not tabs:

- **The assistant** (the pill at the top of Today): ask about your plan, or ask for a change. It proposes the change as
  a list in words; nothing changes until you tap Apply, and Undo puts it back.
- **Orbs** (the numeral beside Today's sun, and the page behind it): a small light earned at the control you just
  completed. One thing done makes a day count, five days make a week count, and nothing is ever taken away. Orby offers
  a challenge for a day or a week, sized from your last four weeks; you can ask the assistant to pick one. Both switches
  are in Settings. The rules live in `packages/shared/src/rewards.ts` and the research behind them in
  `reports/Streaks rewards and challenges.md`.
- **Settings** (pushed from Today's avatar): you, training, habits, the morning routine, Apple Health, Orbs, the app, your
  data, your account.

The brand, the layout rules and the copy rules are in `docs/brand/`. `CLAUDE.md` says how to work in the repo.

Install it on a phone from the browser. It opens full screen, caches everything it has seen, and queues writes made offline.

## Stack

```
packages/shared   dates, types, the status and assessment rules, morning timeline, zod contracts
apps/api          Hono on Node 22, Drizzle + SQLite, scrypt auth with cookie sessions,
                  Strava OAuth + sync + webhook, Claude (plan builder, coach's read)
apps/web          React 19 + Vite, TanStack Query persisted to IndexedDB, motion, PWA
```

One Docker image serves both the API and the built web app.

## Run it locally

5 steps, ~5 min. Need: Node 22, pnpm.

1. **Copy** the env file: `cp .env.example .env`
2. **Install**: `pnpm install`
3. **Start** both apps: `pnpm dev` (API on 8787, web on 5173 with a proxy)
4. **Open** http://localhost:5173 and create your account (the first visit shows Start, then sign-up).
5. **Add** a habit and a session. Tick them.

Skip Strava and Claude for now; the app works without them.

## Deploy it

The simplest path is Fly.io: one machine, one volume, no database server.

8 steps, ~20 min. Need: `flyctl` installed and signed in, an Anthropic API key, and an account with a mail provider (for password reset mail).

1. **Open** a terminal in this folder.
2. **Create** the app: `fly launch --no-deploy --copy-config --name <your-app-name>` (accept the defaults).
3. **Create** the volume: `fly volumes create logbook_data --size 1 --region ewr`
4. **Set** `APP_URL` in `fly.toml` to the address people will use.
5. **Set** secrets (the session secret must be long and random):
   ```
   fly secrets set SESSION_SECRET=$(openssl rand -hex 32) \
     ANTHROPIC_API_KEY=<key> ANTHROPIC_MODEL=<model id> \
     MAIL_API_KEY=<key> MAIL_FROM="Logbook <no-reply@your-domain>"
   ```
6. **Deploy**: `fly deploy`
7. **Check**: `pnpm --filter @logbook/api check:deploy -- https://<your-host>`. It fails with a plain reason when sign-up is closed, mail is not configured or the AI features are off.
8. **Set up** the nightly off-site backup and do one test restore: `apps/api/RUNBOOK.md`.

`fly.toml` sets `ALLOW_SIGNUP = "1"`: anyone can create an account. For a private server, set it to `"0"` and `ALLOW_SETUP = "1"` (only the first account can be created), and expect the check in step 7 to say sign-up is closed.

Any host that runs a Docker image with a persistent volume works the same way (Railway, Render, a VPS with `docker compose up -d`).

## Install it on your phone

iPhone, 3 steps, ~1 min:

1. **Open** your app's URL in Safari and sign in.
2. **Tap** Share (the square with the arrow), then "Add to Home Screen".
3. **Tap** Add.

Android: open the URL in Chrome, tap the ⋮ menu, then "Install app" or "Add to Home screen". Settings inside the app also shows an Install button when the browser offers one.

## Connect Strava

4 steps, ~5 min.

1. **Create** an API application at https://www.strava.com/settings/api. Set "Authorization Callback Domain" to your app's host (for example `your-app.fly.dev`, or `localhost` for local).
2. **Set** `STRAVA_CLIENT_ID` and `STRAVA_CLIENT_SECRET` in your environment (`fly secrets set ...` or `.env`).
3. **Restart** the server.
4. **Open** Settings in the app and tap Connect Strava.

Strava is not part of the 1.0 App Store release: leave the keys unset there. This section is for a personal server.

Activities from the last 120 days sync on connect, when the app is opened (at most every 15 minutes), when Strava's webhook reports a new one, and whenever you tap Refresh. There is no background polling. For runs, laps and heart rate come along, which is what grades the effort. Nothing from Strava is ever sent to Claude.

Disconnecting in Settings ends Logbook's access at Strava and deletes every activity, lap, zone and token it brought in. Deleting the account does the same. So does revoking Logbook from Strava's own settings, once the webhook below is set up.

For instant updates, and so a revoke in Strava's settings deletes the data here, subscribe to Strava's webhook once:

1. **Set** `STRAVA_WEBHOOK_VERIFY_TOKEN` to a long random string (`openssl rand -hex 24`). There is no default, and production refuses to start with the Strava keys set and no real token.
2. **Subscribe** (one curl command, run from anywhere):
   ```
   curl -X POST https://www.strava.com/api/v3/push_subscriptions \
     -F client_id=$STRAVA_CLIENT_ID -F client_secret=$STRAVA_CLIENT_SECRET \
     -F callback_url=https://<your-app>/api/strava/webhook \
     -F verify_token=$STRAVA_WEBHOOK_VERIFY_TOKEN
   ```
3. **Set** `STRAVA_WEBHOOK_SUBSCRIPTION_ID` to the `id` in the answer. Events that do not carry it are refused.

## Connect Claude

Set `ANTHROPIC_API_KEY` and `ANTHROPIC_MODEL` (the id of the model to use, from the Anthropic Console). Both are needed: with either one missing the AI features stay off and the app says the assistant is not available. This turns on the assistant, the plan builder, the goal review, Remember when and the daily pick. Set `ANTHROPIC_ASSISTANT_MODEL` if the assistant chat should run on a different model from the rest.

Nothing goes to Claude for an account until that person has said yes in the app (Settings, Privacy). Nothing in the environment describes a person: each prompt is built from the signed-in account's own data.

## Environment variables

| Variable | What it does |
|---|---|
| `PORT` | Port the server listens on (8787) |
| `APP_URL` | Public URL. Printed in emailed links; decides secure cookies; Strava's redirect |
| `SESSION_SECRET` | Signs OAuth state. Required in production |
| `DATABASE_PATH` | SQLite file. Mount a volume here (`/data/logbook.db` in Docker) |
| `ALLOW_SIGNUP` | `1` lets anyone create an account (a public server). Off unless set |
| `ALLOW_SETUP` | `1` lets the first visitor create the one account (a private server) |
| `SIGNUP_PER_HOUR` | New accounts allowed per address per hour. 5 in production, no limit in development |
| `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` | Claude: the key and the model id. Both are required for the AI features |
| `ANTHROPIC_ASSISTANT_MODEL` | Optional: a different model id for the assistant chat |
| `MAIL_API_KEY`, `MAIL_FROM` | The mail provider's key and the From line, for password reset and email verification. Without them development logs the link and production sends nothing |
| `MAIL_API_URL` | The provider's send endpoint (a JSON post of `from`, `to`, `subject`, `text`, `html` with a Bearer key). Defaults to Resend's |
| `BACKUP_S3_ENDPOINT`, `BACKUP_S3_BUCKET`, `BACKUP_S3_ACCESS_KEY_ID`, `BACKUP_S3_SECRET_ACCESS_KEY` | The nightly off-site backup. Off unless all four are set. See `apps/api/RUNBOOK.md` |
| `BACKUP_S3_REGION`, `BACKUP_S3_PREFIX`, `BACKUP_KEEP_DAYS` | Optional: region (`auto`), folder (`logbook`), days a copy is kept (5) |
| `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET` | Strava. Leave unset for the 1.0 release |
| `STRAVA_WEBHOOK_VERIFY_TOKEN`, `STRAVA_WEBHOOK_SUBSCRIPTION_ID` | Needed with the Strava keys: a long random token (no default; production refuses to start without one) and the id Strava gave the webhook subscription (events without it are refused) |

Operations (backup, restore, rotating secrets, signing everyone out): `apps/api/RUNBOOK.md`.

## Development

```
pnpm typecheck     every package
pnpm test          shared domain rules (vitest)
pnpm build         web, then api (dist/ carries migrations and the quote library)
pnpm db:generate   regenerate the SQLite migration after a schema change
```

How a session gets its status, in one place: `packages/shared/src/status.ts`. A run with Strava miles is done; under 80% of planned miles is the floor; a skip mark wins over everything. The same function runs on the server and in the browser, so the two never disagree.

## The iPhone app

`apps/web/ios` is a native Xcode project (Capacitor) that bundles the web build and talks to your server. It needs a Mac with Xcode.

First time:

1. Open Terminal.
2. Run `cd ~/LogBook && git pull && pnpm install` (~2 min).
3. Run `pnpm ios` (builds the app, bundles it into the Xcode project, and opens Xcode).
4. In Xcode, click the "App" project at the top of the left sidebar, then the "App" target, then "Signing & Capabilities".
5. Tick "Automatically manage signing" and pick your Apple ID under Team (add it via Xcode, Settings, Accounts if it is not there).
6. Plug in your iPhone, pick it in the device menu at the top, press the Play button.
7. On the phone, go to Settings, General, VPN & Device Management, and trust your developer certificate.

Every update after that: `git pull && pnpm install && fly deploy && pnpm ios`, then press Play in Xcode. Deploy before you run the app: it talks to the server, so new features need the new server.

### Load a plan from a file

`pnpm plan:load` puts `plans/2026-10-banking-plan.json` (Oct 19 to Nov 8) on your calendar. It asks for your Logbook email and password, replaces what was only planned on those dates, and stops on the plan's last day: anything planned after it is cleared, and an older block ends the day before. Runs you already marked are never touched. Another file: `pnpm plan:load plans/<file>.json`. Another server: `LOGBOOK_URL=https://… pnpm plan:load`.

When a plan runs out, Today says so (from three days before its end) with a Next block button.

Note: with a free Apple ID the app must be reinstalled from Xcode every 7 days. A paid Apple Developer account ($99/yr) lifts that to a year and unlocks TestFlight, where it installs like any App Store app.

The app signs in against `VITE_API_ORIGIN` (default `https://josh-logbook.fly.dev`). Change it with `VITE_API_ORIGIN=https://your-server pnpm --filter @logbook/web build`.
