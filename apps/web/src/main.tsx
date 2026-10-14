import { QueryClient } from '@tanstack/react-query';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { del, get, set } from 'idb-keyval';
import { LayoutGroup, MotionConfig } from 'motion/react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { registerSW } from 'virtual:pwa-register';
import { bootNative, isNative } from '@/lib/native';
import { App } from './app/App';
import { onUnauthorized } from './api/client';
import { outbox } from './api/outbox';
import { ContextMenuProvider } from './ui/ContextMenu';
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
const withTimeout = <T,>(p: Promise<T>, ms: number, fallback: T): Promise<T> => Promise.race([p, new Promise<T>((r) => setTimeout(() => r(fallback), ms))]);
const persister = createAsyncStoragePersister({
  key: 'logbook.cache.v1',
  storage: {
    getItem: (k) => withTimeout(get<string>(k).catch(() => null), 2500, null).then((v) => v ?? null),
    setItem: (k, v) => set(k, v).catch(() => undefined),
    removeItem: (k) => del(k).catch(() => undefined),
  },
  throttleTime: 800,
});

onUnauthorized.add(() => qc.removeQueries({ queryKey: ['bootstrap'] }));

void outbox.load().then(() => outbox.replay(qc));
window.addEventListener('online', () => void outbox.replay(qc));
// coming back to the app: push what was written offline, ask the server for anything new (it syncs runs on bootstrap), then refresh the months once the sync has had a moment
document.addEventListener('visibilitychange', () => {
  if (document.hidden) return;
  void outbox.replay(qc);
  void qc.invalidateQueries({ queryKey: ['bootstrap'] });
  setTimeout(() => void qc.invalidateQueries({ queryKey: ['month'] }), 6000);
});

if (!isNative) registerSW({ immediate: true });
void bootNative();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PersistQueryClientProvider client={qc} persistOptions={{ persister, maxAge: 1000 * 60 * 60 * 24 * 14, buster: 'v1', dehydrateOptions: { shouldDehydrateQuery: (q) => q.state.status === 'success' && !['auth-status'].includes(String(q.queryKey[0])) } }}>
      <MotionConfig reducedMotion="user">
        <BrowserRouter>
          {/* one LayoutGroup for the app: motion layoutIds in different subtrees (a row, a header) animate together */}
          <LayoutGroup>
            <ToastProvider>
              {/* above the sheets, so a sheet's content (a header ⋯, a row) can open the context menu */}
              <ContextMenuProvider>
                <SheetProvider>
                  <App />
                </SheetProvider>
              </ContextMenuProvider>
            </ToastProvider>
          </LayoutGroup>
        </BrowserRouter>
      </MotionConfig>
    </PersistQueryClientProvider>
  </StrictMode>,
);
