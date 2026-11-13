/**
 * "How Orby works" by itself: its address and how it leaves. Apart from the screen (TourScreen.tsx), so the pages that
 * open the tour (Settings, the end of first run) name its address without loading it.
 *
 * To open it: `navigate(TOUR_PATH, { state: tourFrom() })`. The state says there is a page to go back to; the tour then
 * ends one step back in history, on that page as it was. Opened any other way (a link, a reload) it ends on Today.
 */
export const TOUR_PATH = '/welcome/how';
/** Where the tour goes when it ends and nothing says where it was opened from. */
export const TOUR_HOME = '/today';
export interface TourOrigin {
  /** The tour was opened from a page of the app: leaving it is one step back in history. */
  tourBack: true;
}
export const tourFrom = (): TourOrigin => ({ tourBack: true });
/** How the tour leaves: 'back' to the page it was opened from, 'home' when there is none. */
export const tourExit = (state: unknown): 'back' | 'home' => (!!state && typeof state === 'object' && (state as Partial<TourOrigin>).tourBack === true ? 'back' : 'home');
/** What the bar's chevron does: on the first page it leaves the tour, on any other it turns back a page. */
export const backAction = (page: number): 'leave' | 'turn' => (page > 0 ? 'turn' : 'leave');
