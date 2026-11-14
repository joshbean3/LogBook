import { TILT } from './rules';

/**
 * The phone's lean as the dome's gravity, with no DOM in it.
 *
 * `beta` and `gamma` are a `deviceorientation` event's angles in degrees: beta is the lean front to back (0 flat on a
 * table, 90 upright, -90 upside down), gamma the lean left to right (positive: the right edge is lower). `angle` is the
 * screen's turn from its natural way up (`screen.orientation.angle`, or `window.orientation` on an older iPhone: 0, 90
 * with the phone turned a quarter to the left so its top points left, 180, and 270 or -90 turned to the right).
 *
 * Gravity in the phone's own frame is (cos beta x sin gamma, -sin beta) across and up its screen; the part straight
 * through the glass is dropped, since the dome is flat. Turned by the screen's angle and with y pointing down the page,
 * that is which way the spheres fall. Its length is the share of gravity that lies in the screen: 1 upright, 0 flat on a
 * table. A phone is seldom held bolt upright, so the pull is whole from a lean of `TILT.full` (about 30 degrees) and
 * fades to nothing below it: held as people hold phones the spheres have their full weight, and laid flat they stay
 * where they are, as marbles on a table would.
 *
 * Returns (0, 1), straight down, for a reading that is not a number: no sensor is never a reason for the pile to fly.
 */
export interface Pull {
  /** Across the screen, positive to the right. */
  x: number;
  /** Down the screen. Both are shares of whole gravity; the length is 1 at most. */
  y: number;
}
export const DOWN: Pull = { x: 0, y: 1 };
const RAD = Math.PI / 180;
export const gravityFrom = (beta: number | null | undefined, gamma: number | null | undefined, angle: number | null | undefined = 0): Pull => {
  if (typeof beta !== 'number' || typeof gamma !== 'number' || !Number.isFinite(beta) || !Number.isFinite(gamma)) return DOWN;
  // across and up the phone's own screen
  const px = Math.cos(beta * RAD) * Math.sin(gamma * RAD);
  const py = -Math.sin(beta * RAD);
  // the same on the screen as it is turned now, y up
  const a = (typeof angle === 'number' && Number.isFinite(angle) ? angle : 0) * RAD;
  const sx = px * Math.cos(a) - py * Math.sin(a);
  const sy = px * Math.sin(a) + py * Math.cos(a);
  const lean = Math.hypot(sx, sy);
  if (lean < 1e-6) return { x: 0, y: 0 };
  const pull = Math.min(1, lean / TILT.full);
  // y down the page; no negative zero in what is handed on
  return { x: (sx / lean) * pull || 0, y: (-sy / lean) * pull || 0 };
};

/** Gravity eased toward where the phone says it is: `dt` seconds on, `TILT.follow` per second. */
export const follow = (now: Pull, to: Pull, dt: number): Pull => {
  const k = 1 - Math.exp(-TILT.follow * Math.max(0, dt));
  return { x: now.x + (to.x - now.x) * k, y: now.y + (to.y - now.y) * k };
};
/** Has gravity turned enough since the pile went to sleep to wake it? */
export const turned = (was: Pull, now: Pull): boolean => Math.hypot(now.x - was.x, now.y - was.y) > TILT.wake;

// ---------- asking for the sensor ----------
export type MotionAnswer = 'granted' | 'denied' | 'none';
interface Asking {
  requestPermission?: () => Promise<string>;
}
/**
 * Ask for motion access, where the browser asks at all (iOS: `requestPermission` on the event's own class; one answer
 * covers motion and orientation). Call it from the tap itself. `none`: this device has no such event. It never throws.
 */
export const askMotion = async (scope: { DeviceOrientationEvent?: unknown; DeviceMotionEvent?: unknown } | undefined = typeof window === 'undefined' ? undefined : (window as never)): Promise<MotionAnswer> => {
  try {
    const orientation = scope?.DeviceOrientationEvent as Asking | undefined;
    const motion = scope?.DeviceMotionEvent as Asking | undefined;
    if (!orientation) return 'none';
    const ask = typeof orientation.requestPermission === 'function' ? orientation : typeof motion?.requestPermission === 'function' ? motion : null;
    if (!ask) return 'granted';
    return (await ask.requestPermission!()) === 'granted' ? 'granted' : 'denied';
  } catch {
    return 'denied';
  }
};
