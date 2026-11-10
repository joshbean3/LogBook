/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

/** Set by vite.config.ts at build time. */
declare const __BUILD_COMMIT__: string;

/**
 * Build-time settings. They are read when the bundle is built, never at run time, and nothing on the server can change
 * them afterwards.
 *
 * Feature flags (src/lib/features.ts; vite.config.ts pins each to a constant so code behind a false flag is left out of the
 * build, not switched off):
 * - VITE_FEATURE_STRAVA: "1" builds the Strava connection (STRAVA_BUILT). Unset in the App Store build, which then holds
 *   no Strava screen, request or string. The owner's own development build sets it.
 * - VITE_FEATURE_HEALTH: "0" leaves Apple Health out (HEALTH_BUILT is false). Anything else, or unset, builds it.
 * - VITE_FAKE_CLOCK: "1" makes a test build: the fake clock, the window test hooks, the component gallery at /dev/ui and
 *   the stub pages (DEV_TOOLS). Never set for a release.
 *
 * Addresses:
 * - VITE_NATIVE: "1" for the iOS shell's bundle (`pnpm build:ios`).
 * - VITE_API_ORIGIN: the server the iOS app talks to.
 * - VITE_SITE_ORIGIN: where the legal and support pages live (defaults to the API origin).
 * - VITE_SUPPORT_EMAIL: the support address shown in the app.
 * - VITE_APP_STORE_ID: the App Store id, for the review link.
 */
interface ImportMetaEnv {
  readonly VITE_FEATURE_STRAVA?: string;
  readonly VITE_FEATURE_HEALTH?: string;
  readonly VITE_FAKE_CLOCK?: string;
  readonly VITE_NATIVE?: string;
  readonly VITE_API_ORIGIN?: string;
  readonly VITE_SITE_ORIGIN?: string;
  readonly VITE_SUPPORT_EMAIL?: string;
  readonly VITE_APP_STORE_ID?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
