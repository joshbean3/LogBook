# Logbook server runbook

One page for the person on call. The server is one Fly machine with one volume. The database is a single SQLite file at `/data/logbook.db`.

Commands that start with `fly ssh console -C` run on the server. Replace `<app>` with the Fly app name.

## What protects the data

| Layer | Where | Kept for | Covers |
|---|---|---|---|
| Volume snapshots | Fly.io, same provider as the server | 5 days (Fly's default; check with `fly volumes show`) | A bad deploy, a deleted file |
| Nightly off-site backup | An S3-compatible bucket with a different provider. This runbook assumes Cloudflare R2. If you pick another provider, change this line and the privacy policy. | `BACKUP_KEEP_DAYS`, default 5 | Losing the Fly volume or the Fly account |

Both windows are 5 days on purpose. The app and the privacy policy tell people that deleted data leaves backups within 5 days. If you change `BACKUP_KEEP_DAYS` or the snapshot retention, change that sentence in the app (Settings, Delete account) and in the policy to the larger of the two numbers.

The backup holds the whole database: every account's email, training log, journal and Apple Health readings. Treat the bucket like the server. Keep it private, turn on the provider's encryption at rest, and give the access key write, list and delete rights on this one bucket only.

## Set up the nightly backup (once)

1. Create a private bucket with the storage provider. Turn off public access.
2. Create an access key limited to that bucket.
3. Set the secrets:

   ```
   fly secrets set -a <app> \
     BACKUP_S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com \
     BACKUP_S3_BUCKET=<bucket> \
     BACKUP_S3_ACCESS_KEY_ID=<key id> \
     BACKUP_S3_SECRET_ACCESS_KEY=<secret>
   ```

   Optional: `BACKUP_S3_REGION` (default `auto`, right for R2; other providers want the bucket's region), `BACKUP_S3_PREFIX` (folder, default `logbook`), `BACKUP_KEEP_DAYS` (default 5).
4. Take one now and look at it:

   ```
   fly ssh console -a <app> -C "node dist/ops.js backup"
   fly ssh console -a <app> -C "node dist/ops.js backups"
   ```

5. Do the test restore below once, before launch.

After that the server takes a backup every day after 08:00 UTC and deletes remote copies older than the keep days in the same run. Each run writes one log line: `{"evt":"backup","ok":true,...}`. A failed run logs `"ok":false` with the reason and tries again within half an hour. With the secrets unset the server logs a warning at boot and makes no off-site backup.

Check it weekly: `fly logs -a <app> | grep '"evt":"backup"'`.

## Restore

Restoring replaces the live database. Everything written after the backup was taken is lost. Tell people before you do it if you can.

### Test restore (safe, do this once before launch and after any change here)

1. Download the newest object from the bucket (the provider's console or CLI). Its name looks like `logbook/2026-11-10/logbook-2026-11-10T08-00-03-000Z.db.gz`.
2. On your own machine:

   ```
   gunzip logbook-2026-11-10T08-00-03-000Z.db.gz
   sqlite3 logbook-2026-11-10T08-00-03-000Z.db "pragma integrity_check; select count(*) from users;"
   ```

   You want `ok` and the number of accounts you expect.
3. Optional: start the app on it. `DATABASE_PATH=./logbook-...db pnpm --filter @logbook/api dev`, then sign in.
4. Delete the downloaded file when you are done. It holds everyone's data.

### Real restore from the off-site backup

1. Stop the machine so nothing writes: `fly machine stop -a <app>`.
2. Start it again with a shell and no server (`fly machine start`, then `fly ssh console -a <app>`), or use `fly ssh sftp shell -a <app>` once it is up. Keep traffic away while you work: `fly scale count 0` is not possible with a volume, so do this at a quiet hour and work fast.
3. Upload the unzipped backup beside the live file: `put logbook-restore.db /data/logbook-restore.db`.
4. On the server:

   ```
   cd /data
   mv logbook.db logbook.before-restore.db
   rm -f logbook.db-wal logbook.db-shm
   mv logbook-restore.db logbook.db
   ```

5. Restart: `fly machine restart -a <app>`. The server runs its migrations on start, so a backup from an older version is brought up to date.
6. Run the post-deploy check (below) and sign in.
7. When you are sure, delete `/data/logbook.before-restore.db`.

### Restore from a Fly volume snapshot

`fly volumes snapshots list <volume id>`, then `fly volumes create logbook_data --snapshot-id <id> --region <region>`, then move the machine to the new volume (Fly's docs: "Restore a volume from a snapshot"). Use this when the volume is fine but the data is wrong and the mistake is less than 5 days old.

## After every deploy

```
fly deploy -a <app>
pnpm --filter @logbook/api check:deploy -- https://<your host>
```

The check fails, with one line per problem, when the server does not answer, sign-up is closed, mail is not configured, or the AI features are off. Fix what it says and run it again. Do not announce a release that fails it.

## Rotate secrets

Set the new value with `fly secrets set -a <app> NAME=value`. Fly restarts the machine. Then run the post-deploy check.

| Secret | What rotating it does | After |
|---|---|---|
| `SESSION_SECRET` | Changes the signing key for Strava's OAuth state. Sessions are random ids in the database and are not signed, so people stay signed in. | Nothing. To sign everyone out as well, also revoke all sessions (below). |
| `ANTHROPIC_API_KEY` | New key for every Claude call. | Revoke the old key in the Anthropic Console. Send one assistant message to check. |
| `MAIL_API_KEY` | New key for reset and verification mail. | Revoke the old key with the mail provider. Ask for a password reset to check. |
| `BACKUP_S3_ACCESS_KEY_ID`, `BACKUP_S3_SECRET_ACCESS_KEY` | New key for the backup bucket. | Delete the old key with the storage provider. Run `node dist/ops.js backup`. |
| `STRAVA_CLIENT_SECRET`, `STRAVA_WEBHOOK_VERIFY_TOKEN` | Only when Strava is on (not in 1.0). | Create the webhook subscription again and set `STRAVA_WEBHOOK_SUBSCRIPTION_ID`. |

Rotate everything, in this order, if the server, a laptop with the secrets, or the Fly account may have been read by someone else: `ANTHROPIC_API_KEY`, `MAIL_API_KEY`, the backup keys, `SESSION_SECRET`. Then revoke all sessions and all Apple Health device tokens.

`ANTHROPIC_MODEL` is not a secret, but it lives with them: it is the id of the model every Claude call uses. With it unset the AI features are off.

## Revoke sessions

Sign everyone out (after a suspected leak of the database or a backup):

```
fly ssh console -a <app> -C "node dist/ops.js revoke-sessions"
```

Sign one account out everywhere (a lost phone, a request from the person):

```
fly ssh console -a <app> -C "node dist/ops.js revoke-sessions person@example.com"
```

Phones that connected Apple Health hold their own sync token, apart from the session. To make every phone connect again:

```
fly ssh console -a <app> -C "node dist/ops.js revoke-health-tokens"
```

A person can also do the first of these themselves: changing the password in Settings signs out every other device, and a password reset signs out all of them.

## Logs and the security log

Every request writes one JSON line to the Fly log (`fly logs -a <app>`): method, route pattern, status, milliseconds and a keyed hash of the account (never a body, a query string, an address or an id from the path). Errors nobody caught are `"t":"error"` lines, and reports from the app are `"t":"client_error"` lines with no account at all.

Sign-in, sign-up, password, consent and deletion events go to the `audit_log` table under the same keyed hash, kept 12 months. To read one account's rows:

```
fly ssh console -a <app> -C "node dist/ops.js audit person@example.com"
```

The hash is keyed with `SESSION_SECRET`: after rotating it, older rows no longer match the account.

## What is removed on its own

Four times a day the server removes, for good: anything a person deleted more than 30 days ago, the assistant's proposals after 90 days, expired sessions (and every session 180 days after sign-in), spent reset and verification links, and security log rows after 12 months. Snapshots and backups keep a copy for 5 more days. `node dist/ops.js tables` lists any table the code does not know (there should be none).

## The App Review demo account

App Review signs in with a demo account. Build it (or rebuild it with fresh dates before each submission):

```
fly ssh console -a <app> -C "sh -c 'REVIEW_EMAIL=review@your-domain REVIEW_PASSWORD=... node dist/ops.js seed-review'"
```

It is onboarded, with six weeks of a half marathon plan (three behind, marked), four habits, goals, journal lines, to-dos and six weeks of sample sleep, heart rate variability and resting heart rate. Running it again removes the account and builds it afresh. Consent is not set, so the reviewer sees the AI permission step. The health readings are sample data (say so in the review notes); a phone that connects Apple Health never removes them. Put the same email and password in App Store Connect, App Review Information.

## Limits to know about

- One machine. A deploy sends SIGINT; the server stops taking connections, finishes what is in flight (up to 10 s), closes the database and exits. For a few seconds requests fail and the app queues changes on the phone.
- Kept in memory and cleared by a restart: assistant answers in progress, the per-user AI limits, the daily pick's refresh count, failed sign-ins per address. Kept in the database and not cleared: failed sign-ins per email, sign-up and reset counters, the one-a-day Remember when count.
- The volume fills up like any disk. `fly volumes list -a <app>` shows the size. Extend it before it passes 70 percent: `fly volumes extend <volume id> -s <GB>`.
- Password reset and verification mail need `MAIL_API_KEY` and `MAIL_FROM`. Without them the server sends nothing and the post-deploy check fails.

## Someone asks for their data or for deletion

- A copy: Settings, Export in the app gives them everything, Apple Health readings and the consent log included. If they cannot sign in, they reset the password first.
- Deletion: Settings, Delete account removes every row at once. Volume snapshots and off-site backups that still hold it are gone within 5 days.
- If the person cannot use the app at all, verify they control the email address, then use a database shell. Write down what you did and when.
