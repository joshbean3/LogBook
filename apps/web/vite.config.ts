import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const here = path.dirname(fileURLToPath(import.meta.url));

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

export default defineConfig({
  plugins: [
    react(),
    fonts(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.png', 'icons/*.svg', 'fonts/*'],
      manifest: {
        name: 'Logbook',
        short_name: 'Logbook',
        description: 'Training, habits and a journal. One quiet place for the day.',
        start_url: '/today',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#000000',
        theme_color: '#000000',
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
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts-css', expiration: { maxEntries: 8, maxAgeSeconds: 60 * 60 * 24 * 365 } },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: { cacheName: 'google-fonts-files', expiration: { maxEntries: 24, maxAgeSeconds: 60 * 60 * 24 * 365 }, cacheableResponse: { statuses: [0, 200] } },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  resolve: { alias: { '@': path.resolve(here, 'src') } },
  server: {
    port: 5173,
    proxy: { '/api': { target: 'http://localhost:8787', changeOrigin: false } },
  },
  build: { target: 'es2022', sourcemap: false, chunkSizeWarningLimit: 900 },
});
