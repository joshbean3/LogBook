/** Build-time feature choices. A server flag may report an outage. It never reveals a feature the build left out. */
export const STRAVA_BUILT = import.meta.env.VITE_FEATURE_STRAVA === '1';
export const HEALTH_BUILT = import.meta.env.VITE_FEATURE_HEALTH !== '0';
