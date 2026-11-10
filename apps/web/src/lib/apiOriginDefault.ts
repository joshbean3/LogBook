/**
 * The server the iOS app talks to when the build names none in VITE_API_ORIGIN. Kept in this one file, read by lib/native.ts
 * and by the Content-Security-Policy in vite.config.ts, so the two can never disagree. A release build must set
 * VITE_API_ORIGIN to a domain the owner controls (scope decision D7; the release script checks it).
 */
export const DEFAULT_API_ORIGIN = 'https://josh-logbook.fly.dev';
