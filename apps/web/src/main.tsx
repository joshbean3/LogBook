import { QueryClient } from '@tanstack/react-query';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { del, get, set } from 'idb-keyval';
import { MotionConfig } from 'motion/react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { registerSW } from 'virtual:pwa-register';
import { App } from './app/App';
import { onUnauthorized } from './api/client';
import { outbox } from './api/outbox';
import { SheetProvider } from './ui/Sheet';
import { ToastProvider } from './ui/Toast';
import './styles/tokens.css';
import './styles/base.css';
import './styles/ui.css';

const qc = new QueryClient({
  defaultOptions: {
    queries: { gcTime: 1000 * 60 * 60 * 24 * 14, staleTime: 30_000, retry: (n, e) => n < 2 && !(e instanceof Error && 'status' in e && (e as { status: number }).status === 401), refetchOnWindowFocus: true, networkMode: 'offlineFirst' },
    mutations: { networkMode: 'offlineFirst' },
  },
});

// everything the app has seen lives in IndexedDB, so it opens instantly and works on the subway
const persister = createAsyncStoragePersister({
  key: 'logbook.cache.v1',
  storage: { getItem: (k) => get(k), setItem: (k, v) => set(k, v), removeItem: (k) => del(k) },
  throttleTime: 800,
});

onUnauthorized.add(() => qc.removeQueries({ queryKey: ['bootstrap'] }));

void outbox.load().then(() => outbox.replay(qc));
window.addEventListener('online', () => void outbox.replay(qc));
document.addEventListener('visibilitychange', () => !document.hidden && void outbox.replay(qc));

registerSW({ immediate: true });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PersistQueryClientProvider client={qc} persistOptions={{ persister, maxAge: 1000 * 60 * 60 * 24 * 14, buster: 'v1', dehydrateOptions: { shouldDehydrateQuery: (q) => q.state.status === 'success' && !['auth-status'].includes(String(q.queryKey[0])) } }}>
      <MotionConfig reducedMotion="user">
        <BrowserRouter>
          <ToastProvider>
            <SheetProvider>
              <App />
            </SheetProvider>
          </ToastProvider>
        </BrowserRouter>
      </MotionConfig>
    </PersistQueryClientProvider>
  </StrictMode>,
);
