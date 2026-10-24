/**
 * Gesture thresholds (docs/feel.md §10, contracts §D.2). The only place these numbers are typed: px, px/s and ms.
 * Every recogniser (the day pager, the edge pop, the sheet drag, swipe rows, the hold) reads them from here.
 */

/** Direction lock: the first 10 px decide, inside a 40° cone (cos 40° = 0.766). */
export const LOCK_PX = 10;
export const CONE_COS = 0.766;
/** Past a bound a drag moves at 0.2× the finger. */
export const RUBBER = 0.2;

/** Pager: release projection (Ionic's 350 ms), the commit fraction of W, and the flick speed that earns `pageFlick`. */
export const PROJECT_S = 0.35;
export const PAGE_COMMIT_FRAC = 0.3;
export const FLICK_V = 500;

/** Edge pop: the band inside the pushed layer's current left edge, and the commit fraction / speed. */
export const EDGE_PX = 24;
export const POP_COMMIT_FRAC = 0.35;
export const POP_COMMIT_V = 300;
/**
 * A push, a pop or a sheet's rise this close to its rest (px) looks at rest: a tap that lands then is a tap, not a touch
 * during a transition (feel review 4 D1). The page spring spends its last ~120 ms within 10 px. A pushed layer in the band
 * completes on that pointerdown; the edge band's catch keeps §10's 1 px rule.
 */
export const ARRIVED_PX = 8;

/** Sheet: dismiss speed and fraction, and the lock after the body reaches scrollTop 0 by scrolling. */
export const SHEET_DISMISS_V = 400;
export const SHEET_DISMISS_FRAC = 0.25;
export const SHEET_SCROLL_LOCK_MS = 100;

/** Swipe rows (sheets, Library, Reads): the reveal detent, the full-swipe fraction of W and speed. */
export const SWIPE_REVEAL_PX = 72;
export const SWIPE_FULL_FRAC = 0.55;
export const SWIPE_FULL_V = 600;

/** The one hold clock (450 ms), the pre-grow at 300 ms, the slop before it, and the move that starts a drag after it. */
export const HOLD_MS = 450;
export const PREHOLD_MS = 300;
export const HOLD_SLOP_PX = 8;
export const DRAG_START_PX = 8;

/** The hold ring's linear fill (a confirm with visible progress, not a reveal). */
export const FILL_MS = 400;
/** The alarm drag: 14 px per 5-minute step. */
export const ALARM_PX_PER_STEP = 14;
/** Selection ticks are throttled to one per 40 ms. */
export const SELECT_THROTTLE_MS = 40;
/** Phase and day deferrals wait for this much stillness. */
export const IDLE_MS = 60_000;

/** The run landing: the status line's floor and cap, the silent retry, and stravaSyncNow's throttle. */
export const CHECKING_MIN_MS = 600;
export const CHECKING_MAX_MS = 3000;
export const STRAVA_RETRY_MS = 8000;
export const STRAVA_GAP_MS = 30_000;
/** The hero (and the Week card for `celebrate`) must be this much in view. */
export const LANDING_VISIBLE = 0.5;
/** The owner's word: the editor's maxLength and capsWord's clip. */
export const WORD_MAX = 12;

/** Pull to refresh (Today only): the arm distance, and how long a fetch may take before a busy state shows. */
export const PTR_ARM_PX = 64;
export const PTR_QUIET_MS = 150;

/** Toasts: plain and with Undo, and the swipe-dismiss speed. */
export const TOAST_MS = 4000;
export const TOAST_UNDO_MS = 6000;
export const TOAST_DISMISS_V = 110;

/** A done to-do folds after this long. */
export const FOLD_MS = 600;
/** Every hold menu holds at most four items. */
export const MAX_MENU_ITEMS = 4;

/** |dx| / hypot ≥ CONE_COS → 'x'; |dy| / hypot ≥ CONE_COS → 'y'; else null (undecided, inside neither cone). */
export const lockAxis = (dx: number, dy: number): 'x' | 'y' | null => {
  const h = Math.hypot(dx, dy);
  if (!h) return null;
  if (Math.abs(dx) / h >= CONE_COS) return 'x';
  if (Math.abs(dy) / h >= CONE_COS) return 'y';
  return null;
};

/** The distance an over-drag of `over` px actually moves: `over × factor` (RUBBER by default), sign kept. */
export const rubber = (over: number, factor: number = RUBBER) => over * factor;
