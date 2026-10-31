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
  /** COROS "Connect your data" OAuth app. The URLs default to the documented endpoints; override them if COROS's docs say otherwise. */
  COROS_CLIENT_ID: z.string().optional(),
  COROS_CLIENT_SECRET: z.string().optional(),
  COROS_AUTH_URL: z.string().default('https://open.coros.com/oauth2/authorize'),
  COROS_TOKEN_URL: z.string().default('https://open.coros.com/oauth2/accesstoken'),
  COROS_API_URL: z.string().default('https://open.coros.com'),
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
  corosConfigured: !!(parsed.data.COROS_CLIENT_ID && parsed.data.COROS_CLIENT_SECRET),
  vapidConfigured: !!(parsed.data.VAPID_PUBLIC_KEY && parsed.data.VAPID_PRIVATE_KEY),
  claudeConfigured: !!parsed.data.ANTHROPIC_API_KEY,
  readsFakePick: parsed.data.READS_FAKE_PICK === '1' || parsed.data.READS_FAKE_PICK === 'true',
  mailConfigured: !!parsed.data.RESEND_API_KEY,
};

if (env.isProd && parsed.data.SESSION_SECRET === 'dev-only-secret-change-me-please-now') {
  console.error('Set SESSION_SECRET in production.');
  process.exit(1);
}
