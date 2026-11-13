/**
 * "How Orby works" by itself: its address and how it leaves. Apart from the screen (TourScreen.tsx), so the pages that
 * open the tour (Settings, the end of first run) name its address without loading it.
 *
 * To open it: `navigate(TOUR_PATH, { state: tourFrom() })`. The state says there is a page to go back to; the tour then
 * ends one step back in history, on that page as it was. Opened any other way (a link, a reload) it ends on Today.
 * `tourFrom('goals')` also opens it on that page (a first-visit tip's link to the tour).
 */
export const TOUR_PATH = '/welcome/how';
/** Where the tour goes when it ends and nothing says where it was opened from. */
export const TOUR_HOME = '/today';
export interface TourOrigin {
  /** The tour was opened from a page of the app: leaving it is one step back in history. */
  tourBack: true;
  /** The page to open on, by its key (a tab's first-visit tip opens the tour on that tab's page). Absent: the first. */
  start?: string;
}
export const tourFrom = (start?: string): TourOrigin => (start ? { tourBack: true, start } : { tourBack: true });
/**
 * The page the tour opens on: the one the opener named, when the tour has it (Fitness off has no Fitness page), else the
 * first. Anything that is not a page's key (a link, a reload, another page's state) is the first page.
 */
export const tourStart = (state: unknown, keys: readonly string[]): number => {
  const start = !!state && typeof state === 'object' ? (state as Partial<TourOrigin>).start : undefined;
  return typeof start === 'string' ? Math.max(0, keys.indexOf(start)) : 0;
};
/** How the tour leaves: 'back' to the page it was opened from, 'home' when there is none. */
export const tourExit = (state: unknown): 'back' | 'home' => (!!state && typeof state === 'object' && (state as Partial<TourOrigin>).tourBack === true ? 'back' : 'home');
/** What the bar's chevron does: on the first page it leaves the tour, on any other it turns back a page. */
export const backAction = (page: number): 'leave' | 'turn' => (page > 0 ? 'turn' : 'leave');
