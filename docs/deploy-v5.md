# Deploying v5 to Fly

Deploy only a verified ref: `deploy/v5` (tag `v5.0.0`) today, `v5.1.0` once the accounts, backups and COROS work is verified. This release runs three migrations at boot (assistant threads, reminders, the provider tables, which rebuild `activities` and drop `strava_accounts`), so back the database up first.

9 steps, ~15 min. Need: a Mac with `flyctl` signed in, the app's name (the one `fly apps list` shows; the README used `josh-logbook`).

1. **Open** Terminal.
2. **Fetch** the ref (~1 min):
   ```bash
   cd ~/LogBook && git fetch origin deploy/v5 && git checkout deploy/v5
   ```
3. **Back up** the live database before the migrations run (~1 min):
   ```bash
   fly ssh sftp get /data/logbook.db ./logbook-before-v5.db -a <app>
   ```
   If: the command says the file is busy, run `fly ssh console -a <app> -C "sqlite3 /data/logbook.db '.backup /data/before-v5.db'"` first, then fetch `/data/before-v5.db`.
4. **Set** the one secret this release reads that the last did not (nothing else is required):
   ```bash
   fly secrets set ALLOW_SETUP=0 -a <app>
   ```
   Skip if: `fly secrets list -a <app>` already shows `ALLOW_SETUP`.
5. **Deploy** (~5 min; the image builds remotely):
   ```bash
   fly deploy -a <app> --remote-only
   ```
6. **Check** the health line says the database is up:
   ```bash
   curl -s https://<app>.fly.dev/api/health
   ```
7. **Open** `https://<app>.fly.dev` on the phone, sign in, and look at Today, Plan and Settings › Connections (Strava should still read Connected: the migration carries the account over).
8. **Watch** the logs for five minutes; a migration or scheduler error shows here:
   ```bash
   fly logs -a <app>
   ```
9. **Keep** the backup file until the next release.

Optional, after the deploy:
- Push notifications: `npx web-push generate-vapid-keys`, then `fly secrets set VAPID_PUBLIC_KEY=… VAPID_PRIVATE_KEY=… VAPID_SUBJECT=mailto:you@example.com -a <app>`.
- The iPhone build: `VITE_API_ORIGIN=https://<app>.fly.dev pnpm ios` (the origin no longer has a default).

Rollback: `fly releases -a <app>` then `fly deploy -a <app> --image <previous image>`; restore the database from step 3 with `fly ssh sftp put` if a migration went wrong.

To let a cloud session deploy on its own, add a Fly deploy token (`fly tokens create deploy -a <app>`) to the cloud environment's settings as `FLY_API_TOKEN`; a new session picks it up.
