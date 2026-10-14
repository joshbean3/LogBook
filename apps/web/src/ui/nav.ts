import { Activity, BookOpen, CalendarDays, Sun, type LucideIcon } from 'lucide-react';
import { useLocation } from 'react-router';

/**
 * The navigation model (docs/experience.md §2): four tabs, and pushed pages that keep their owning tab lit.
 * Shell, TabHeader, PushedHeader and the edge-swipe all read from here, so a route's place in the app is decided once.
 */
export type TabId = 'today' | 'plan' | 'progress' | 'journal';
export interface TabDef {
  id: TabId;
  /** The tab root: where a re-tap at the top of the page goes. */
  to: string;
  label: string;
  icon: LucideIcon;
}
export const TABS: readonly TabDef[] = [
  { id: 'today', to: '/today', label: 'Today', icon: Sun },
  { id: 'plan', to: '/plan', label: 'Plan', icon: CalendarDays },
  { id: 'progress', to: '/progress', label: 'Progress', icon: Activity },
  { id: 'journal', to: '/journal', label: 'Journal', icon: BookOpen },
];

/** Pushed pages: no tab of their own; `owner` is the tab that stays lit and the fallback for Back. */
export const PUSHED: Record<string, { owner: TabId | null; title: string }> = {
  morning: { owner: 'today', title: 'Morning' },
  reads: { owner: 'journal', title: 'Reads' },
  settings: { owner: null, title: 'Settings' },
};
const TAB_SECTIONS: Record<string, TabId> = { today: 'today', plan: 'plan', progress: 'progress', trends: 'progress', journal: 'journal' };

export interface RouteInfo {
  /** The first path segment: "today", "morning", "settings", "dev". */
  section: string;
  /** The tab that is lit for this route, or null (Settings, the gallery, onboarding). */
  tab: TabId | null;
  /** A pushed page: back chevron, edge swipe, no tab of its own. */
  pushed: boolean;
  /** Where Back goes when there is no in-app history to pop (a cold start on a deep link). */
  backTo: string;
}
export const routeInfo = (pathname: string): RouteInfo => {
  const section = pathname.split('/')[1] ?? '';
  const p = PUSHED[section];
  if (p) return { section, tab: p.owner, pushed: true, backTo: p.owner ? tabDef(p.owner).to : '/today' };
  return { section, tab: TAB_SECTIONS[section] ?? null, pushed: false, backTo: '/today' };
};
export const tabDef = (id: TabId) => TABS.find((t) => t.id === id)!;
export const useRouteInfo = () => routeInfo(useLocation().pathname);

/** True when the browser history holds an in-app page to pop back to (react-router keeps an index in history.state). */
export const canPopHistory = () => {
  const idx = (window.history.state as { idx?: number } | null)?.idx;
  return typeof idx === 'number' && idx > 0;
};

/**
 * Fired on `window` when the lit tab is tapped again. The Shell has already scrolled to the top or gone to the tab root;
 * a page with its own state (a selected week, an open fold) can listen and reset: detail = { tab, atTop }.
 */
export const TAB_RESELECT = 'logbook:tab-reselect';
export interface TabReselectDetail {
  tab: TabId;
  /** True when the page was already at the top, so this tap means "back to today / this week". */
  atTop: boolean;
}
