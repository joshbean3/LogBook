import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(8787),
  APP_URL: z.string().url().default('http://localhost:8787'),
  SESSION_SECRET: z.string().min(16).default('dev-only-secret-change-me-please-now'),
  DATABASE_PATH: z.string().default('./data/logbook.db'),
  ALLOW_SETUP: z.string().optional(),
  /** '1' / 'true' lets anyone create an account (not just the first). Off unless set; turn it on for local dev. */
  ALLOW_SIGNUP: z
    .string()
    .default('0')
    .transform((v) => /^(1|true|yes|on)$/i.test(v.trim())),
  WEB_DIST: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().default('claude-opus-5-5'),
  STRAVA_CLIENT_ID: z.string().optional(),
  STRAVA_CLIENT_SECRET: z.string().optional(),
  STRAVA_WEBHOOK_VERIFY_TOKEN: z.string().default('logbook-verify'),
  /**
   * COROS, through its MCP server. Nothing to register: the server discovers COROS's OAuth endpoints from the MCP URL
   * and registers itself as a client on the first connect (RFC 7591). `COROS_CLIENT_ID` (and, if COROS issued one,
   * `COROS_CLIENT_SECRET`) is the fallback when COROS refuses dynamic registration: a client registered by hand with
   * `APP_URL/api/connections/coros/callback` as its redirect.
   */
  COROS_MCP_URL: z.string().url().default('https://mcp.coros.com/mcp'),
  COROS_CLIENT_ID: z.string().optional(),
  COROS_CLIENT_SECRET: z.string().optional(),
  /** Web Push (VAPID). `npx web-push generate-vapid-keys` makes a pair; the subject is a mailto: or https: URL. Unset: the scheduler logs instead of sending. */
  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_SUBJECT: z.string().optional(),
  /** Dev only: '1' returns a fixed daily pick instead of searching the web. */
  READS_FAKE_PICK: z.string().optional(),
  /** Providers whose data never reaches a model, besides strava (always excluded): comma-separated. */
  AI_EXCLUDED_PROVIDERS: z.string().optional(),
  /** Transactional mail (verification, password reset) through Resend's HTTP API. Unset: mails are logged, never sent. */
  RESEND_API_KEY: z.string().optional(),
  /** The From line of every mail: `Logbook <hello@yourdomain>` (a domain verified in Resend). */
  MAIL_FROM: z.string().default('Logbook <onboarding@resend.dev>'),
  // ---------- ops (README: Observability, Backups, The worker process) ----------
  /** '0' skips the migrations at boot (run `pnpm db:migrate` yourself). Anything else runs them, under the `migrations` lease. */
  RUN_MIGRATIONS: z.string().default('1'),
  /** Who runs the background jobs: `inline` (the API process; the default, for one machine), `worker` (dist/worker.js), `off`. */
  RUN_JOBS: z.enum(['inline', 'worker', 'off']).default('inline'),
  /** Lowest level written to stdout. Unset: `info`, or `warn` under test. */
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).optional(),
  /** `json` (one object per line; the default in production) or `pretty` (the default elsewhere). */
  LOG_FORMAT: z.enum(['json', 'pretty']).optional(),
  /** Sentry. Unset: errors are logged only. */
  SENTRY_DSN: z.string().optional(),
  /** When set, GET /api/metrics needs `Authorization: Bearer <token>`. */
  METRICS_TOKEN: z.string().optional(),
  /** Where the nightly `VACUUM INTO` copies go. Default: `backups/` next to the database file. */
  BACKUP_DIR: z.string().optional(),
  /** How many nightly copies to keep. */
  BACKUP_KEEP: z.coerce.number().int().positive().default(7),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Bad environment:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = {
  ...parsed.data,
  isProd: parsed.data.NODE_ENV === 'production',
  allowSetup: parsed.data.ALLOW_SETUP === undefined ? parsed.data.NODE_ENV !== 'production' : parsed.data.ALLOW_SETUP === '1' || parsed.data.ALLOW_SETUP === 'true',
  allowSignup: parsed.data.ALLOW_SIGNUP,
  secureCookies: parsed.data.APP_URL.startsWith('https://'),
  stravaConfigured: !!(parsed.data.STRAVA_CLIENT_ID && parsed.data.STRAVA_CLIENT_SECRET),
  /** COROS registers this server as an OAuth client against APP_URL, which has to be a public https URL; a local http server needs a client COROS registered by hand. */
  corosConfigured: !!parsed.data.COROS_CLIENT_ID || parsed.data.APP_URL.startsWith('https://'),
  vapidConfigured: !!(parsed.data.VAPID_PUBLIC_KEY && parsed.data.VAPID_PRIVATE_KEY),
  claudeConfigured: !!parsed.data.ANTHROPIC_API_KEY,
  readsFakePick: parsed.data.READS_FAKE_PICK === '1' || parsed.data.READS_FAKE_PICK === 'true',
  mailConfigured: !!parsed.data.RESEND_API_KEY,
  runMigrations: parsed.data.RUN_MIGRATIONS !== '0',
  logLevel: parsed.data.LOG_LEVEL ?? (parsed.data.NODE_ENV === 'test' ? 'warn' : 'info'),
  logFormat: parsed.data.LOG_FORMAT ?? (parsed.data.NODE_ENV === 'production' ? 'json' : 'pretty'),
};

if (env.isProd && parsed.data.SESSION_SECRET === 'dev-only-secret-change-me-please-now') {
  console.error('Set SESSION_SECRET in production.');
  process.exit(1);
}
