// first: a sign-out wipe that was cut short by its own reload is finished before anything else reads the device (lib/account.ts)
import { clearLocalAccount, wipeFinished } from './lib/account';
import { MutationCache, QueryClient, type Query } from '@tanstack/react-query';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { del, get, set } from 'idb-keyval';
import { MotionConfig } from 'motion/react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { isValidElement } from 'react';
import { BrandSplash } from '@/app/BrandSplash';
import { BrowserRouter } from 'react-router';
import { signedOutHome } from '@/features/auth/flag';
import { AssistantSheet } from '@/features/assistant/AssistantSheet';
import { STRAVA_BUILT } from '@/lib/features';
import { haptics } from '@/lib/haptics';
import { startKeyboard } from '@/lib/keyboard';
import { startPressDelegate } from '@/ui/usePress';
import { bootNative } from '@/lib/native';
import { setErrorSender, startErrorReports } from '@/lib/errorReport';
import { startServiceWorker } from '@/lib/sw';
import { App } from './app/App';
import { CACHE_KEY, ErrorBoundary } from './app/ErrorBoundary';
import { NavController } from './app/NavController';
import { isBootstrap } from './api/bootstrap';
import { keepOnDevice } from './api/persist';
import { api, onSignedOut, onUnauthorized, shouldRetryRead } from './api/client';
import { isWriteRejected, outbox } from './api/outbox';
import { stravaSyncNow } from './api/queries';
import type { Bootstrap } from './api/types';
import { ContextMenuProvider } from './ui/ContextMenu';
import { markAssistantBody, SheetProvider } from './ui/Sheet';
import { ToastProvider } from './ui/Toast';
import { showToast, toastStore } from './ui/toastStore';
import { healthSyncNow } from './lib/healthSync';
import './styles/tokens.css';
import './styles/base.css';
import './styles/ui.css';
// the shape system loads after the shared primitives so it wins their ties (App's eager imports come before these three)
import './styles/shape.css';
// the layout kit's rhythm (sections, headers, footnotes): docs/layout-review.md §3
import './styles/layout.css';
// the switch (guide 6.14): its look is the foundation's, since it renders on Goals and on Settings (plan 5.4)
import './styles/switch.css';

// native first: its splash cap is armed before any other boot helper runs (gap-ios-23)
void bootNative();
// layout checks in development only (ui/devChecks.ts): a dynamic import behind the DEV flag, so a release bundle drops it
if (import.meta.env.DEV) void import('./ui/devChecks').then((m) => m.startDevChecks());
// crash reports (Contract 7): a window error, an unhandled rejection and a caught render error each send one small report
setErrorSender((body) => api('/client-errors', { method: 'POST', json: body, timeoutMs: 10_000 }));
startErrorReports();

/**
 * A write the server refused for good (api/outbox.ts marks it) is rolled back by its mutation, and used to vanish without a
 * word. One toast says so, unless the mutation asks to speak for itself (`meta.handlesError`) or its own handler raised a
 * toast in the same beat (the journal puts the words back and says that instead). A write the server could not take right
 * now never gets here: it is queued and the change stands.
 */
const SAVE_FAILED = 'Couldn’t save that. Try again.';
const mutationCache = new MutationCache({
  onError: (error, _vars, _ctx, mutation) => {
    if (!isWriteRejected(error) || mutation.meta?.handlesError || mutation.meta?.quiet) return;
    const seen = toastStore.shown();
    setTimeout(() => {
      if (toastStore.shown() !== seen) return;
      haptics.error();
      showToast(SAVE_FAILED);
    }, 0);
  },
});

const qc = new QueryClient({
  mutationCache,
  defaultOptions: {
    // refetchOnWindowFocus is off: coming back to the app is handled once, below, with one request
    queries: { gcTime: 1000 * 60 * 60 * 24 * 14, staleTime: 30_000, retry: shouldRetryRead, refetchOnWindowFocus: false, networkMode: 'offlineFirst' },
    mutations: { networkMode: 'offlineFirst' },
  },
});

// everything the app has seen lives in IndexedDB, so it opens instantly and works on the subway
const withTimeout = <T,>(p: Promise<T>, ms: number, fallback: T): Promise<T> => Promise.race([p, new Promise<T>((r) => setTimeout(() => r(fallback), ms))]);
const persister = createAsyncStoragePersister({
  key: CACHE_KEY,
  storage: {
    getItem: (k) => withTimeout(wipeFinished.then(() => get<string>(k)).catch(() => null), 2500, null).then((v) => v ?? null),
    setItem: (k, v) => set(k, v).catch(() => undefined),
    removeItem: (k) => del(k).catch(() => undefined),
  },
  throttleTime: 800,
});

onUnauthorized.add(() => qc.removeQueries({ queryKey: ['bootstrap'] }));
// Sign out and Delete account (Contract 2): everything the account kept on this device goes, then the page starts over
onSignedOut.add(() => void clearLocalAccount(qc, { to: signedOutHome() }));
// the sheet's fallback offers "Start a new chat" when the body that threw is the assistant's
markAssistantBody((body) => isValidElement(body) && body.type === AssistantSheet);

outbox.attach(qc);
void wipeFinished.then(() => outbox.load()).then(() => outbox.replay(qc));
window.addEventListener('online', () => void outbox.replay(qc));
/**
 * Coming back to the app (critic C1): push what was written offline, then one request, the bootstrap. The dated data (months,
 * to-dos, the daily pair, journal, reads and the pick) is refetched only when that answer differs from what was cached (the
 * cached object keeps its identity when nothing changed) or when it has gone unrefreshed for five minutes. No blind second
 * wave. In a build with the run connection, and connected per the CACHED bootstrap, its sync starts in this same handler,
 * synchronously and in parallel with the bootstrap (docs/feel.md §12), through stravaSyncNow so the open face's status
 * line sees it on the first frame; the server joins a sync already running, and the months are refetched only when a run
 * arrived.
 */
const FRESH_MS = 5 * 60_000;
const DATED = new Set(['month', 'todos', 'daily', 'journal', 'reads', 'reads-pick', 'activities']);
const syncIfConnected = () => {
  // only in a build that has the connection at all (lib/features.ts): otherwise this line and what it calls are not in the bundle
  if (STRAVA_BUILT && qc.getQueryData<Bootstrap>(['bootstrap'])?.strava?.connected) void stravaSyncNow(qc).catch(() => undefined);
  // Apple Health: only for a signed-in account, and the engine checks on the phone whether it is connected (lib/healthSync.ts)
  void healthSyncNow(qc, 'open').catch(() => undefined);
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
// ask the browser to keep this app's storage (the saved copy, the outbox) through storage pressure (gap-ios-24)
void navigator.storage?.persist?.().catch(() => false);
// the service worker waits for the first screen (lib/sw.ts, called from App); a signed-out open gets it after a while
setTimeout(startServiceWorker, 8000);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* the last line of defence: an error outside a page or a sheet (the dock, the nav bar, a sign-in screen, a provider)
        shows a full-screen way out instead of a blank app */}
    <ErrorBoundary scope="app">
      <PersistQueryClientProvider
        client={qc}
        persistOptions={{ persister, maxAge: 1000 * 60 * 60 * 24 * 14, buster: 'v2', dehydrateOptions: { shouldDehydrateQuery: keepOnDevice } }}
        onSuccess={() => {
          // a saved bootstrap in a shape this build cannot draw is dropped before anything renders from it
          const saved = qc.getQueryData(['bootstrap']);
          if (saved !== undefined && !isBootstrap(saved)) qc.removeQueries({ queryKey: ['bootstrap'] });
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
                  <BrandSplash />
                </ContextMenuProvider>
              </ToastProvider>
            </NavController>
          </BrowserRouter>
        </MotionConfig>
      </PersistQueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
);
