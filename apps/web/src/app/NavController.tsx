import type * as React from 'react';
import { createContext, createRef, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode, type RefObject } from 'react';
import { flushSync } from 'react-dom';
import { today as todayISO } from '@logbook/shared';
import { useLocation } from 'react-router';
import { entryFor, impliesRoot, matchRoute, NAV_EVENT, resolveRoute, tabDef, TABS, type NavEventDetail, type NavState, type PushedEntry, type RouteMatch, type TabId, type TabState } from '@/ui/nav';

/**
 * NavController (docs/feel.md §1.3, contracts §A.2): the one owner of NavState and the only caller of history.pushState /
 * replaceState / back() / go(). Its own bookkeeping lives in history.state.nav = { idx, overlay?, dead? }; pushState writes
 * { nav } only, replaceState spreads the current state. `popstate` is a request resolved against NavState, never a truth.
 * Rendered by main.tsx under BrowserRouter and above the toast, menu and sheet providers. Dormant on full-screen routes.
 */

export interface NavApi {
  /** The current state (a snapshot; subscribe with useNavState). */
  getState(): NavState;
  /** Tab bar tap on another tab: a 0 ms cut, one history entry (§9.1). */
  activate(tab: TabId): void;
  /** The lit tab tapped again: pop all → go home → scroll to top → nothing (§1.3 table). */
  reselect(tab: TabId): void;
  /** Push a 'pushed' route onto the ACTIVE tab's stack (throws in dev, no-op in prod, for anything else; use `go`). */
  push(path: string, opts?: { shared?: string }): void;
  /** Pop the top of the active stack (chevron, edge swipe). No-op at root. */
  pop(): void;
  /** Pop every layer of the active stack with one spring. */
  popAll(): void;
  /** Mirror root page state into the URL. Belongs to the CALLER's tab; writes history only when that tab is active and uncovered. */
  replace(path: string): void;
  /** Jump to any framed-app URL (§1.3 "Jump"). A full-screen path is a no-op. */
  go(path: string, opts?: { adopt?: 'push' | 'replace' }): void;
  /** Sheets and menus only: one overlay history entry; the returned function releases it. */
  openOverlay(onBack: () => void): () => void;
}

type RootCb = (params: Readonly<Record<string, string>>, how: { cut: boolean }) => void;
interface HomeControl {
  atHome: boolean;
  goHome: () => void;
}
/** What a mounted PushedLayer gives the controller: its exit, on the pop spring (or a crossfade), then `done`. */
export interface LayerControl {
  leave: (done: () => void) => void;
}
interface Overlay {
  id: number;
  idx: number;
  onBack: () => void;
  closed: boolean;
}
type Op = { kind: 'push' | 'replace'; path: string; idx: number; overlay?: boolean } | { kind: 'traverse'; n: number } | { kind: 'foreign'; push: boolean; data: unknown; url?: string | URL | null };

const ROOTS: Record<TabId, string> = { today: '/today', plan: '/plan', progress: '/progress', journal: '/journal' };
const STACKS_KEY = 'logbook.stacks';
const STALE_MS = 30 * 60_000;
const TRAVERSE_CAP_MS = 300;

const navOf = (): { idx?: number; overlay?: boolean } | undefined => (window.history.state as { nav?: { idx?: number; overlay?: boolean } } | null)?.nav;
const emptyTabs = (): Record<TabId, TabState> => ({
  today: { path: ROOTS.today, stack: [] },
  plan: { path: ROOTS.plan, stack: [] },
  progress: { path: ROOTS.progress, stack: [] },
  journal: { path: ROOTS.journal, stack: [] },
});
const topPath = (t: TabState) => t.stack[t.stack.length - 1]?.path ?? t.path;
const sameRoute = (a: PushedEntry, b: PushedEntry) => a.depth === b.depth && matchRoute(a.path).route === matchRoute(b.path).route;
const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const dev = import.meta.env.DEV;

export class Controller {
  constructor() {
    this.hookHistory();
  }
  state: NavState = { active: 'today', tabs: emptyTabs(), overlays: 0 };
  dormant = true;
  /** The nav.idx of the entry last written or landed on (predicted while a traversal is pending). */
  cur = 0;
  private listeners = new Set<() => void>();
  private overlays: Overlay[] = [];
  private overlaySeq = 0;
  private dead = new Set<number>();
  private pending: { timer: ReturnType<typeof setTimeout> } | null = null;
  private queue: Op[] = [];
  private rootSubs: Record<TabId, Set<{ current: RootCb }>> = { today: new Set(), plan: new Set(), progress: new Set(), journal: new Set() };
  private home: Record<TabId, { current: HomeControl } | null> = { today: null, plan: null, progress: null, journal: null };
  /** Each tab's `.tab-scroll` (the Shell attaches them). */
  readonly scrollers: Record<TabId, RefObject<HTMLDivElement | null>> = { today: createRef(), plan: createRef(), progress: createRef(), journal: createRef() };
  private layers = new Map<string, LayerControl>();
  /** Keys of layers that slide in (a push); every other layer mounts at rest. */
  private slideIn = new Set<string>();

  // ---------- the store ----------
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => void this.listeners.delete(fn);
  };
  getState = () => this.state;
  private set(next: NavState) {
    this.state = next;
    for (const f of this.listeners) f();
    try {
      sessionStorage.setItem(STACKS_KEY, JSON.stringify({ at: Date.now(), active: next.active, tabs: next.tabs }));
    } catch {
      /* private mode */
    }
  }
  private setTab(tab: TabId, t: Partial<TabState>, extra: Partial<NavState> = {}) {
    this.set({ ...this.state, ...extra, tabs: { ...this.state.tabs, [tab]: { ...this.state.tabs[tab], ...t } } });
  }
  private emit(type: NavEventDetail['type'], path: string, tab: TabId) {
    window.dispatchEvent(new CustomEvent<NavEventDetail>(NAV_EVENT, { detail: { type, path, tab } }));
  }

  // ---------- the write queue ----------
  private native: { push: History['pushState']; replace: History['replaceState'] } | null = null;
  private writing = false;
  /**
   * react-router (the old pages, until WP6 lands) writes history itself. A write it makes while one of our traversals is
   * pending would be overtaken by that traversal (history.back() is only queued), so it waits in the same queue and runs, in
   * order, after the popstate; the bridge's adopt that follows it is queued behind it.
   */
  private hookHistory() {
    if (typeof window === 'undefined' || this.native) return;
    const h = window.history;
    const native = { push: h.pushState.bind(h), replace: h.replaceState.bind(h) };
    this.native = native;
    const foreign = (push: boolean, data: unknown, unused: string, url?: string | URL | null) => {
      if (this.writing || this.dormant) return push ? native.push(data, unused, url) : native.replace(data, unused, url);
      this.queue.push({ kind: 'foreign', push, data, url });
      this.flush();
    };
    h.pushState = (data: unknown, unused: string, url?: string | URL | null) => foreign(true, data, unused, url);
    h.replaceState = (data: unknown, unused: string, url?: string | URL | null) => foreign(false, data, unused, url);
  }
  /** Set by RouterBridge while old pages still call react-router: how a foreign write is adopted (nav.go with `adopt`). */
  private adopter: ((path: string, how: 'push' | 'replace') => void) | null = null;
  setAdopter(fn: ((path: string, how: 'push' | 'replace') => void) | null) {
    this.adopter = fn;
  }
  private run(fn: () => void) {
    this.writing = true;
    try {
      fn();
    } finally {
      this.writing = false;
    }
  }
  /** Enqueue a history write; `cur` moves at once (the prediction), the write itself waits behind a pending traversal. */
  private write(kind: 'push' | 'replace', path: string, opts: { overlay?: boolean; idx?: number } = {}) {
    if (kind === 'push') this.cur += 1;
    else if (opts.idx !== undefined) this.cur = opts.idx;
    this.queue.push({ kind, path, idx: this.cur, overlay: opts.overlay });
    this.flush();
  }
  private traverse(n: number) {
    this.cur -= n;
    this.queue.push({ kind: 'traverse', n });
    this.flush();
  }
  private flush() {
    while (this.queue.length && !this.pending) {
      const op = this.queue.shift()!;
      if (op.kind === 'traverse') {
        this.pending = { timer: setTimeout(() => this.settleTraversal(), TRAVERSE_CAP_MS) };
        this.run(() => window.history.go(-op.n));
        return;
      }
      if (op.kind === 'foreign') {
        this.run(() => (op.push ? window.history.pushState(op.data, '', op.url) : window.history.replaceState(op.data, '', op.url)));
        // the entry react-router just wrote is adopted (re-stamped), in a microtask: go uses flushSync
        const adopt = this.adopter;
        if (adopt && op.url != null) {
          const u = new URL(String(op.url), window.location.href);
          const how = op.push ? 'push' : 'replace';
          queueMicrotask(() => adopt(u.pathname + u.search, how));
        }
        continue;
      }
      const nav = { idx: op.idx, ...(op.overlay ? { overlay: true } : {}) };
      this.run(() => {
        if (op.kind === 'push') window.history.pushState({ nav }, '', op.path);
        else window.history.replaceState({ ...(window.history.state ?? {}), nav }, '', op.path);
      });
    }
  }
  /** The popstate that answers our own traversal (or the 300 ms cap): consumed, never a request. */
  private settleTraversal() {
    if (!this.pending) return;
    clearTimeout(this.pending.timer);
    this.pending = null;
    // nothing queued: land on what the browser says (a traversal past the first entry does nothing)
    const idx = navOf()?.idx;
    if (typeof idx === 'number' && !this.queue.length) this.cur = idx;
    this.flush();
  }

  // ---------- cold start, sleep and wake ----------
  /** Called on every render of NavController: sleep on a full-screen route, wake (a cold start) when the path leaves one. */
  sync() {
    const m = resolveRoute(window.location.pathname);
    if (m.kind === 'full') {
      this.dormant = true;
      return;
    }
    if (this.dormant) this.coldStart(m);
  }
  private coldStart(m: RouteMatch & { path: string }) {
    this.dormant = false;
    this.overlays = [];
    this.queue = [];
    if (this.pending) clearTimeout(this.pending.timer);
    this.pending = null;
    let rec: { at: number; active?: TabId; tabs?: Record<TabId, TabState> } | null = null;
    try {
      rec = JSON.parse(sessionStorage.getItem(STACKS_KEY) ?? 'null');
    } catch {
      rec = null;
    }
    const tabs = emptyTabs();
    // a reload keeps the other tabs where they were (their roots; their pushed pages are not rebuilt)
    if (rec?.tabs && Date.now() - rec.at <= STALE_MS)
      for (const t of TABS) {
        const p = rec.tabs[t.id]?.path;
        const r = p ? matchRoute(p) : null;
        if (r && r.kind === 'root' && r.tab === t.id) tabs[t.id].path = p!;
      }
    let path = m.path;
    let match: RouteMatch = m;
    // a cold start on /today/:date lands on /today only when this session's record exists and is older than 30 minutes
    if (m.kind === 'root' && m.tab === 'today' && m.params.date && rec && Date.now() - rec.at > STALE_MS) {
      path = '/today';
      match = matchRoute(path);
    }
    const tab = match.tab!;
    tabs[tab] = { path: impliesRoot(match) ? match.root : tabs[tab].path, stack: match.stack };
    const idx = navOf()?.idx;
    this.cur = typeof idx === 'number' ? idx : 0;
    this.set({ active: tab, tabs, overlays: 0 });
    this.run(() => window.history.replaceState({ ...(window.history.state ?? {}), nav: { idx: this.cur } }, '', path + (path === window.location.pathname ? window.location.search : '')));
  }

  // ---------- registries (Shell, PushedLayer, roots) ----------
  registerLayer(key: string, c: LayerControl) {
    this.layers.set(key, c);
    return () => {
      if (this.layers.get(key) === c) this.layers.delete(key);
    };
  }
  /** True once for a layer that was pushed (it slides in); false for one that mounts at rest. */
  takeSlideIn(key: string) {
    const v = this.slideIn.has(key);
    this.slideIn.delete(key);
    return v;
  }
  subscribeRoot(tab: TabId, cb: { current: RootCb }) {
    this.rootSubs[tab].add(cb);
    return () => void this.rootSubs[tab].delete(cb);
  }
  setHome(tab: TabId, c: { current: HomeControl } | null) {
    this.home[tab] = c;
  }
  private deliver(tab: TabId, rootPath: string, cut: boolean) {
    const params = matchRoute(rootPath).params;
    for (const s of this.rootSubs[tab]) s.current(params, { cut });
  }

  // ---------- overlays ----------
  openOverlay = (onBack: () => void) => {
    if (this.dormant) return () => {};
    this.write('push', topPath(this.state.tabs[this.state.active]), { overlay: true });
    const o: Overlay = { id: ++this.overlaySeq, idx: this.cur, onBack, closed: false };
    this.overlays.push(o);
    this.set({ ...this.state, overlays: this.state.overlays + 1 });
    this.emit('overlay', topPath(this.state.tabs[this.state.active]), this.state.active);
    return () => {
      if (o.closed) return;
      this.dropOverlay(o);
      // on top: walk back off its entry (consumed); else the entry is dead and nothing is written
      if (this.cur === o.idx) this.traverse(1);
      else this.dead.add(o.idx);
    };
  };
  private dropOverlay(o: Overlay) {
    o.closed = true;
    this.overlays = this.overlays.filter((x) => x !== o);
    this.set({ ...this.state, overlays: Math.max(0, this.state.overlays - 1) });
  }
  /** activate / push / go close every open overlay first (its onBack, no second history write), then write behind the release. */
  private closeOverlays() {
    if (!this.overlays.length) return;
    const open = [...this.overlays].reverse();
    let n = 0;
    let expect = this.cur;
    for (const o of open) {
      if (o.idx === expect) {
        n++;
        expect--;
      } else this.dead.add(o.idx);
      this.dropOverlay(o);
      o.onBack();
    }
    if (n) this.traverse(n);
  }

  // ---------- actions ----------
  activate = (tab: TabId): void => {
    if (this.dormant) return;
    this.closeOverlays();
    if (tab === this.state.active) return this.reselect(tab);
    flushSync(() => this.set({ ...this.state, active: tab }));
    this.write('push', topPath(this.state.tabs[tab]));
    this.emit('tab', topPath(this.state.tabs[tab]), tab);
  };

  reselect = (tab: TabId): void => {
    if (this.dormant) return;
    if (tab !== this.state.active) return this.activate(tab);
    const t = this.state.tabs[tab];
    if (t.stack.length) return this.popAll();
    const h = this.home[tab]?.current;
    if (h && !h.atHome) return h.goHome();
    // interim: a root that does not register a home control yet (the old pages) comes home by its URL
    if (!h && t.path !== ROOTS[tab]) {
      this.setTab(tab, { path: ROOTS[tab] });
      this.deliver(tab, ROOTS[tab], false);
      this.write('replace', ROOTS[tab]);
      this.emit('replace', ROOTS[tab], tab);
      return;
    }
    const el = this.scrollers[tab].current;
    if (el && el.scrollTop > 0) el.scrollTo({ top: 0, behavior: reducedMotion() ? 'auto' : 'smooth' });
  };

  push = (path: string, opts: { shared?: string } = {}): void => {
    if (this.dormant) return;
    const m = resolveRoute(path);
    const tab = this.state.active;
    const t = this.state.tabs[tab];
    const bad = (why: string) => {
      if (dev) throw new Error(`nav.push(${path}): ${why}`);
    };
    if (m.kind !== 'pushed' || m.tab !== tab) return bad('not a pushed route of the active tab (use nav.go)');
    const route = m.route!;
    const depth = route.depth ?? 1;
    const top = t.stack[t.stack.length - 1];
    if (depth === 2 && top?.depth === 2) return bad('a depth-2 layer is already on top (the stack never exceeds two layers)');
    // the layers under it must be the ones the stack has; otherwise it is a jump
    if (t.stack.length !== depth - 1 || (depth === 2 && !sameRoute(t.stack[0]!, m.stack[0]!))) return this.go(path);
    this.closeOverlays();
    const entry: PushedEntry = { ...entryFor(route, m.path, { ...m.params }), idx: this.cur + 1, shared: opts.shared };
    this.slideIn.add(entry.key);
    flushSync(() => this.setTab(tab, { stack: [...t.stack, entry] }));
    this.write('push', m.path);
    this.emit('push', m.path, tab);
  };

  pop = () => {
    if (this.dormant) return;
    const tab = this.state.active;
    const top = this.state.tabs[tab].stack.at(-1);
    if (!top) return;
    const c = this.layers.get(top.key);
    if (c) c.leave(() => this.finishPop(tab, top.key));
    else this.finishPop(tab, top.key);
  };

  /** The pop's last frame: unmount the layer, then the history rule (§1.3), same frame. Also the edge swipe's end. */
  finishPop = (tab: TabId, key: string, opts: { history?: boolean } = {}) => {
    const t = this.state.tabs[tab];
    const i = t.stack.findIndex((e) => e.key === key);
    if (i < 0) return;
    const entry = t.stack[i]!;
    const stack = t.stack.slice(0, i);
    flushSync(() => this.setTab(tab, { stack }));
    const parentPath = stack.at(-1)?.path ?? t.path;
    if (opts.history !== false && tab === this.state.active) {
      if (entry.idx !== -1 && this.cur === entry.idx && i === t.stack.length - 1) this.traverse(1);
      else this.write('replace', parentPath);
    }
    this.emit('pop', parentPath, tab);
  };

  popAll = (opts: { history?: boolean } = {}): void => {
    if (this.dormant) return;
    const tab = this.state.active;
    const stack = this.state.tabs[tab].stack;
    if (!stack.length) return;
    const top = stack.at(-1)!;
    let left = stack.length;
    const done = () => {
      if (--left > 0) return;
      const cur = this.state.tabs[tab];
      flushSync(() => this.setTab(tab, { stack: [] }));
      if (opts.history !== false && tab === this.state.active) {
        const n = stack.length;
        const consecutive = stack.every((e, k) => e.idx !== -1 && e.idx === stack[0]!.idx + k) && top.idx === this.cur;
        if (consecutive) this.traverse(n);
        else this.write('replace', cur.path);
      }
      this.emit('pop', cur.path, tab);
    };
    for (const e of stack) {
      const c = this.layers.get(e.key);
      if (c) c.leave(done);
      else done();
    }
  };

  replace = (path: string, tab: TabId = this.state.active) => {
    if (this.dormant) return;
    const m = resolveRoute(path);
    if (m.tab !== tab) {
      if (dev) console.warn(`nav.replace(${path}) from the ${tab} tab: not its route`);
      return;
    }
    const t = this.state.tabs[tab];
    if (m.kind === 'root') {
      if (t.path === m.path) return;
      this.setTab(tab, { path: m.path });
      if (tab === this.state.active && !t.stack.length) this.write('replace', m.path);
      this.emit('replace', m.path, tab);
      return;
    }
    // a pushed page mirroring its own state (Reads' segment): the top entry, in place
    const top = t.stack.at(-1);
    if (m.kind === 'pushed' && top && sameRoute(top, m.stack.at(-1)!)) {
      this.setTab(tab, { stack: [...t.stack.slice(0, -1), { ...top, path: m.path, params: { ...m.params } }] });
      if (tab === this.state.active) this.write('replace', m.path);
      this.emit('replace', m.path, tab);
    }
  };

  go = (path: string, opts: { adopt?: 'push' | 'replace'; fromPop?: boolean } = {}): void => {
    if (this.dormant) return;
    const m = resolveRoute(path);
    if (m.kind === 'full') return;
    if (!opts.fromPop) this.closeOverlays();
    const tab = m.tab!;
    const t = this.state.tabs[tab];
    let rootPath = impliesRoot(m) ? m.root : t.path;
    // '/today/<today>' is the same page as '/today': This morning of today keeps the root as it is
    if (tab === 'today' && t.path === '/today' && rootPath === `/today/${todayISO()}`) rootPath = '/today';
    const implied = m.stack;
    const keep: PushedEntry[] = [];
    for (let i = 0; i < implied.length; i++) {
      const have = t.stack[i];
      if (!have || !sameRoute(have, implied[i]!)) break;
      keep.push(have.path === implied[i]!.path ? have : { ...have, path: implied[i]!.path, params: implied[i]!.params, title: implied[i]!.title });
    }
    const removed = t.stack.slice(keep.length);
    const added = implied.slice(keep.length).map((e) => ({ ...e }));
    const rootChanged = rootPath !== t.path;
    const cut = tab !== this.state.active;
    const search = path.includes('?') ? path.slice(path.indexOf('?')) : '';
    const adoptIdx = opts.adopt === 'push' ? this.cur + 1 : this.cur;

    if (cut) {
      const stack = [...keep, ...added];
      flushSync(() => {
        this.set({ ...this.state, active: tab, tabs: { ...this.state.tabs, [tab]: { path: rootPath, stack } } });
        // every request that names the root's params reaches the mounted root, once (it sets its state in this flush)
        if (impliesRoot(m)) this.deliver(tab, rootPath, true);
      });
      const final = (stack.at(-1)?.path ?? rootPath) + search;
      if (opts.fromPop) this.write('replace', final);
      else if (opts.adopt) this.write('replace', final, { idx: adoptIdx });
      else this.write('push', final);
      this.emit('jump', final, tab);
      return;
    }

    // the active tab: the root's own motion, layers popped or pushed on their springs
    if (rootChanged) this.setTab(tab, { path: rootPath });
    if (impliesRoot(m)) this.deliver(tab, rootPath, false);
    if (removed.length && !added.length) {
      // pop down to the depth the URL implies (the pop spring), with no traversal: the final write below says where we are
      if (keep.some((e, i) => e !== t.stack[i])) this.setTab(tab, { stack: [...keep, ...removed] });
      const gone = new Set(removed.map((e) => e.key));
      let left = removed.length;
      const done = () => {
        if (--left > 0) return;
        flushSync(() => this.setTab(tab, { stack: this.state.tabs[tab].stack.filter((e) => !gone.has(e.key)) }));
      };
      for (const e of removed) {
        const c = this.layers.get(e.key);
        if (c) c.leave(done);
        else done();
      }
    } else {
      // added layers slide in; anything replaced goes at once
      if (opts.adopt) added.forEach((e) => (e.idx = added.length === 1 ? adoptIdx : -1));
      else if (!opts.fromPop) added.forEach((e, i) => (e.idx = this.cur + 1 + i));
      if (!opts.fromPop) for (const e of added) this.slideIn.add(e.key);
      flushSync(() => this.setTab(tab, { stack: [...keep, ...added] }));
    }
    const final = (added.at(-1)?.path ?? keep.at(-1)?.path ?? rootPath) + search;
    if (opts.fromPop) this.write('replace', final);
    else if (opts.adopt) this.write('replace', final, { idx: adoptIdx });
    else if (added.length) {
      if (rootChanged || removed.length) this.write('replace', keep.at(-1)?.path ?? rootPath);
      for (const e of added) this.write('push', e.path + (e === added.at(-1) ? search : ''));
    } else this.write('replace', final);
    this.emit('jump', final, tab);
  };

  // ---------- popstate: a request ----------
  onPopState = (): void => {
    if (this.dormant) return;
    if (this.pending) return this.settleTraversal();
    const nav = navOf();
    const landed = typeof nav?.idx === 'number' ? nav.idx : null;
    // an open overlay closes first: Back left its entry
    const top = this.overlays.at(-1);
    if (top) {
      this.dropOverlay(top);
      this.cur = landed ?? this.cur - 1;
      top.onBack();
      return;
    }
    if (landed !== null) this.cur = landed;
    const m = resolveRoute(window.location.pathname);
    if (m.kind === 'full') return;
    const tab = this.state.active;
    const t = this.state.tabs[tab];
    if (m.tab === tab) {
      const i = t.stack.findIndex((e) => e.path === m.path);
      if (i >= 0 && i < t.stack.length - 1) return this.popDownTo(tab, i);
      if (i === t.stack.length - 1 && i >= 0) return this.write('replace', m.path);
      if (m.kind === 'root' && m.path === t.path) {
        if (t.stack.length) this.popAll({ history: false });
        this.write('replace', t.path);
        return;
      }
    }
    this.go(m.path, { fromPop: true });
  };
  private popDownTo(tab: TabId, i: number) {
    const t = this.state.tabs[tab];
    const removed = t.stack.slice(i + 1);
    let left = removed.length;
    const done = () => {
      if (--left > 0) return;
      flushSync(() => this.setTab(tab, { stack: this.state.tabs[tab].stack.slice(0, i + 1) }));
      this.emit('pop', t.stack[i]!.path, tab);
    };
    for (const e of removed) {
      const c = this.layers.get(e.key);
      if (c) c.leave(done);
      else done();
    }
    this.write('replace', t.stack[i]!.path);
  }

  /** True when a popstate lands on an overlay entry released while not on top. */
  isDead(idx: number) {
    return this.dead.has(idx);
  }
}

// ---------- React ----------
const Ctx = createContext<Controller | null>(null);
const TabCtx = createContext<TabId | null>(null);
const EntryCtx = createContext<PushedEntry | null>(null);

/** Reads react-router's useLocation() only to sleep on and wake from kind 'full' routes; window.location for everything else. */
export const NavController = ({ children }: { children: ReactNode }): React.JSX.Element => {
  const [ctl] = useState(() => new Controller());
  const loc = useLocation();
  // sleep on a full-screen route, wake with a cold start when the path leaves one (the Welcome hand-off, a login)
  ctl.sync();
  void loc.key;
  useEffect(() => {
    const f = () => ctl.onPopState();
    window.addEventListener('popstate', f);
    return () => window.removeEventListener('popstate', f);
  }, [ctl]);
  useEffect(() => {
    if (import.meta.env.DEV || import.meta.env.VITE_FAKE_CLOCK) (window as unknown as { __nav?: Controller }).__nav = ctl;
  }, [ctl]);
  return <Ctx.Provider value={ctl}>{children}</Ctx.Provider>;
};

/** The controller itself: Shell, PushedLayer, the providers. Not for feature code (use useNav). */
export const useNavInternal = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error('useNav outside NavController (main.tsx renders it under BrowserRouter)');
  return c;
};

/** The nav API, bound to the caller's tab for `replace`. Throws outside NavController. */
export const useNav = (): NavApi => {
  const ctl = useNavInternal();
  const tab = useContext(TabCtx);
  return useMemo<NavApi>(
    () => ({
      getState: ctl.getState,
      activate: ctl.activate,
      reselect: ctl.reselect,
      push: ctl.push,
      pop: ctl.pop,
      popAll: () => ctl.popAll(),
      replace: (p) => ctl.replace(p, tab ?? ctl.state.active),
      go: (p, o) => ctl.go(p, o),
      openOverlay: ctl.openOverlay,
    }),
    [ctl, tab],
  );
};
/** Re-renders on every NavState change. */
export const useNavState = (): NavState => {
  const ctl = useNavInternal();
  return useSyncExternalStore(ctl.subscribe, ctl.getState, ctl.getState);
};

/** Provides the tab for everything under it (the Shell per tab; SheetProvider and ContextMenuProvider per panel). */
export const TabScope = ({ tab, children }: { tab: TabId; children: ReactNode }): React.JSX.Element => <TabCtx.Provider value={tab}>{children}</TabCtx.Provider>;
/** The tab, or null outside any TabScope (Welcome, the providers' own chrome). */
export const useTabOrNull = () => useContext(TabCtx);
/** The tab the calling component is rendered in. Throws outside a TabScope in dev; 'today' in prod. */
export const useTab = (): TabId => {
  const t = useContext(TabCtx);
  if (!t) {
    if (dev) throw new Error('useTab outside a TabScope');
    return 'today';
  }
  return t;
};
export const useIsActiveTab = (): boolean => {
  const tab = useTab();
  return useNavState().active === tab;
};
/** The CALLER's tab's `.tab-scroll` element. */
export const useTabScroller = (): RefObject<HTMLDivElement | null> => {
  const ctl = useNavInternal();
  return ctl.scrollers[useTab()];
};
/** The PushedEntry the caller is inside, or null on a root. */
export const usePushedEntry = (): PushedEntry | null => useContext(EntryCtx);
/** Provided by the Shell around each pushed layer's content. */
export const PushedEntryScope = ({ entry, children }: { entry: PushedEntry; children: ReactNode }): React.JSX.Element => <EntryCtx.Provider value={entry}>{children}</EntryCtx.Provider>;
/** Params of the route the caller renders: fixed for pushed entries, read once at mount for roots (from TabState.path). */
export const useRouteParams = (): Readonly<Record<string, string>> => {
  const ctl = useNavInternal();
  const entry = useContext(EntryCtx);
  const tab = useContext(TabCtx) ?? ctl.state.active;
  const [rootParams] = useState(() => matchRoute(ctl.state.tabs[tab].path).params);
  return entry ? entry.params : rootParams;
};
/** A mounted tab root subscribes to later requests to show other params (a jump, a deep link, Back onto another date). */
export const useRootRequest = (cb: (params: Readonly<Record<string, string>>, how: { cut: boolean }) => void): void => {
  const ctl = useNavInternal();
  const tab = useTab();
  const ref = useRef(cb);
  ref.current = cb;
  useLayoutEffect(() => ctl.subscribeRoot(tab, ref), [ctl, tab]);
};
/** A tab root registers how `reselect` treats it: atHome false → goHome(); true → scroll to top, or nothing at top. */
export const useHomeControl = (c: { atHome: boolean; goHome: () => void }): void => {
  const ctl = useNavInternal();
  const tab = useTab();
  const ref = useRef(c);
  ref.current = c;
  useLayoutEffect(() => {
    ctl.setHome(tab, ref);
    return () => ctl.setHome(tab, null);
  }, [ctl, tab]);
};

export { tabDef };
