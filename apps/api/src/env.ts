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
  /** The model every Claude call runs on. No default: set it with the key, or the AI features stay off. */
  ANTHROPIC_MODEL: z.string().optional(),
  /** The model the assistant chat runs on, when it should differ. Falls back to ANTHROPIC_MODEL. */
  ANTHROPIC_ASSISTANT_MODEL: z.string().optional(),
  STRAVA_CLIENT_ID: z.string().optional(),
  STRAVA_CLIENT_SECRET: z.string().optional(),
  /** A long random string Strava echoes back when the webhook subscription is created. No default. */
  STRAVA_WEBHOOK_VERIFY_TOKEN: z.string().optional(),
  /** The id Strava gave the webhook subscription. Events without it are refused (always in production). */
  STRAVA_WEBHOOK_SUBSCRIPTION_ID: z.string().optional(),
  /** The mail provider's API key (password reset and email verification). Without it no mail is sent: development logs the link, production warns at boot. */
  MAIL_API_KEY: z.string().optional(),
  /** The From line, on a domain the mail provider has verified: `Logbook <no-reply@your-domain>`. */
  MAIL_FROM: z.string().optional(),
  /** The provider's send endpoint. It takes a JSON post of `{ from, to, subject, text, html }` with a Bearer key. */
  MAIL_API_URL: z.string().url().default('https://api.resend.com/emails'),
  /** New accounts allowed per address per hour. Defaults to 5 in production and no limit elsewhere (0 is no limit). */
  SIGNUP_PER_HOUR: z.coerce.number().int().min(0).optional(),
  /** The Apple developer team id (10 characters). With it the server answers /.well-known/apple-app-site-association, which lets iOS save and fill the Logbook password in the app. */
  APPLE_TEAM_ID: z
    .string()
    .regex(/^[A-Z0-9]{10}$/, 'Expected the 10 character team id')
    .optional(),
  /** The iOS app's bundle id, for the same file. */
  APP_BUNDLE_ID: z.string().default('com.joshbean.logbook'),
  /** Extra origins allowed to send writes, comma separated (the app's own origin and the iPhone app's are always allowed). */
  ALLOWED_ORIGINS: z.string().optional(),
  /** The support address the public web build was made with (the Dockerfile passes VITE_SUPPORT_EMAIL through). The post-deploy check fails without it. */
  SUPPORT_EMAIL: z.string().optional(),
  /** Dev only: '1' returns a fixed daily pick instead of searching the web. */
  READS_FAKE_PICK: z.string().optional(),
});

/** A real support address: set, shaped like one, and not the example.com placeholder the repository ships. */
export const supportOk = (v: string | undefined): boolean => !!v && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v) && !/@example\.(com|org|net)$/i.test(v);

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
  claudeConfigured: !!(parsed.data.ANTHROPIC_API_KEY && parsed.data.ANTHROPIC_MODEL),
  mailConfigured: !!(parsed.data.MAIL_API_KEY && parsed.data.MAIL_FROM),
  signupPerHour: parsed.data.SIGNUP_PER_HOUR ?? (parsed.data.NODE_ENV === 'production' ? 5 : 0),
  allowedOrigins: (parsed.data.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim().replace(/\/$/, ''))
    .filter(Boolean),
  /** A real support address was built into the web app: set, and not the placeholder the repository ships. */
  supportConfigured: supportOk(parsed.data.SUPPORT_EMAIL),
  readsFakePick: parsed.data.READS_FAKE_PICK === '1' || parsed.data.READS_FAKE_PICK === 'true',
};

/** The values that used to ship as defaults: fine on a laptop, a hole in production. */
export const DEV_SESSION_SECRET = 'dev-only-secret-change-me-please-now';
export const OLD_DEFAULT_WEBHOOK_TOKEN = 'logbook-verify';

/**
 * Why a production server must not start with these settings, one line each (empty when it may). Checked at boot.
 * - the session secret is the built-in development one;
 * - Strava keys are set while the webhook verify token is missing, short, or the old published default: anyone could
 *   then register or spoof the webhook.
 */
export const productionProblems = (e: { isProd: boolean; SESSION_SECRET: string; stravaConfigured: boolean; STRAVA_WEBHOOK_VERIFY_TOKEN?: string }): string[] => {
  if (!e.isProd) return [];
  const out: string[] = [];
  if (e.SESSION_SECRET === DEV_SESSION_SECRET) out.push('Set SESSION_SECRET in production.');
  const token = e.STRAVA_WEBHOOK_VERIFY_TOKEN ?? '';
  if (e.stravaConfigured && (token.length < 16 || token === OLD_DEFAULT_WEBHOOK_TOKEN)) out.push('Strava keys are set, so STRAVA_WEBHOOK_VERIFY_TOKEN must be a long random string (not the old default). Set it, or unset STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET.');
  return out;
};

const problems = productionProblems(env);
if (problems.length) {
  for (const p of problems) console.error(p);
  process.exit(1);
}
