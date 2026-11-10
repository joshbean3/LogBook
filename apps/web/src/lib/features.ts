/**
 * Build-time feature choices. A server flag may report an outage. It never reveals a feature the build left out.
 *
 * Each one is a constant the bundler folds (vite.config.ts pins the env values with `define`), so code behind a false flag
 * is dropped from the build, not switched off (App Review Guideline 2.5.19). The flags are documented in vite-env.d.ts.
 */
export const STRAVA_BUILT = import.meta.env.VITE_FEATURE_STRAVA === '1';
export const HEALTH_BUILT = import.meta.env.VITE_FEATURE_HEALTH !== '0';
/** The component gallery, the pager lab, the test stubs and the window test hooks: the dev server and test builds only. */
export const DEV_TOOLS = import.meta.env.DEV || import.meta.env.VITE_FAKE_CLOCK === '1';
