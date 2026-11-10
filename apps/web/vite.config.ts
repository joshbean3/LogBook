import react from '@vitejs/plugin-react';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
// lib/native.ts falls back to this server when VITE_API_ORIGIN is unset; the policy has to allow the same one
import { DEFAULT_API_ORIGIN } from './src/lib/apiOriginDefault';

const here = path.dirname(fileURLToPath(import.meta.url));

/** The commit this bundle was built from, shown after the version in Settings: on a phone, the only way to tell a stale build from a fresh one. */
const commit = (() => {
  try {
    return execSync('git rev-parse --short HEAD', { cwd: here, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return 'dev';
  }
})();

/** The latin files Today paints above the fold: Inter (one variable file covers every weight), Inter Tight (captions), Fraunces roman (the title). */
const PRELOAD = ['Inter-latin.woff2', 'InterTight-latin.woff2', 'fraunces-latin-full-normal.woff2'];
/**
 * Fonts in the shell, not behind a request: public/fonts/fonts.css is inlined into index.html and the above-the-fold files
 * are preloaded, so the first frame has its faces. The native build (VITE_NATIVE=1, `pnpm ios`) reads the files from disk,
 * so there `font-display: block` holds the text for a few ms and nothing ever re-renders; the web keeps `swap` with the
 * metric-matched fallbacks fonts.css declares.
 */
const fonts = (): Plugin => ({
  name: 'logbook:fonts',
  transformIndexHtml: {
    order: 'pre',
    handler(html) {
      let css = fs.readFileSync(path.join(here, 'public', 'fonts', 'fonts.css'), 'utf8');
      css = css
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\s+/g, ' ')
        .replace(/\s*([{}:;,])\s*/g, '$1')
        .trim();
      if (process.env.VITE_NATIVE === '1') css = css.replaceAll('font-display:swap', 'font-display:block');
      const links = PRELOAD.map((f) => `<link rel="preload" as="font" type="font/woff2" crossorigin href="/fonts/${f}" />`).join('\n    ');
      return html.replace('<link rel="stylesheet" href="/fonts/fonts.css" />', `${links}\n    <style>${css}</style>`);
    },
  },
});

/**
 * The Content-Security-Policy, as a meta tag in the built index.html (sec-22). The server sends its own header for the web;
 * this one also covers the iPhone app, which loads the page from disk. Scripts come only from the bundle; styles may be
 * inline (the fonts block above, and React's style props); requests go to this origin and the API's. Not in the dev
 * server, whose HMR client needs inline scripts and a websocket.
 */
const csp = (apiOrigin: string): Plugin => ({
  name: 'logbook:csp',
  apply: 'build',
  transformIndexHtml: {
    order: 'post',
    handler(html) {
      const connect = ["'self'", apiOrigin].filter(Boolean).join(' ');
      const policy = [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob: https:",
        "font-src 'self' data:",
        `connect-src ${connect}`,
        "worker-src 'self'",
        "manifest-src 'self'",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
      ].join('; ');
      return html.replace('<meta charset="UTF-8" />', `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${policy}" />`);
    },
  },
});

/**
 * The build-time flags (src/lib/features.ts, documented in src/vite-env.d.ts). Each is pinned to a string literal here, set
 * or not, so the bundler folds every `if (STRAVA_BUILT)` and drops the code behind a false flag from the build.
 */
const FLAGS = ['VITE_FEATURE_STRAVA', 'VITE_FEATURE_HEALTH', 'VITE_FAKE_CLOCK'] as const;

export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, here, 'VITE_'), ...process.env };
  const flags = Object.fromEntries(FLAGS.map((k) => [`import.meta.env.${k}`, JSON.stringify(env[k] ?? '')]));
  return {
    define: { __BUILD_COMMIT__: JSON.stringify(commit), ...flags },
    plugins: [
      react(),
      fonts(),
      // the API's origin as lib/native.ts reads it: the iPhone app calls it (the web build calls its own origin)
      csp(env.VITE_API_ORIGIN || DEFAULT_API_ORIGIN),
      VitePWA({
        // a new build waits and is applied when the page is hidden or on the next cold start (src/lib/sw.ts, shell-25)
        registerType: 'prompt',
        includeAssets: ['icons/*.png', 'icons/*.svg'],
        manifest: {
          name: 'Orby',
          short_name: 'Orby',
          description: 'Training, habits and a journal. One quiet place for the day.',
          start_url: '/today',
          scope: '/',
          display: 'standalone',
          orientation: 'portrait',
          background_color: '#f3f8fb',
          theme_color: '#f3f8fb',
          categories: ['health', 'fitness', 'lifestyle'],
          icons: [
            { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
            { src: '/icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        workbox: {
          navigateFallback: '/index.html',
          // the legal pages are served as files (public/legal): never precached, never answered with the app shell
          navigateFallbackDenylist: [/^\/api\//, /^\/legal\//],
          // the build's scripts, styles and icons; not the fonts (eight files, 400 KB), which are cached as they are used
          globPatterns: ['**/*.{js,css,html,svg,png}'],
          globIgnores: ['fonts/**', 'legal/**'],
          runtimeCaching: [
            {
              urlPattern: ({ url }) => url.pathname.startsWith('/fonts/'),
              handler: 'CacheFirst',
              options: { cacheName: 'fonts', expiration: { maxEntries: 16, maxAgeSeconds: 60 * 60 * 24 * 365 }, cacheableResponse: { statuses: [0, 200] } },
            },
          ],
        },
        devOptions: { enabled: false },
      }),
    ],
    resolve: { alias: { '@': path.resolve(here, 'src') } },
    server: {
      port: 5173,
      proxy: { '/api': { target: `http://localhost:${process.env.API_PORT ?? 8787}`, changeOrigin: false } },
    },
    build: { target: 'es2022', sourcemap: false, chunkSizeWarningLimit: 900 },
  };
});
