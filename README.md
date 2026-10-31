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

The simplest path is Fly.io: one machine, one volume, no database server. SQLite runs in WAL mode on the volume;
Litestream (optional, step 6) streams every change to a bucket, and the server writes a nightly copy of its own.

8 steps, ~20 min. Need: `flyctl` installed and signed in.

1. **Open** a terminal in this folder.
2. **Create** the app: `fly launch --no-deploy --copy-config --name <your-app-name>` (accept the defaults).
3. **Create** the volume: `fly volumes create logbook_data --size 1 --region ewr`
4. **Set** secrets (the session secret must be long and random; setup is open only while you say so):
   ```
   fly secrets set SESSION_SECRET=$(openssl rand -hex 32) APP_URL=https://<your-app-name>.fly.dev ALLOW_SETUP=1 METRICS_TOKEN=$(openssl rand -hex 16)
   ```
5. **Deploy**: `fly deploy`. The boot applies the migrations (under a lock in the database, so a second process never
   races it), and Fly's check polls `GET /api/ready` (a `SELECT 1`; 503 while the process is shutting down).
6. **Turn on** continuous backups to Tigris, Fly's S3: the numbered list under [Backups](#backups). Five minutes, and
   a machine that loses its volume comes back with its data.
7. **Open** `https://<your-app-name>.fly.dev` and create your account.
8. **Close** setup so nobody else can: `fly secrets set ALLOW_SETUP=0`

`fly.toml` keeps one machine running (`min_machines_running = 1`): the reminder scheduler and the provider syncs are
jobs inside the API process (`RUN_JOBS=inline`, the default; see [The worker process](#the-worker-process)), so a
machine that stops between requests would send nothing. `kill_timeout` gives a deploy 15 s: on SIGTERM the server
stops listening, finishes what is in flight (10 s at most), closes the database and exits.

Any host that runs a Docker image with a persistent volume works the same way (Railway, Render, a VPS with
`docker compose up -d`). The image's entrypoint is `apps/api/bin/start.sh`: plain `node dist/index.js`, or the same
under `litestream replicate` when `LITESTREAM_REPLICA_URL` is set.

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

COROS has no self-service API, but it runs an official MCP server (https://mcp.coros.com/mcp, built for AI clients), and
Logbook connects as one of them: the same Settings › Connections row as Strava, behind the same `Provider` interface
(`apps/api/src/services/providers/coros.ts`, with the OAuth client in `oauth.ts` and the JSON-RPC client in `mcp.ts`).
There is nothing to register and no developer console:

1. Set `APP_URL` to the public https URL of your server (COROS redirects the sign-in back to
   `APP_URL/api/connections/coros/callback`, so it has to be reachable from the internet). Nothing else: the COROS row
   appears in Settings › Connections on an https server.
2. Deploy. On the first connect the server discovers COROS's OAuth endpoints from the MCP URL (RFC 9728 and 8414) and
   registers itself as a client (RFC 7591). The registration is kept in the `provider_clients` table and reused; a changed
   `APP_URL` registers again.
3. Settings › Connections › COROS › Connect: sign in at COROS, and the last 120 days of activities arrive in the
   background. COROS has no webhook, so after that the 20-minute loop is the only way new activities come in (an access
   token lasts 30 days and its refresh token 180; both rotate on refresh and are stored).
4. Only if COROS refuses the registration (the connect answers "refused to register this server as a client"): register a
   client with COROS by hand, with `APP_URL/api/connections/coros/callback` as its redirect and the scope
   `openid mcp.tools offline_access`, and set `COROS_CLIENT_ID` (and `COROS_CLIENT_SECRET` if one was issued). A local
   http server needs this too. `COROS_MCP_URL` changes the server (default `https://mcp.coros.com/mcp`; the regional
   hosts are followed automatically).

The tool and OAuth endpoints are verified against the live server; the tools' field names are not published, so
`coros.ts` reads them tolerantly (the argument names come from the server's own tool schemas) and logs the first record it
cannot map at debug level. If a connect works but no activities appear, that log line says what to fix, in that one file.

The assistant may read COROS activities: COROS built the MCP server for AI clients. Strava activities never reach a model
(Strava's API terms; see `apps/api/src/services/ai-sources.ts`). A run both recorded (same start within two minutes,
distance within 2%) is counted once, under whichever provider was connected first, and the assistant sees it only when
the COROS copy is the one kept.

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
| `RUN_JOBS` | Who runs the background jobs: `inline` (the API, default), `worker` (`dist/worker.js`), `off` |
| `RUN_MIGRATIONS` | `0` skips the migrations at boot (`pnpm db:migrate` applies them by hand) |
| `LOG_LEVEL`, `LOG_FORMAT` | `debug`/`info`/`warn`/`error`; `json` (production default) or `pretty` |
| `SENTRY_DSN` | Errors go to Sentry as well as the log |
| `METRICS_TOKEN` | Bearer token for `GET /api/metrics` (open when unset) |
| `BACKUP_DIR`, `BACKUP_KEEP` | The nightly `VACUUM INTO` copies: where (`backups/` next to the DB) and how many (7) |
| `LITESTREAM_REPLICA_URL`, `LITESTREAM_ACCESS_KEY_ID`, `LITESTREAM_SECRET_ACCESS_KEY`, `LITESTREAM_REPLICA_ENDPOINT` | Continuous replication of the database to a bucket (Docker entrypoint) |

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

## Backups

Two layers, both on by default once configured: Litestream streams the WAL to a bucket within a second of every write
(point-in-time restore, 72 h of history), and the server writes a plain copy of the whole database every night.

**Nightly copies.** At 03:00 UTC the jobs runner (the API, or the worker) runs `VACUUM INTO /data/backups/logbook-YYYY-MM-DD.db`
and keeps the newest seven (`BACKUP_DIR`, `BACKUP_KEEP`). A copy is a complete, compact SQLite file that any `sqlite3`
opens. `scripts/backup.sh` writes one by hand (with an integrity check), from the machine:

```
fly ssh console -C "/app/scripts/backup.sh"
fly sftp get /data/backups/logbook-<stamp>.db ./
```

**Litestream on Tigris** (Fly's S3-compatible storage; R2 or B2 work the same with their endpoint). 6 steps, ~5 min:

1. **Create** the bucket from this folder: `fly storage create --name <your-app-name>-db`. It prints the credentials:
   `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_ENDPOINT_URL_S3`, `BUCKET_NAME`. (It also sets them as secrets
   on the app under those names; Litestream reads its own, set next.)
2. **Set** them for Litestream:
   ```
   fly secrets set LITESTREAM_REPLICA_URL=s3://<BUCKET_NAME>/logbook \
     LITESTREAM_ACCESS_KEY_ID=<AWS_ACCESS_KEY_ID> LITESTREAM_SECRET_ACCESS_KEY=<AWS_SECRET_ACCESS_KEY> \
     LITESTREAM_REPLICA_ENDPOINT=https://fly.storage.tigris.dev
   ```
   The machine restarts; `fly logs` shows `litestream` replicating `/data/logbook.db`.
3. **Check** it: `fly ssh console -C "litestream snapshots -config /app/litestream.yml /data/logbook.db"` lists the
   generations in the bucket.
4. **Drill** the restore once (do this before you need it). To a scratch path, without touching the live file:
   ```
   fly ssh console -C "litestream restore -o /tmp/drill.db -config /app/litestream.yml /data/logbook.db"
   fly ssh console -C "/app/scripts/restore.sh /tmp/drill.db"   # only if you mean to replace the live database
   ```
   `restore.sh` checks the copy (`PRAGMA integrity_check`, the number of accounts), moves the live file and its
   `-wal`/`-shm` aside as `logbook.db.before-restore-<stamp>`, and puts the copy in place. Then
   `fly machine restart <id>` so the server opens the restored file. The same script takes a nightly copy or an
   `s3://` URL. For a dry run that touches nothing, stop after the first command and open `/tmp/drill.db`.
5. **Lose the volume** and come back: a new machine with an empty `/data` starts, `start.sh` sees no database file,
   runs `litestream restore -if-replica-exists` and boots on the restored copy. Nothing to do by hand.
6. **Rotate** the keys when you rotate anything else: `fly storage` can issue new credentials; set them with the same
   `fly secrets set` as in step 2.

Locally, `docker compose` reads the same four `LITESTREAM_*` values from `.env`.

## Observability

**Logs.** One JSON object per line on stdout (`LOG_FORMAT=json`, the production default; `pretty` for a terminal):
`level`, `time`, `msg`, then the fields. Every API request writes one line (`method`, `path`, `status`, `ms`, `userId`,
`ip`, `requestId`); a request over a second is logged at `warn` as `slow request`. The request id comes from the
caller's `X-Request-Id` when it sends one, is minted otherwise, and goes back in the response header; every line
written while the request is being served carries it, as does a 500's body (`requestId`), so one `fly logs | grep
<id>` shows what happened. `LOG_LEVEL=debug` adds the health checks and the jobs' idle ticks.

**Errors.** `services/ops/errors.ts` reports anything unexpected: a 500 from a route, a job that threw, an unhandled
rejection (logged, process goes on), an uncaught exception (logged, process exits 1 and is restarted). With
`SENTRY_DSN` set, each goes to Sentry too, with the request id, the user id, the job name and the process (`api` or
`worker`) as tags; `@sentry/node` is loaded only when the DSN is set.

**Health.** `GET /api/health` and `GET /api/ready` (the same answer) run `SELECT 1` and report
`{ ok, db: "ok", wal_bytes, uptime_s, version }`; a database that cannot answer is a 503, and so is the window
between SIGTERM and exit, so the proxy drains the machine before it stops. Fly's check and the Docker `HEALTHCHECK`
poll `/api/ready`.

**Metrics.** `GET /api/metrics` is Prometheus text (`Authorization: Bearer $METRICS_TOKEN` when the token is set; set
it in production): `http_requests_total{class}` and the `http_request_duration_seconds` histogram for this process;
`logbook_job_runs_total{name,ok}` and `logbook_job_last_success_timestamp_seconds{name}` from the `job_runs` table
(14 days, both processes); `logbook_llm_tokens_24h{kind}` and `logbook_llm_calls_24h` from `llm_usage`;
`logbook_active_users_24h` (accounts whose session was used in the last day) and `logbook_users_total`;
`logbook_db_file_bytes` and `logbook_db_wal_bytes`; `process_uptime_seconds`, `process_resident_memory_bytes`,
`logbook_build_info{version}`. Point a Grafana Cloud or Prometheus scraper at it, or just `curl` it.

**Rate limits** persist in the `rate_limits` table (fixed windows, a small cache in front), so a restart or a second
process does not reset them: per account, the assistant (30 an hour) and plan drafts (10 a day); per address, 20
calls a minute on `/api/auth/*` and a soft 600 a minute on `/api/*` (counted ten at a time), with the address taken
from `Fly-Client-IP`, then the first `X-Forwarded-For` hop. Over a limit is a 429 with `Retry-After`.

## The worker process

The background jobs are seven families, each a timer: `reminders` (the 60 s loop that books the system reminders and
sends what is due), `provider-sync` (Strava and COROS, every 20 min), `session-purge` (6 h), `wal-checkpoint`
(`PRAGMA wal_checkpoint(PASSIVE)` every 5 min), `nightly-backup` (03:00 UTC, catching up after downtime),
`idempotency-purge` (1 h) and `ops-purge` (job runs older than 14 days, stale rate-limit windows, 6 h). Every run is a
row in `job_runs` (`name`, `started_at`, `finished_at`, `ok`, `error`, `meta`); the quiet ones (`reminders`,
`wal-checkpoint`) only write a row when they did something or failed. A failed run is reported like a 500 and the
next tick tries again.

Each family runs under a lease in the database (`leases`: `name`, `holder`, `expires_at`), taken with one
`INSERT … ON CONFLICT DO UPDATE … WHERE expired OR mine` and held a little longer than the period. So whichever
processes are up, one of them runs each job; if that one dies, another takes over within about a period. The
migrations at boot take the same kind of lease, so two processes starting together apply them once.

`RUN_JOBS` says who runs them:

- `inline` (the default): the API process, as before. The right setting for one machine, which is what Fly gives a
  SQLite app: a volume mounts to one machine, and the worker needs the very file the API writes.
- `worker`: `node dist/worker.js` (`pnpm --filter @logbook/api dev:worker` locally), a process with no HTTP, the
  same jobs, the same file. Set `RUN_JOBS=off` on the API then. For a host with a shared local disk
  (`docker-compose.yml` has the service, commented out) or for when the database moves off SQLite; `fly.toml`
  documents the `[processes]` split and why it stays off on Fly.
- `off`: nobody. Reminders stop; only for a scratch API.

Both processes open the database the same way (`db/index.ts`: WAL, `synchronous = NORMAL`, `busy_timeout` 5 s), and
either applies the migrations at boot unless `RUN_MIGRATIONS=0`.
