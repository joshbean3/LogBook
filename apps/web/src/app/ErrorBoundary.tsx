import { del } from 'idb-keyval';
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { hideSplash } from '@/lib/native';
import { sweepStorage } from '@/lib/account';
import { reportError } from '@/lib/errorReport';
import { DEV_TOOLS } from '@/lib/features';

const CHUNK_RE = /Failed to fetch dynamically imported module|Importing a module script failed|Loading chunk|ChunkLoadError|error loading dynamically imported module/i;

/** Where the query cache is kept on the device (main.tsx persists it; unsent writes live in the outbox, apart). */
export const CACHE_KEY = 'logbook.cache.v1';

/**
 * The assistant's boundary fires this when the person picks "Start a new chat" (Contract 2): the assistant drops its
 * current chat when it hears it, so a saved turn in a bad shape cannot lock the sheet.
 */
export const ASSISTANT_RESET = 'logbook:assistant-reset';

/** However the saved copy's removal is doing, the reload follows after this long. */
const RELOAD_WAIT_MS = 1500;
/**
 * Reload from the server: the saved copy goes first, so data in an old shape cannot bring the same crash back. The
 * reload itself never depends on that: where the phone's database cannot be opened (it throws at once in a private
 * window) or never answers, the page reloads all the same, so Reload and Try again always do something.
 */
export const reloadFresh = () => {
  let done = false;
  const reload = () => {
    if (done) return;
    done = true;
    location.reload();
  };
  setTimeout(reload, RELOAD_WAIT_MS);
  try {
    void del(CACHE_KEY).catch(() => undefined).finally(reload);
  } catch {
    reload();
  }
};

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
  /** Page scope: a quiet way out beside Reload ("Go to Today" on a tab, "Back" on a pushed page). */
  secondary?: { label: string; onPress: () => void };
  /** Page scope: a bar drawn above the fallback (a pushed page's chevron, so the page can be left as usual). */
  bar?: ReactNode;
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
    const { onClose, secondary, bar } = this.props;
    const newChat = () => {
      window.dispatchEvent(new CustomEvent(ASSISTANT_RESET));
      this.retry();
    };
    return (
      <div className="eb" data-scope={scope} data-bar={bar ? '' : undefined} role="alert">
        {bar ? <div className="eb-bar">{bar}</div> : null}
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
          {scope === 'page' && secondary ? (
            <button
              type="button"
              className="btn quiet"
              onClick={() => {
                this.retry();
                secondary.onPress();
              }}
            >
              {secondary.label}
            </button>
          ) : null}
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

/**
 * One section of a page (a card on Today, a poster, a chart, a list): when it throws while it draws, only that section
 * is replaced, by one calm line and Try again. The rest of the page, the dock and the tab bar carry on, so one broken
 * card never blanks a tab (the page's own boundary stays behind it for anything outside a section).
 *
 * - Healthy, it adds nothing to the page: no element, no style.
 * - The error is reported the way every boundary reports (Contract 7), with the section's name.
 * - Try again draws the section again in place. Only if that very draw fails too does the next Try again reload from
 *   the server with the saved copy dropped (as Reload does), so data in a shape this build cannot draw does not bring
 *   the same failure back. A retry that worked is forgotten: a later failure gets its own in-place Try again, and the
 *   page (and anything being typed on it) is never reloaded while drawing again can still help.
 * - `name` is for the report and the tests ("today.habits"): never shown.
 */
interface SectionProps {
  name: string;
  /** When this changes (Today's day), a section that broke is drawn again: another day starts clean. */
  resetKey?: string;
  children: ReactNode;
}
interface SectionState {
  error: Error | null;
  /** The reset key the section was last drawn under. */
  at?: string;
}
export class SectionBoundary extends Component<SectionProps, SectionState> {
  state: SectionState = { error: null };
  static getDerivedStateFromProps(props: SectionProps, state: SectionState): Partial<SectionState> | null {
    if (state.at === props.resetKey) return null;
    return { error: null, at: props.resetKey };
  }
  /** Try again was pressed and its draw has not come through yet. */
  private retrying = false;
  /** The draw that Try again asked for failed as well: drawing again will not help. */
  private stuck = false;
  static getDerivedStateFromError(error: Error): { error: Error } {
    return { error };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack);
    reportError(error, `section: ${this.props.name}${info.componentStack ? `\ncomponent stack:${info.componentStack}` : ''}`);
    hideSplash();
    if (this.retrying) this.stuck = true;
    this.retrying = false;
    if (CHUNK_RE.test(error.message)) reloadOnce();
  }
  componentDidUpdate(_: SectionProps, prev: SectionState) {
    // the section drew again after Try again: that failure is over
    if (prev.error && !this.state.error) this.retrying = false;
  }
  retry = () => {
    if (this.stuck) return reloadFresh();
    this.retrying = true;
    this.setState({ error: null });
  };
  render() {
    if (!this.state.error)
      return DEV_TOOLS ? (
        <>
          <SectionTripwire name={this.props.name} />
          {this.props.children}
        </>
      ) : (
        this.props.children
      );
    return (
      <div className="eb-sec" role="alert" data-section={this.props.name}>
        <p className="eb-sec-line">This part hit a snag.</p>
        <button type="button" className="btn quiet sm" onClick={this.retry}>
          Try again
        </button>
      </div>
    );
  }
}

/**
 * The dev server and test builds only (never a release build: `DEV_TOOLS` is a build constant): `window.__breakSections`,
 * a list of section names (or `'*'`), makes those sections throw as they draw, so the edge-case scripts can see that one
 * broken section leaves the rest of its page working. Fire `logbook:break-sections` after changing the list.
 */
const BREAK_EVENT = 'logbook:break-sections';
const broken = (name: string): boolean => {
  const list = (window as unknown as { __breakSections?: unknown }).__breakSections;
  return Array.isArray(list) && (list.includes(name) || list.includes('*'));
};
class SectionTripwire extends Component<{ name: string }> {
  private onBreak = () => this.forceUpdate();
  componentDidMount() {
    window.addEventListener(BREAK_EVENT, this.onBreak);
  }
  componentWillUnmount() {
    window.removeEventListener(BREAK_EVENT, this.onBreak);
  }
  render(): ReactNode {
    if (typeof window !== 'undefined' && broken(this.props.name)) throw new Error(`Section ${this.props.name} was broken on purpose`);
    return null;
  }
}

const KEY = 'logbook.reloaded-at';
/**
 * Reload once for a stale build's missing chunk. Whether it already did is kept for the tab (sessionStorage); where that
 * cannot be read or written, it cannot know, and it does not reload at all: the fallback's own Reload is the way on,
 * rather than a page that reloads itself for ever.
 */
export const reloadOnce = () => {
  try {
    const last = Number(sessionStorage.getItem(KEY) ?? 0);
    if (Date.now() - last < 20_000) return;
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    return;
  }
  location.reload();
};

/** `lazy()` import that survives a deploy mid-session. */
export const lazyImport = <T,>(fn: () => Promise<T>): (() => Promise<T>) => () =>
  fn().catch((e: Error) => {
    if (CHUNK_RE.test(e.message)) reloadOnce();
    throw e;
  });
