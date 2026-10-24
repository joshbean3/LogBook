import { Activity, BookOpen, CalendarDays, Sun, type LucideIcon } from 'lucide-react';

/**
 * The navigation model (docs/feel.md §1, contracts §A.1): four tabs, the route table, and `matchRoute`, which turns a URL into
 * the tab it lights, the root page it shows and the pushed pages stacked over it. NavController is the only reader that acts
 * on it; everything else asks the controller.
 */
export type TabId = 'today' | 'plan' | 'progress' | 'journal';

export interface TabDef {
  id: TabId;
  /** The tab root: where a lit-tab tap at the top of the page comes home to. */
  root: string;
  label: string;
  icon: LucideIcon;
}
/** Four, in this order. Icons: Sun · CalendarDays · Activity · BookOpen (§1.1). */
export const TABS: readonly TabDef[] = [
  { id: 'today', root: '/today', label: 'Today', icon: Sun },
  { id: 'plan', root: '/plan', label: 'Plan', icon: CalendarDays },
  { id: 'progress', root: '/progress', label: 'Progress', icon: Activity },
  { id: 'journal', root: '/journal', label: 'Journal', icon: BookOpen },
];
export const tabDef = (id: TabId): TabDef => TABS.find((t) => t.id === id)!;

export type RouteKind = 'root' | 'pushed' | 'full' | 'redirect';
export interface RouteDef {
  /** path-to-regexp style, e.g. '/today/:date?', '/today/:date/morning', '/settings/:section' */
  pattern: string;
  /** The tab that is lit; null for 'full' and 'redirect'. */
  owner: TabId | null;
  kind: RouteKind;
  /** Pushed only. */
  depth?: 1 | 2;
  /** The pushed bar's title (§2.6); a function when it depends on params. */
  title?: string | ((params: Readonly<Record<string, string>>) => string);
  /** Redirect only: the destination; ':x' params are substituted (a missing optional one is dropped with its slash). */
  to?: string;
}

export const SETTINGS_SECTIONS = ['you', 'training', 'habits', 'plans', 'connections', 'app', 'data', 'account'] as const;
export type SettingsSection = (typeof SETTINGS_SECTIONS)[number];
const SECTION_TITLE: Record<SettingsSection, string> = { you: 'You', training: 'Training', habits: 'Habits', plans: 'Plans', connections: 'Connections', app: 'App', data: 'Data', account: 'Account' };

/** The whole table of §1.2: roots, pushed pages, full screens and redirects, in match order. */
export const ROUTES: readonly RouteDef[] = [
  { pattern: '/today/:date?', owner: 'today', kind: 'root' },
  { pattern: '/today/:date/morning', owner: 'today', kind: 'pushed', depth: 1, title: 'This morning' },
  { pattern: '/settings', owner: 'today', kind: 'pushed', depth: 1, title: 'Settings' },
  { pattern: '/settings/:section', owner: 'today', kind: 'pushed', depth: 2, title: (p) => SECTION_TITLE[p.section as SettingsSection] ?? 'Settings' },
  { pattern: '/dev/ui', owner: 'today', kind: 'pushed', depth: 1, title: 'UI' },
  { pattern: '/plan', owner: 'plan', kind: 'root' },
  { pattern: '/plan/week/:mon', owner: 'plan', kind: 'root' },
  { pattern: '/plan/month/:month', owner: 'plan', kind: 'root' },
  { pattern: '/progress', owner: 'progress', kind: 'root' },
  { pattern: '/journal', owner: 'journal', kind: 'root' },
  { pattern: '/journal/library', owner: 'journal', kind: 'root' },
  { pattern: '/journal/reads/:tab?', owner: 'journal', kind: 'pushed', depth: 1, title: 'Reads' },
  { pattern: '/welcome/*', owner: null, kind: 'full' },
  { pattern: '/start', owner: null, kind: 'full' },
  { pattern: '/login', owner: null, kind: 'full' },
  { pattern: '/signup', owner: null, kind: 'full' },
  { pattern: '/morning/:date', owner: null, kind: 'redirect', to: '/today/:date/morning' },
  { pattern: '/morning', owner: null, kind: 'redirect', to: '/today' },
  { pattern: '/reads/:tab?', owner: null, kind: 'redirect', to: '/journal/reads/:tab?' },
  { pattern: '/plan/plans', owner: null, kind: 'redirect', to: '/settings/plans' },
  { pattern: '/journal/quotes', owner: null, kind: 'redirect', to: '/journal/library' },
  { pattern: '/journal/favorites', owner: null, kind: 'redirect', to: '/journal/library' },
  { pattern: '/trends', owner: null, kind: 'redirect', to: '/progress' },
  { pattern: '/setup', owner: null, kind: 'redirect', to: '/signup' },
  { pattern: '*', owner: null, kind: 'redirect', to: '/today' },
];

export interface PushedEntry {
  /** Unique per push (path + a counter). */
  key: string;
  path: string;
  title: string;
  depth: 1 | 2;
  /** The nav.idx of the history entry its own push created; −1 when it has none (contracts §A.2 "Entry indices"). */
  idx: number;
  /** The data-shared id the flyer travels between ('morning-line-<date>'). */
  shared?: string;
  params: Readonly<Record<string, string>>;
}
/** scrollTop lives in the DOM: each tab's scroller stays mounted. */
export interface TabState {
  path: string;
  stack: PushedEntry[];
}
export interface NavState {
  active: TabId;
  tabs: Record<TabId, TabState>;
  overlays: number;
}

export interface RouteMatch {
  kind: RouteKind;
  tab: TabId | null;
  /** The root path the URL belongs to ('/today/2026-10-24', '/plan/week/2026-10-19'). */
  root: string;
  /** The pushed entries the URL implies, each with idx −1 (they have no history entry of their own). */
  stack: PushedEntry[];
  params: Readonly<Record<string, string>>;
  /** kind === 'redirect': where to go instead. */
  redirect?: string;
  /** The route def that matched (for redirects, the redirect's own def). */
  route?: RouteDef;
}

// ---------- params ----------
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const isIsoDay = (s: string) => {
  if (!ISO.test(s)) return false;
  const d = new Date(`${s}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
};
const isMonday = (s: string) => isIsoDay(s) && new Date(`${s}T12:00:00Z`).getUTCDay() === 1;
const isFirstOfMonth = (s: string) => isIsoDay(s) && s.endsWith('-01');
/** A param that fails its check sends the URL to its tab's root. */
const VALID: Record<string, (v: string) => boolean> = {
  date: isIsoDay,
  mon: isMonday,
  month: isFirstOfMonth,
  section: (v) => (SETTINGS_SECTIONS as readonly string[]).includes(v),
};
const INVALID_TO: Record<string, string> = { '/today': '/today', '/settings': '/settings', '/plan': '/plan', '/morning': '/today' };

// ---------- the matcher ----------
const clean = (path: string) => {
  let p = path.split(/[?#]/)[0] || '/';
  if (!p.startsWith('/')) p = `/${p}`;
  if (p.length > 1) p = p.replace(/\/+$/, '');
  return p;
};
/** Match one pattern: null, or its params (an unmatched optional param is absent). Never validates. */
const matchPattern = (pattern: string, path: string): Record<string, string> | null => {
  if (pattern === '*') return {};
  const ps = pattern.split('/').filter(Boolean);
  const xs = path.split('/').filter(Boolean);
  const out: Record<string, string> = {};
  for (let i = 0; i < ps.length; i++) {
    const p = ps[i]!;
    const x = xs[i];
    if (p === '*') return out;
    if (p.startsWith(':')) {
      const opt = p.endsWith('?');
      const name = p.slice(1, opt ? -1 : undefined);
      if (x === undefined) {
        if (opt) continue;
        return null;
      }
      out[name] = decodeURIComponent(x);
      continue;
    }
    if (x !== p) return null;
  }
  return xs.length <= ps.length ? out : null;
};
const fill = (to: string, params: Record<string, string>) =>
  to
    .split('/')
    .map((s) => (s.startsWith(':') ? (params[s.slice(1).replace(/\?$/, '')] ?? (s.endsWith('?') ? null : '')) : s))
    .filter((s) => s !== null)
    .join('/') || '/';

let seq = 0;
/** A pushed entry for a route, with no history entry of its own (idx −1) until a push gives it one. */
export const entryFor = (route: RouteDef, path: string, params: Record<string, string>, idx = -1): PushedEntry => ({
  key: `${path}#${++seq}`,
  path,
  title: typeof route.title === 'function' ? route.title(params) : (route.title ?? ''),
  depth: route.depth ?? 1,
  idx,
  params,
});

/**
 * The route a URL belongs to. Validates `:date` and `:mon` (an ISO day; `:mon` a Monday) and `:month` (the first of a
 * month): anything else redirects to that tab's root. A pushed URL implies the pages under it: `/settings/training` is
 * Settings at depth 1 and Training at depth 2 over the Today root; every implied entry has `idx −1`.
 */
export const matchRoute = (pathname: string): RouteMatch => {
  const path = clean(pathname);
  for (const route of ROUTES) {
    const params = matchPattern(route.pattern, path);
    if (!params) continue;
    // validation: a bad param goes to the tab's root (the first segment's), never on to the catch-all
    for (const [k, v] of Object.entries(params)) {
      const ok = VALID[k];
      if (ok && !ok(v)) {
        const head = `/${path.split('/')[1] ?? ''}`;
        const to = INVALID_TO[head] ?? '/today';
        return { kind: 'redirect', tab: null, root: to, stack: [], params: {}, redirect: to, route };
      }
    }
    if (route.kind === 'redirect') {
      const to = fill(route.to!, params);
      return { kind: 'redirect', tab: null, root: to, stack: [], params, redirect: to, route };
    }
    if (route.kind === 'full') return { kind: 'full', tab: null, root: path, stack: [], params, route };
    const tab = route.owner!;
    // Journal's segment is page state like a date (§1.2): /journal/library names it, so a root request can tell the two apart
    if (route.kind === 'root') return { kind: 'root', tab, root: path, stack: [], params: route.pattern === '/journal/library' ? { ...params, segment: 'library' } : params, route };
    // pushed: the root under it and the layers it implies
    if (route.pattern === '/today/:date/morning') {
      const root = `/today/${params.date}`;
      return { kind: 'pushed', tab, root, stack: [entryFor(route, path, params)], params, route };
    }
    if (route.pattern === '/settings/:section') {
      const settings = ROUTES.find((r) => r.pattern === '/settings')!;
      return { kind: 'pushed', tab, root: '/today', stack: [entryFor(settings, '/settings', {}), entryFor(route, path, params)], params, route };
    }
    return { kind: 'pushed', tab, root: tabDef(tab).root, stack: [entryFor(route, path, params)], params, route };
  }
  return { kind: 'redirect', tab: null, root: '/today', stack: [], params: {}, redirect: '/today' };
};

/** Follow redirects (at most a few hops) to the route a URL finally shows. */
export const resolveRoute = (pathname: string): RouteMatch & { path: string } => {
  let path = clean(pathname);
  for (let i = 0; i < 4; i++) {
    const m = matchRoute(path);
    if (m.kind !== 'redirect') return { ...m, path };
    path = m.redirect!;
  }
  return { ...matchRoute('/today'), path: '/today' };
};

/**
 * True when a pushed route carries its root's params in its own URL (This morning is the day it was pushed from). Settings,
 * the gallery and Reads sit over whatever the tab root shows, so a jump to them never moves the root.
 */
export const impliesRoot = (m: RouteMatch) => m.kind === 'root' || m.route?.pattern === '/today/:date/morning';

/* window events (CustomEvent names) */
/** Pull to refresh committed (Today only). */
export const REFRESH = 'logbook:refresh';
/** A page commit of a DayPager: detail PageCommitDetail. */
export const PAGE_COMMIT = 'logbook:page-commit';
/** Every NavController action: detail NavEventDetail. */
export const NAV_EVENT = 'logbook:nav';
export interface PageCommitDetail {
  from: string;
  to: string;
  step: 'day' | 'week' | 'month';
}
export interface NavEventDetail {
  type: 'tab' | 'push' | 'pop' | 'replace' | 'jump' | 'overlay';
  path: string;
  tab: TabId;
}

/**
 * @deprecated never dispatched (contracts rule 5): a lit-tab tap goes through `useHomeControl` now. Kept while a feature
 * file still listens for it; WP1 deletes it after WP6 lands.
 */
export const TAB_RESELECT = 'logbook:tab-reselect';
/** @deprecated see TAB_RESELECT. */
export interface TabReselectDetail {
  tab: TabId;
  atTop: boolean;
}

