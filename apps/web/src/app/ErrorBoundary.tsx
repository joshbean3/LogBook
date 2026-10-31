import { del } from 'idb-keyval';
import { Component, type ErrorInfo, type ReactNode } from 'react';

const CHUNK_RE = /Failed to fetch dynamically imported module|Importing a module script failed|Loading chunk|ChunkLoadError|error loading dynamically imported module/i;

/** Where the query cache is kept on the device (main.tsx persists it; unsent writes live in the outbox, apart). */
export const CACHE_KEY = 'logbook.cache.v1';

/** Reload from the server: the saved copy goes first, so data in an old shape cannot bring the same crash back. */
const reloadFresh = () => void del(CACHE_KEY).catch(() => undefined).finally(() => location.reload());

/** Reloads once when a stale build's chunk is missing (after a deploy); otherwise shows a way out. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack);
    if (CHUNK_RE.test(error.message)) reloadOnce();
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="page" style={{ minHeight: '60dvh', alignContent: 'center' }}>
        <p className="empty">This screen hit a snag. Your data is safe.</p>
        <button type="button" className="btn primary" style={{ justifySelf: 'start' }} onClick={reloadFresh}>
          Reload
        </button>
        <p className="fine">{this.state.error.message}</p>
      </div>
    );
  }
}

const KEY = 'logbook.reloaded-at';
export const reloadOnce = () => {
  try {
    const last = Number(sessionStorage.getItem(KEY) ?? 0);
    if (Date.now() - last < 20_000) return;
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
  location.reload();
};

/** `lazy()` import that survives a deploy mid-session. */
export const lazyImport = <T,>(fn: () => Promise<T>): (() => Promise<T>) => () =>
  fn().catch((e: Error) => {
    if (CHUNK_RE.test(e.message)) reloadOnce();
    throw e;
  });
