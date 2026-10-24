/**
 * Swallow the one click a given pointer produces: a tap that stops or lands on a transition does nothing else (UIKit takes
 * no touch on the content during a push, a pop or a presentation; §9.3, §9.4). WP1-internal.
 *
 * The arm belongs to its pointer, so it can never outlive the gesture and eat a later activation (code review 3 #6): it
 * holds while that pointer is down, expires `WINDOW_MS` after its `pointerup` / `pointercancel` (a touch that became a
 * scroll or a drag makes no click), and a click with `detail === 0` (Enter or Space, Switch Control, VoiceOver's activate:
 * no pointer behind it) is never swallowed. The click is matched by its `pointerId` (Chromium's click is a PointerEvent).
 * A click that carries none, or an id that matches no arm (a WebKit click synthesised with a mouse-type id: consumer
 * review 4 #5, a device check), takes the latest arm whose pointer is already up. Such an arm lives only until the next
 * pointerdown: a click always comes before the next touch begins, so a touch that made no click never hands its arm to
 * the next one. One capture listener set on window while anything is armed.
 */
const WINDOW_MS = 400;

interface Arm {
  id: number;
  until: number;
}
let arms: Arm[] = [];
let on = false;
const opts = { capture: true } as const;

const prune = () => {
  const now = performance.now();
  arms = arms.filter((a) => a.until >= now);
  if (!arms.length) off();
};
const onEnd = (e: PointerEvent) => {
  for (const a of arms) if (a.id === e.pointerId && a.until === Infinity) a.until = performance.now() + WINDOW_MS;
  // an expired arm goes once its pointer's window has passed (no click came)
  setTimeout(prune, WINDOW_MS + 20);
};
/** A new touch begins: the arms of pointers already up had their click (or made none); they go (see above). */
const onDown = () => {
  arms = arms.filter((a) => a.until === Infinity);
  if (!arms.length) off();
};
const onClick = (e: MouseEvent) => {
  prune();
  if (!arms.length || e.detail === 0) return;
  const pid = (e as Partial<PointerEvent>).pointerId;
  let i = typeof pid === 'number' ? arms.findIndex((a) => a.id === pid) : -1;
  if (i < 0) for (let k = arms.length - 1; k >= 0 && i < 0; k--) if (arms[k]!.until !== Infinity) i = k;
  if (i < 0 && typeof pid !== 'number') i = arms.length - 1;
  if (i < 0) return;
  arms.splice(i, 1);
  e.preventDefault();
  e.stopPropagation();
  e.stopImmediatePropagation();
  if (!arms.length) off();
};
function off() {
  if (!on) return;
  on = false;
  window.removeEventListener('pointerup', onEnd, opts);
  window.removeEventListener('pointercancel', onEnd, opts);
  window.removeEventListener('click', onClick, opts);
  window.removeEventListener('pointerdown', onDown, opts);
}

/** Swallow the click this pointer makes (if it makes one). Arming the same pointer twice is one arm. */
export const swallowClickOf = (pointerId: number) => {
  if (!arms.some((a) => a.id === pointerId && a.until === Infinity)) arms.push({ id: pointerId, until: Infinity });
  if (on) return;
  on = true;
  window.addEventListener('pointerup', onEnd, opts);
  window.addEventListener('pointercancel', onEnd, opts);
  window.addEventListener('click', onClick, opts);
  window.addEventListener('pointerdown', onDown, opts);
};

/** A pointer whose up has already been dispatched (a decision made on release): its click comes next, within the window. */
export const swallowNextClickOf = (pointerId: number) => {
  arms = arms.filter((a) => a.id !== pointerId);
  arms.push({ id: pointerId, until: performance.now() + WINDOW_MS });
  setTimeout(prune, WINDOW_MS + 20);
  if (on) return;
  on = true;
  window.addEventListener('pointerup', onEnd, opts);
  window.addEventListener('pointercancel', onEnd, opts);
  window.addEventListener('click', onClick, opts);
  window.addEventListener('pointerdown', onDown, opts);
};

/** Let this pointer's click through after all (a gesture that turned out to be a plain tap). */
export const releaseClickOf = (pointerId: number) => {
  arms = arms.filter((a) => a.id !== pointerId);
  if (!arms.length) off();
};
