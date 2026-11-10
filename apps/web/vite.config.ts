import react from '@vitejs/plugin-react';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const here = path.dirname(fileURLToPath(import.meta.url));

/** The commit and time this bundle was built from, shown under the version in Settings: on a phone, the only way to tell a stale build from a fresh one. */
const commit = (() => {
  try {
    return execSync('git rev-parse --short HEAD', { cwd: here, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return 'dev';
  }
})();
const builtAt = new Date().toISOString();

/** The three latin files Today paints with: Inter (one variable file covers 400/500/600), Inter Tight 800, Instrument Serif italic. */
const PRELOAD = ['Inter-latin.woff2', 'InterTight-latin.woff2', 'InstrumentSerif-italic-latin.woff2'];
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
 * The build-time flags (src/lib/features.ts, documented in src/vite-env.d.ts). Each is pinned to a string literal here, set
 * or not, so the bundler folds every `if (STRAVA_BUILT)` and drops the code behind a false flag from the build.
 */
const FLAGS = ['VITE_FEATURE_STRAVA', 'VITE_FEATURE_HEALTH', 'VITE_FAKE_CLOCK'] as const;

export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, here, 'VITE_'), ...process.env };
  const flags = Object.fromEntries(FLAGS.map((k) => [`import.meta.env.${k}`, JSON.stringify(env[k] ?? '')]));
  return {
    define: { __BUILD_COMMIT__: JSON.stringify(commit), __BUILD_AT__: JSON.stringify(builtAt), ...flags },
    plugins: [
      react(),
      fonts(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['icons/*.png', 'icons/*.svg'],
        manifest: {
          name: 'Logbook',
          short_name: 'Logbook',
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
          navigateFallbackDenylist: [/^\/api\//],
          // the build's scripts, styles and icons; not the fonts (eight files, 400 KB), which are cached as they are used
          globPatterns: ['**/*.{js,css,html,svg,png}'],
          globIgnores: ['fonts/**'],
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
