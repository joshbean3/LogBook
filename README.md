# Logbook

A personal training log, habit tracker and journal, built as an installable web app with its own server and database.

Four tabs, one language, one assistant (the contract is `docs/system.md`):

- **Today**: the same five sections every day. The Ask bar; today's workout as one card (its name, the plan line, and one
  status line whose words follow the clock and Strava: "Out the door in 22 min ›", "Back by 8:13", "5.02 mi at 8:14.
  Logged.", with the route and DISTANCE · PACE · TIME once a run has landed; a circle check marks it done by hand, hold the
  card for Done · Floor · Skip · Move); today's goal (the same row the Goals tab shows); the schedule (to-dos and the goal's
  steps under Anytime, Morning, Afternoon, Evening; hold a row to drag it between bands or onto Tomorrow / Delete; quick
  add reads `Send the model fri !!! #work`); habits as a row of orbs; the week's ring and line; and from 6 pm a "Close the
  day" row that opens the evening sheet (the day's facts, two sentences, share). Swipe the page to another day; the date
  strip under the bar is the picker.
- **Ask** (the bar at the top of each tab): the assistant, on Claude Sonnet. Ask about your plan ("what's left this week?")
  or ask for a change ("push the runs I missed this week to next week", "add a P1 to-do to call the bank Friday", "set this
  week's goal from my plan", "pick a plan", "remind me to pack my kit at 9"). It reads your plan, the week's runs, habits,
  goals, mornings and reminders, and proposes the change as a list in words; nothing changes until you tap Apply, and Undo
  puts it all back. One small, obviously reversible change ("check stretch") is done at once with Undo in a toast. The
  conversation lives on the server, so it is the same on every device; the reply streams in as it is written. Every
  proposal and what came of it is kept. "Remember that Tuesdays are gym" is kept and read on every turn.
- **Goals**: day, week, month and year as four rows of one component (the goal in serif, its steps as circle checks, the
  time left, a check for the goal itself). Ahead: tomorrow and next week. When a period ends, one card asks "Did you hit
  it?" (Done, Partly, Missed, a line on how it went, and "mark the rest missed"). Set a goal in two taps; "Suggest steps"
  (Claude) is a button after saving, never a gate. History is one list with a level filter and the hit rate on top. A dot
  on the tab says when today's or this week's goal is unset.
- **Workout Plan**: the Ask bar with three starters (Pick a plan · Change my week · How is my week looking?); the progress
  strip (this week's miles against the plan, runs, weeks kept, a 13-week sparkline) that expands in place into the mileage
  chart with scrub and 3M / 6M / 1Y, the last run's route and stats, records (best mile, 5K, 10K, longest run, biggest
  week) and the block's adherence; then the week (hold a session to move it; tap it for its sheet with Done and Floor) and
  the month; then the block, which opens the plan library (Base, 5K, 10K, Half, Marathon at 3 to 5 days, "Build my own",
  "From a file or description") and lets you edit a block's days and target for the weeks ahead, with Undo.
- **This morning** (pushed from the workout card's "Out the door" line): the schedule from the alarm to the door. Drag the
  alarm and every time below moves with it.
- **Journal**: a logbook. Every day with a run, a goal or an entry is a page: the facts filled in for you ("Easy 5 · 5.02
  mi at 8:14 · 3 of 4 habits · goal done · 4 to-dos"), an energy pick, and your words, with "a year ago" when there is
  one. Months as headers with a jump strip, a year of dots on top, search over what you wrote. A quote a day sits in the
  composer as a prompt.
- **Settings** (pushed from Today's avatar): you (name, training answers, "about you" for the assistant), habits, the
  morning routine, Connections (Strava, COROS), Notifications (this device, the two reminders Logbook sends, your own,
  quiet hours), the app, your data, account.

Install it on a phone from the browser. It opens full screen, caches everything it has seen, queues writes made offline,
and, once you allow it, delivers reminders as push notifications.

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

7 steps, ~15 min. Need: `flyctl` installed and signed in.

1. **Open** a terminal in this folder.
2. **Create** the app: `fly launch --no-deploy --copy-config --name <your-app-name>` (accept the defaults).
3. **Create** the volume: `fly volumes create logbook_data --size 1 --region ewr`
4. **Set** secrets (the session secret must be long and random; setup is open only while you say so):
   ```
   fly secrets set SESSION_SECRET=$(openssl rand -hex 32) APP_URL=https://<your-app-name>.fly.dev ALLOW_SETUP=1
   ```
5. **Deploy**: `fly deploy`
6. **Open** `https://<your-app-name>.fly.dev` and create your account.
7. **Close** setup so nobody else can: `fly secrets set ALLOW_SETUP=0`

`fly.toml` keeps one machine running (`min_machines_running = 1`): the reminder scheduler and the provider syncs are loops
inside the API process, so a machine that stops between requests would send nothing.

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

Activities from the last 120 days sync on connect; after that every 20 minutes, on boot and on Refresh, the server asks for everything since the last sync (less two days, for late uploads). For runs, laps and heart rate come along, which is what grades the effort. Strava's 100-calls-per-15-minutes budget is shared by every account on the server; a 429 pauses everyone until the window turns. An account whose access was revoked waits for a Reconnect in Settings instead of being retried.

Optional, for instant updates: subscribe to Strava's webhook once (one curl command, run from anywhere):

```
curl -X POST https://www.strava.com/api/v3/push_subscriptions \
  -F client_id=$STRAVA_CLIENT_ID -F client_secret=$STRAVA_CLIENT_SECRET \
  -F callback_url=https://<your-app>/api/strava/webhook \
  -F verify_token=$STRAVA_WEBHOOK_VERIFY_TOKEN
```

## Connect COROS

COROS's "Connect your data" OAuth app works the same way behind one interface (`apps/api/src/services/providers`): create the
app at https://open.coros.com, set its redirect to `https://<your-app>/api/connections/coros/callback`, then set `COROS_CLIENT_ID`
and `COROS_CLIENT_SECRET`. Settings › Connections then shows a COROS row. The endpoint roots default to the documented ones
(`COROS_AUTH_URL`, `COROS_TOKEN_URL`, `COROS_API_URL`); `providers/coros.ts` lists what to confirm against COROS's developer
docs before the first real connection. A run both Strava and COROS recorded (same start within two minutes, distance within
2%) is counted once.

## Reminders and push

Reminders ("Today's goal is unset" fifteen minutes after the alarm, "Tomorrow: Easy 5, out the door 6:50" at 9 pm, and your
own or the assistant's) are sent as Web Push from the server. Generate a VAPID key pair once and set it:

```
npx web-push generate-vapid-keys
fly secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:you@example.com
```

Then Settings › Notifications › "Notifications on this device" subscribes the browser (on an iPhone, install to the home
screen first). Without the keys the scheduler logs what it would have sent. APNs (the native app) stores its tokens but is not
sent yet; the app keeps its local notifications meanwhile.

## Connect Claude

Set `ANTHROPIC_API_KEY`. The server uses `claude-opus-5-5` by default (`ANTHROPIC_MODEL` to change). This turns on the plan builder, the coach's read, the goal review and the assistant (which runs on `claude-sonnet-5-5`). What Claude knows about you is written in Settings › You › "About you, for the assistant" (it replaced the `ATHLETE_CONTEXT` variable).

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
| `COROS_CLIENT_ID`, `COROS_CLIENT_SECRET`, `COROS_AUTH_URL`, `COROS_TOKEN_URL`, `COROS_API_URL` | COROS (the URLs have defaults) |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Web Push for reminders (`npx web-push generate-vapid-keys`) |
| `VITE_API_ORIGIN` | Build-time, the iPhone app only: the server it talks to (no default) |

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

The app signs in against `VITE_API_ORIGIN`, which has no default: build it with `VITE_API_ORIGIN=https://your-server pnpm ios` (or `VITE_API_ORIGIN=https://your-server pnpm --filter @logbook/web build:ios`). A build without it has no server to talk to and says so in the console.
