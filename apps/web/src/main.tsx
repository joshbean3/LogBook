import { QueryClient } from '@tanstack/react-query';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { del, get, set } from 'idb-keyval';
import { MotionConfig } from 'motion/react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { startKeyboard } from '@/lib/keyboard';
import { startPressDelegate } from '@/ui/usePress';
import { bootNative } from '@/lib/native';
import { startServiceWorker } from '@/lib/sw';
import { App } from './app/App';
import { NavController } from './app/NavController';
import { onUnauthorized } from './api/client';
import { outbox } from './api/outbox';
import { stravaSyncNow } from './api/queries';
import type { Bootstrap } from './api/types';
import { ContextMenuProvider } from './ui/ContextMenu';
import { SheetProvider } from './ui/Sheet';
import { ToastProvider } from './ui/Toast';
import './styles/tokens.css';
import './styles/base.css';
import './styles/ui.css';

const qc = new QueryClient({
  defaultOptions: {
    // refetchOnWindowFocus is off: coming back to the app is handled once, below, with one request
    queries: { gcTime: 1000 * 60 * 60 * 24 * 14, staleTime: 30_000, retry: (n, e) => n < 2 && !(e instanceof Error && 'status' in e && (e as { status: number }).status === 401), refetchOnWindowFocus: false, networkMode: 'offlineFirst' },
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
/**
 * Coming back to the app (critic C1): push what was written offline, then one request, the bootstrap. The dated data (months,
 * to-dos, the daily pair, journal, reads and the pick) is refetched only when that answer differs from what was cached (the
 * cached object keeps its identity when nothing changed) or when it has gone unrefreshed for five minutes. No blind second
 * wave. With Strava connected per the CACHED bootstrap, `/strava/sync` starts in this same handler, synchronously and in
 * parallel with the bootstrap (docs/feel.md §12), through stravaSyncNow so the open face's status line sees it on the first
 * frame; the server joins a sync already running, and the months are refetched only when a run arrived.
 */
const FRESH_MS = 5 * 60_000;
const DATED = new Set(['month', 'todos', 'daily', 'journal', 'reads', 'reads-pick', 'activities']);
const syncIfConnected = () => {
  if (qc.getQueryData<Bootstrap>(['bootstrap'])?.strava?.connected) void stravaSyncNow(qc).catch(() => undefined);
};
document.addEventListener('visibilitychange', () => {
  if (document.hidden) return;
  syncIfConnected();
  void outbox.replay(qc);
  const before = qc.getQueryData(['bootstrap']);
  void qc.invalidateQueries({ queryKey: ['bootstrap'] }).then(() => {
    const boot = qc.getQueryData<Bootstrap>(['bootstrap']);
    const changed = before !== undefined && boot !== before;
    void qc.invalidateQueries({ predicate: (q) => DATED.has(String(q.queryKey[0])) && (changed || Date.now() - q.state.dataUpdatedAt > FRESH_MS), refetchType: 'active' });
  });
});

startKeyboard();
startPressDelegate();
// the service worker waits for the first screen (lib/sw.ts, called from App); a signed-out open gets it after a while
setTimeout(startServiceWorker, 8000);
void bootNative();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PersistQueryClientProvider
      client={qc}
      persistOptions={{ persister, maxAge: 1000 * 60 * 60 * 24 * 14, buster: 'v1', dehydrateOptions: { shouldDehydrateQuery: (q) => q.state.status === 'success' && !['auth-status', 'auth-session'].includes(String(q.queryKey[0])) } }}
      onSuccess={() => {
        // a cold open: the sync starts from the persisted bootstrap at once, not after the first network answer
        if (!document.hidden) syncIfConnected();
      }}
    >
      <MotionConfig reducedMotion="user">
        <BrowserRouter>
          {/* the one owner of history; above the toasts, the menu and the sheets so they can call useNav() (contracts §A.5) */}
          <NavController>
            <ToastProvider>
              {/* above the sheets, so a sheet's content can open the context menu */}
              <ContextMenuProvider>
                <SheetProvider>
                  <App />
                </SheetProvider>
              </ContextMenuProvider>
            </ToastProvider>
          </NavController>
        </BrowserRouter>
      </MotionConfig>
    </PersistQueryClientProvider>
  </StrictMode>,
);
