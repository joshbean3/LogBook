# Logbook

A personal training log, habit tracker and journal, built as an installable web app with its own server and database.

Seven views, one data model:

- **Today**: the day's planned sessions, graded against Strava automatically. Floor-or-full completion. Habits with streaks. To-dos that roll forward. Journal entries.
- **Morning**: the morning timeline from alarm to front door, built from the day's plan. Warns when a long run would make you late.
- **Plan**: week and month calendars, plus a plan builder. Claude turns a PDF, a photo, pasted text or a plain description into dated sessions you can check before saving.
- **Trends**: weekly mileage against plan, effort by heart-rate zone, lift progress with estimated one-rep max, a 30-day consistency grid.
- **Journal**: write, look back at a resurfaced entry, and a quote each day from a 3,458-quote library.
- **Settings**: Strava, theme, install.

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
4. **Open** http://localhost:5173 and create your account (the first visit shows setup).
5. **Add** a habit and a session. Tick them.

Skip Strava and Claude for now; the app works without them.

## Deploy it

The simplest path is Fly.io: one machine, one volume, no database server.

7 steps, ~15 min. Need: `flyctl` installed and signed in.

1. **Open** a terminal in this folder.
2. **Create** the app: `fly launch --no-deploy --copy-config --name <your-app-name>` (accept the defaults).
3. **Create** the volume: `fly volumes create logbook_data --size 1 --region ewr`
4. **Set** secrets (the session secret must be long and random):
   ```
   fly secrets set SESSION_SECRET=$(openssl rand -hex 32) APP_URL=https://<your-app-name>.fly.dev
   ```
5. **Deploy**: `fly deploy`
6. **Open** `https://<your-app-name>.fly.dev` and create your account.
7. **Close** setup so nobody else can: `fly secrets set ALLOW_SETUP=0`

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

Activities from the last 120 days sync on connect, on boot, every 20 minutes, and whenever you tap Refresh. For runs, laps and heart rate come along, which is what grades the effort.

Optional, for instant updates: subscribe to Strava's webhook once (one curl command, run from anywhere):

```
curl -X POST https://www.strava.com/api/v3/push_subscriptions \
  -F client_id=$STRAVA_CLIENT_ID -F client_secret=$STRAVA_CLIENT_SECRET \
  -F callback_url=https://<your-app>/api/strava/webhook \
  -F verify_token=$STRAVA_WEBHOOK_VERIFY_TOKEN
```

## Connect Claude

Set `ANTHROPIC_API_KEY`. The server uses `claude-opus-5-5` by default (`ANTHROPIC_MODEL` to change). This turns on the plan builder and the coach's read. `ATHLETE_CONTEXT` is a sentence or two about you that Claude reads before writing anything.

## Environment variables

| Variable | What it does |
|---|---|
| `PORT` | Port the server listens on (8787) |
| `APP_URL` | Public URL, used for Strava's redirect and secure cookies |
| `SESSION_SECRET` | Signs cookies and OAuth state. Required in production |
| `DATABASE_PATH` | SQLite file. Mount a volume here (`/data/logbook.db` in Docker) |
| `ALLOW_SETUP` | `1` lets the first visitor create the account; set `0` after |
| `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` | Claude |
| `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET`, `STRAVA_WEBHOOK_VERIFY_TOKEN` | Strava |
| `ATHLETE_CONTEXT` | Who you are, for Claude |

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

Note: with a free Apple ID the app must be reinstalled from Xcode every 7 days. A paid Apple Developer account ($99/yr) lifts that to a year and unlocks TestFlight, where it installs like any App Store app.

The app signs in against `VITE_API_ORIGIN` (default `https://josh-logbook.fly.dev`). Change it with `VITE_API_ORIGIN=https://your-server pnpm --filter @logbook/web build`.
