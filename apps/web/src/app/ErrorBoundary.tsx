import { del } from 'idb-keyval';
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { hideSplash } from '@/lib/native';
import { sweepStorage } from '@/lib/account';
import { reportError } from '@/lib/errorReport';

const CHUNK_RE = /Failed to fetch dynamically imported module|Importing a module script failed|Loading chunk|ChunkLoadError|error loading dynamically imported module/i;

/** Where the query cache is kept on the device (main.tsx persists it; unsent writes live in the outbox, apart). */
export const CACHE_KEY = 'logbook.cache.v1';

/**
 * The assistant's boundary fires this when the person picks "Start a new chat" (Contract 2): the assistant drops its
 * current chat when it hears it, so a saved turn in a bad shape cannot lock the sheet.
 */
export const ASSISTANT_RESET = 'logbook:assistant-reset';

/** Reload from the server: the saved copy goes first, so data in an old shape cannot bring the same crash back. */
const reloadFresh = () => void del(CACHE_KEY).catch(() => undefined).finally(() => location.reload());

/** When the whole app last fell over in this tab: a second time soon after offers a deeper reset. */
const CRASH_KEY = 'logbook-crashed-at';
const REPEAT_MS = 5 * 60_000;
const crashedLately = (): boolean => {
  try {
    const last = Number(sessionStorage.getItem(CRASH_KEY) ?? 0);
    sessionStorage.setItem(CRASH_KEY, String(Date.now()));
    return last > 0 && Date.now() - last < REPEAT_MS;
  } catch {
    return false;
  }
};
/**
 * The way out of a crash that survives Reload: what this phone saved outside the account (chats, drafts, view choices) is
 * cleared along with the cached copy. Changes still waiting to sync are kept, and so is the sign-in.
 */
const resetSaved = () => {
  sweepStorage();
  reloadFresh();
};

/**
 * Where a boundary sits decides what its fallback offers:
 * - `app`: around the whole tree (main.tsx). A full screen, clear of the notch and the home bar, with Reload.
 * - `page`: a tab root, a pushed page, first run. Fills the page it replaces.
 * - `sheet`: a sheet's panel body. The sheet's own Close still works; the fallback adds Reload and Close.
 * - `assistant`: the assistant's sheet. "Start a new chat" fires ASSISTANT_RESET and draws the sheet again.
 */
export type BoundaryScope = 'app' | 'page' | 'sheet' | 'assistant';
interface Props {
  children: ReactNode;
  scope?: BoundaryScope;
  /** Sheet scopes: close the sheet. */
  onClose?: () => void;
  /** Told once per caught error (the menu closes itself and says so). */
  onCatch?: (error: Error) => void;
  /** Draw nothing in place of the broken part (the menu: it is closed by onCatch). */
  silent?: boolean;
}
interface State {
  error: Error | null;
  repeat: boolean;
}

/** Reloads once when a stale build's chunk is missing (after a deploy); otherwise shows a way out. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, repeat: false };
  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack);
    // one report per failure (Contract 7); a sheet's or the menu's boundary reports the same way as the root's
    reportError(error, info.componentStack ? `component stack:${info.componentStack}` : '');
    // the native splash must never sit over a fallback
    hideSplash();
    if (CHUNK_RE.test(error.message)) reloadOnce();
    if ((this.props.scope ?? 'page') === 'app' && crashedLately()) this.setState({ repeat: true });
    this.props.onCatch?.(error);
  }
  /** Draw the children again (after the cause was cleared). */
  retry = () => this.setState({ error: null });
  render() {
    const { error, repeat } = this.state;
    if (!error) return this.props.children;
    if (this.props.silent) return null;
    const scope = this.props.scope ?? 'page';
    const { onClose } = this.props;
    const newChat = () => {
      window.dispatchEvent(new CustomEvent(ASSISTANT_RESET));
      this.retry();
    };
    return (
      <div className="eb" data-scope={scope} role="alert">
        <p className="eb-title">{scope === 'assistant' ? 'This chat hit a snag' : 'This screen hit a snag'}</p>
        <p className="eb-body">{scope === 'assistant' ? 'Your data is safe. Start a new chat to keep going.' : 'Your data is safe. Reload to try again.'}</p>
        <div className="eb-actions">
          {scope === 'assistant' ? (
            <button type="button" className="btn primary" onClick={newChat}>
              Start a new chat
            </button>
          ) : (
            <button type="button" className="btn primary" onClick={reloadFresh}>
              Reload
            </button>
          )}
          {(scope === 'sheet' || scope === 'assistant') && onClose ? (
            <button type="button" className="btn quiet" onClick={onClose}>
              Close
            </button>
          ) : null}
          {scope === 'app' && repeat ? (
            <button type="button" className="btn quiet" onClick={resetSaved}>
              Reset what this phone saved
            </button>
          ) : null}
        </div>
        {scope === 'app' && repeat ? <p className="eb-note">Reset clears chats, drafts and view settings kept on this phone. Your account and anything waiting to sync stay.</p> : null}
        <details className="eb-details">
          <summary>Details</summary>
          <p>{error.message || 'Unknown error'}</p>
        </details>
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
