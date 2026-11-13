import { countOf, today as clockToday, type ISODate } from '@logbook/shared';
import { haptics } from '@/lib/haptics';
import { showToast, toastStore, type ToastAction } from '@/ui/toastStore';
import { getOrbs, getSwitches, onOrbsChange, orbRoom, ORBS_EVENT, type OrbsGained } from '../store';
import { liveOrbs, showChip, spawn } from './layer';
import { createClaims, FIRST_ORB, flightMs, gainToast, keepsakeToast, lightsOf, POP, popPlan, popsAtControl, SHEET_OPENING_MS, STATUS_AFTER_MS, statusLine, STILL, stillLights, type Claim } from './rules';

/**
 * The moment an Orb is earned: the one call a completing control makes (`popOrbs`), and what follows from the engine's
 * own event (`logbook:orbs-gained`): the counter's number, the full-day chip, the toasts for what is paid once, the
 * first Orb's toast and the line read to VoiceOver.
 *
 * The pop is a UI event fired BY THE TAP, on the frame the control's own haptic fires. That haptic is the award's:
 * nothing here fires one, except the full day's single `success` (guide 9.5's written exception, once a day, only
 * when the completing control's own was an impact). The count never depends on a pop: the engine derives it from
 * what was done, and with "Show Orbs when you earn them" off nothing here shows and the count still grows.
 */
type PopKey = Parameters<typeof orbRoom>[0];
export interface PopOrbs {
  /** What was finished: `todo`, `habit`, `goal:day`, `train:run`, `train:lift` or `train:cross`. */
  key: PopKey;
  /** The day it belongs to (the page's day, never the day of the tap). */
  date: ISODate;
  /** How many Orbs it is worth: 1, or 3 for a session or today's goal (2 for a session at its floor). */
  n: number;
  /** The control: its rectangle as captured at the press, or the element. Without one, the control last pressed. */
  from?: DOMRect | Element | null;
  /** Which one of its kind (the habit's id, the to-do's): one subject pops at most once in 10 s. */
  id?: string;
  /** Start this long after the call, in ms (the training card: after the week's sun has landed, 480). */
  delay?: number;
  /** The control's own haptic: an impact (`toggle`, `orb`) or the `success` notification. Default by kind. */
  haptic?: 'impact' | 'success';
}

// ---------- what the hand is doing (one set of listeners, for the press's rectangle and for "at rest") ----------
let pointers = 0;
let lastActivity = 0;
let press: { el: Element | null; x: number; y: number; at: number } | null = null;
let watching = false;
const CONTROL = 'button, [role="button"], [role="checkbox"], [role="switch"], a[href], .pressable';
const watch = () => {
  if (watching || typeof window === 'undefined' || typeof window.addEventListener !== 'function') return;
  watching = true;
  const opts = { capture: true, passive: true } as const;
  const mark = () => (lastActivity = performance.now());
  window.addEventListener(
    'pointerdown',
    (e) => {
      pointers++;
      mark();
      const t = e.target instanceof Element ? e.target.closest(CONTROL) : null;
      press = { el: t, x: e.clientX, y: e.clientY, at: performance.now() };
    },
    opts,
  );
  const up = () => {
    pointers = Math.max(0, pointers - 1);
    mark();
  };
  window.addEventListener('pointerup', up, opts);
  window.addEventListener('pointercancel', up, opts);
  window.addEventListener('scroll', mark, opts);
  window.addEventListener('keydown', mark, opts);
  window.addEventListener('click', mark, opts);
};
watch();
/** What the hand is doing, for "at rest": fingers down, and ms since the last touch, scroll or key. */
export const handState = () => ({ touching: pointers > 0, quietMs: performance.now() - lastActivity });

const HIT = 44;
/**
 * The rectangle of the control last pressed, within the last few seconds: the control itself while it is still on the
 * page, else a 44 pt square where the finger was. Null when nothing was pressed (a completion that arrived by itself):
 * an Orb is never born without a control under it.
 */
export const pressRect = (within = 2500): DOMRect | null => {
  const now = performance.now();
  if (!press || now - press.at > within) {
    // the keyboard and VoiceOver press with no pointer: the control that has focus, if a key or a click was just now
    const a = typeof document !== 'undefined' ? document.activeElement : null;
    return a && a !== document.body && now - lastActivity < within && a.matches(CONTROL) ? a.getBoundingClientRect() : null;
  }
  if (press.el?.isConnected) {
    const r = press.el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return r;
  }
  return new DOMRect(press.x - HIT / 2, press.y - HIT / 2, HIT, HIT);
};

// ---------- the counter ----------
interface Counter {
  /** The 44 pt target. */
  el: HTMLElement;
  /** The half-sun an Orb flies to. */
  sun: HTMLElement;
  /** An Orb reached it: the sun pulses. */
  land: () => void;
}
let counter: Counter | null = null;
/** The counter on screen registers itself (OrbCounter.tsx), and takes itself away again (`was`: only if it is still the one). */
export const setCounter = (c: Counter | null, was?: Counter) => {
  if (c === null && was && counter !== was) return;
  counter = c;
};
/** The center of the counter's sun when it is on screen with nothing over it, else null. Reads layout once. */
const counterPoint = (): { x: number; y: number; right: number; bottom: number } | null => {
  const c = counter;
  if (!c?.sun.isConnected || typeof document.elementFromPoint !== 'function') return null;
  const r = c.sun.getBoundingClientRect();
  if (r.width <= 0 || r.bottom <= 0 || r.top >= window.innerHeight || r.right <= 0 || r.left >= window.innerWidth) return null;
  const x = r.left + r.width / 2;
  const y = r.top + r.height / 2;
  // under the sticky bar once the title has scrolled away, under a sheet's scrim, on a tab that is not shown
  const top = document.elementFromPoint(x, y);
  if (!top || !c.el.contains(top)) return null;
  const hit = c.el.getBoundingClientRect();
  return { x, y, right: hit.right, bottom: hit.bottom };
};

const claims = createClaims();
const offsetSubs = new Set<() => void>();
const emitOffset = () => {
  for (const f of offsetSubs) f();
};
/** For the counter: subscribe to the claims, and what to add to the store's number for a day (rules.ts `createClaims`). */
export const subscribeOffset = (f: () => void) => {
  offsetSubs.add(f);
  return () => void offsetSubs.delete(f);
};
export const counterOffset = (date: ISODate): number => claims.offset(date);

// ---------- sheets ----------
let overlays = 0;
let overlayAt = -Infinity;
/** The shell says how many sheets and menus are open; one more than before is a sheet on its way up. */
export const setOverlays = (n: number) => {
  if (n > overlays) overlayAt = performance.now();
  overlays = n;
};
export const overlaysOpen = () => overlays;

// ---------- the pop ----------
const reduced = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const rectOf = (from: PopOrbs['from']): DOMRect | null => {
  if (!from) return null;
  if (from instanceof Element) {
    if (!from.isConnected) return null;
    const r = from.getBoundingClientRect();
    return r.width > 0 && r.height > 0 ? r : null;
  }
  return from;
};
const lastPop = new Map<string, number>();
const subjectOf = (o: Pick<PopOrbs, 'key' | 'date' | 'id'>) => `${o.key}:${o.date}:${o.id ?? ''}`;
/** The kind a training session earns under (`train:run`, `train:lift`, `train:cross`), or null for one that earns none (rest). */
export const trainKey = (kind: string): PopKey | null => (kind === 'run' || kind === 'lift' || kind === 'cross' ? `train:${kind}` : null);
/** Gains the store published that no pop had claimed yet: a pop that comes a frame after its own gain still has its room. */
let early: Array<{ key: string; date: string; n: number; at: number }> = [];
const EARLY_MS = 2000;
/** The last Orb born: where, when and with which haptic, for the full-day beat. */
let lastBirth: { x: number; y: number; at: number; haptic: 'impact' | 'success'; over: number } | null = null;

/**
 * An Orb (or a fan of two or three) is born at a control. Call it on the frame the control's own haptic fires. It asks
 * the store whether an Orb is left for this (`orbRoom`: the caps, a closed day, the switches) and answers how many it
 * showed: 0 when there was no room, when this subject popped in the last 10 s, when "Show Orbs" is off, when a sheet
 * is on its way up or the page is hidden. Un-checking never calls this: it calls `unpopOrbs`.
 */
export const popOrbs = (o: PopOrbs): number => {
  if (typeof document === 'undefined') return 0;
  const sw = getSwitches();
  if (!sw.on || !sw.show) return 0;
  const now = performance.now();
  claims.expire(now);
  early = early.filter((g) => now - g.at < EARLY_MS);
  const subject = subjectOf(o);
  const seen = lastPop.get(subject);
  const before = early.filter((g) => g.key === o.key && g.date === o.date).reduce((s, g) => s + g.n, 0);
  const reduce = reduced();
  // the cheap answers first: the layout is read only for an Orb that will be drawn
  const room = orbRoom(o.key, o.date) + before;
  const ask = { n: o.n, on: sw.on, show: sw.show, room, claimed: claims.claimed(o.key, o.date), sinceSubject: seen === undefined ? null : now - seen, hidden: document.hidden, sheetOpening: now - overlayAt < SHEET_OPENING_MS, reduce };
  const first = popPlan(ask);
  if (!first.n) return 0;
  const delay = Math.max(0, o.delay ?? 0);
  // the control's rectangle, read once: now, at the press. A delayed pop from an element (the training card, whose face
  // changes height as it turns to done) reads it when it starts instead, so the Orbs are born where the control then is
  const late = delay > 0 && o.from instanceof Element ? o.from : null;
  const rect0 = late ? null : (rectOf(o.from) ?? pressRect());
  if (!late && !rect0) return 0;
  lastPop.set(subject, now);
  const dir: 1 | -1 = document.documentElement.dir === 'rtl' ? -1 : 1;
  // the count: counted at once, or (a flight) held back until the first light lands
  const claim: Claim = claims.add(o.key, o.date, subject, first.n, now, false);
  if (before > 0) {
    // the store counted it a frame ago: this claim is already confirmed
    early = early.filter((g) => !(g.key === o.key && g.date === o.date));
    claims.confirm(o.key, o.date, first.n);
  }
  const haptic = o.haptic ?? (o.key === 'todo' || o.key === 'habit' ? 'impact' : 'success');
  let landed = false;
  const land = (reached: boolean) => {
    if (landed) return;
    landed = true;
    claims.land(claim);
    if (reached) counter?.land();
    emitOffset();
  };
  const fire = () => {
    const rect = rect0 ?? rectOf(late);
    if (!rect) return land(false);
    const target = reduce ? null : counterPoint();
    const mode = popPlan({ ...ask, sinceSubject: null, sheetOpening: false, counter: !!target }).mode;
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const lights = mode === 'still' ? stillLights(first.n, rect.height / 2) : lightsOf(first.n, dir);
    let longest = 0;
    for (const light of lights) {
      const fly = mode === 'fly' && target ? { dx: target.x - (x + light.dx), dy: target.y - (y + light.dy), ms: 0 } : undefined;
      if (fly) fly.ms = flightMs(Math.hypot(fly.dx, fly.dy));
      spawn({ x, y, light, mode, fly, onEnd: land });
      longest = Math.max(longest, light.delay + (fly ? POP.flyAtMs + fly.ms : mode === 'still' ? STILL.inMs + STILL.holdMs : POP.fadeEndMs));
    }
    const t = performance.now();
    lastBirth = { x, y, at: t, haptic, over: t + longest };
    // with no flight there is nothing to wait for: the counter has it now
    if (mode !== 'fly') land(false);
  };
  // until it starts, the full day's chip and a toast still wait for it
  lastBirth = { x: rect0 ? rect0.left + rect0.width / 2 : 0, y: rect0 ? rect0.top + rect0.height / 2 : 0, at: now + delay, haptic, over: now + delay + POP.goneMs };
  if (delay) setTimeout(fire, delay);
  else fire();
  return first.n;
};

/** A check was taken back (silently): if the store had not counted its Orb yet, the counter lets go of it. */
export const unpopOrbs = (o: Pick<PopOrbs, 'key' | 'date' | 'id'>) => {
  claims.cancel(subjectOf(o));
  emitOffset();
};

// ---------- what the engine says: the count, the full day, what is paid once, the first Orb ----------
const statusSubs = new Set<() => void>();
let status = '';
let statusSum = 0;
let statusTimer: ReturnType<typeof setTimeout> | undefined;
export const subscribeStatus = (f: () => void) => {
  statusSubs.add(f);
  return () => void statusSubs.delete(f);
};
export const getStatus = () => status;
const say = (n: number, today: number) => {
  statusSum += n;
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => {
    status = statusLine(statusSum, today);
    statusSum = 0;
    for (const f of statusSubs) f();
  }, STATUS_AFTER_MS);
};

/** Toasts wait their turn: never over an Undo that is still up, one at a time, and only while what they say still stands. */
interface Queued {
  text: string;
  action?: ToastAction;
  /** Still true? (An Undo may have taken the payment back while the toast waited.) */
  stands?: () => boolean;
}
const queue: Queued[] = [];
/** A toast follows the last Orb's landing by this long (the counter's pulse and its new numeral are seen first). */
const TOAST_AFTER_MS = 500;
let queueOff: (() => void) | null = null;
let drainTimer: ReturnType<typeof setTimeout> | undefined;
const drain = () => {
  if (toastStore.get() || !queue.length) return;
  // the toast sits at the top of the screen, over the counter: it waits until the Orb in the air has landed
  const now = performance.now();
  if (lastBirth && now < lastBirth.over + TOAST_AFTER_MS) {
    clearTimeout(drainTimer);
    drainTimer = setTimeout(drain, lastBirth.over + TOAST_AFTER_MS - now);
    return;
  }
  let next = queue.shift();
  while (next && next.stands && !next.stands()) next = queue.shift();
  if (next) showToast(next.text, next.action);
  if (!queue.length && queueOff) {
    queueOff();
    queueOff = null;
  }
};
const enqueue = (q: Queued) => {
  queue.push(q);
  if (!queueOff) queueOff = toastStore.subscribe(drain);
  drain();
};

const FULL_SEEN = 'logbook.seen.orbs-full.';
const fullSeen = (date: string): boolean => {
  try {
    return localStorage.getItem(FULL_SEEN + date) === '1';
  } catch {
    return true; // no storage: stay still rather than replay
  }
};
const markFull = (date: string) => {
  try {
    localStorage.setItem(FULL_SEEN + date, '1');
  } catch {
    /* private mode */
  }
};
/** The full day: one chip by the counter (or where the last Orb was born) and one `success`, once a day. */
const fullDay = (date: string) => {
  if (fullSeen(date)) return;
  markFull(date);
  const now = performance.now();
  const birth = lastBirth && now - lastBirth.at < 6000 ? lastBirth : null;
  // after the completing Orb: never two warm things moving at once
  const wait = birth ? Math.max(0, birth.over - now) + 160 : 0;
  setTimeout(() => {
    const at = counterPoint();
    const shown = at ? showChip(at.right, at.bottom - 4, 'end') : birth ? showChip(birth.x, birth.y - 56, 'center') : false;
    if (!shown) return void enqueue({ text: 'Full day. 5 Orbs' });
    // the one written exception to one haptic per action: only when the control's own was an impact
    if (birth?.haptic === 'impact') haptics.success();
  }, wait);
};

let go: (path: string) => void = () => undefined;
/** The shell hands over the app's own navigation (a toast's action opens Settings or the Orbs page). */
export const setMomentNav = (fn: (path: string) => void) => {
  go = fn;
};

const onGained = (e: Event) => {
  const d = (e as CustomEvent<OrbsGained>).detail;
  if (!d || !Array.isArray(d.gained)) return;
  const sw = getSwitches();
  const now = performance.now();
  let sum = 0;
  for (const g of d.gained) {
    sum += g.n;
    if (popsAtControl(g.key)) {
      const had = claims.claimed(g.key, g.date);
      claims.confirm(g.key, g.date, g.n);
      // nothing had popped for it yet: a pop that comes a frame later finds it here
      if (had < g.n) early.push({ key: g.key, date: g.date, n: g.n - had, at: now });
      continue;
    }
    if (!sw.on || !sw.show) continue;
    if (g.key === 'full') {
      fullDay(g.date);
      continue;
    }
    const s = getOrbs();
    const text = gainToast(g, { weeks: s ? countOf(s, clockToday()).weeks : 0 });
    if (!text) continue;
    const key = g.key;
    const date = g.date;
    enqueue({ text, stands: () => (key === 'back' ? !!getOrbs()?.days[date]?.k?.back : !!getOrbs()?.once[key]) });
  }
  emitOffset();
  if (sw.on && sw.show && sum > 0) say(sum, d.today);
};

/** The keepsakes this session has seen in the store: a new one is said once (the first Orb; a small keepsake). */
let known: { owner: string; keys: Set<string> } | null = null;
const onStore = () => {
  const s = getOrbs();
  if (!s) return;
  const keys = Object.keys(s.keepsakes);
  if (!known || known.owner !== s.userId) {
    // what the store held when it was opened, taken or rebuilt was not earned just now
    known = { owner: s.userId, keys: new Set(keys) };
    return;
  }
  const sw = getSwitches();
  for (const k of keys) {
    if (known.keys.has(k)) continue;
    known.keys.add(k);
    if (!sw.on || !sw.show || s.seen[k]) continue;
    // only what was earned now: a keepsake that arrives from another phone, dated before, is a "New" row and no more
    if (s.keepsakes[k]!.on < clockToday()) continue;
    if (k === 'first') enqueue({ text: FIRST_ORB.text, action: { label: FIRST_ORB.action, fn: () => go('/settings') } });
    else {
      const text = keepsakeToast(k);
      if (text) enqueue({ text, action: { label: 'View', fn: () => go('/orbs') } });
    }
  }
};

// ---------- at rest: the one cause, besides opening the app, that lets a big moment open ----------
const restSubs = new Set<() => void>();
export const subscribeRest = (f: () => void) => {
  restSubs.add(f);
  return () => void restSubs.delete(f);
};
/** The Close card saved the day's line: the day is done with, and a big moment that is waiting may open (BigMoment.tsx). */
export const dayClosed = () => {
  for (const f of restSubs) f();
};

let started = false;
/** Start listening to the engine (mounted once, by `OrbsMoment` in the shell). Returns a stop. */
export const startMoment = (): (() => void) => {
  if (started || typeof window === 'undefined') return () => undefined;
  started = true;
  watch();
  window.addEventListener(ORBS_EVENT, onGained);
  onStore();
  const off = onOrbsChange(onStore);
  return () => {
    started = false;
    window.removeEventListener(ORBS_EVENT, onGained);
    off();
  };
};
/** Orbs in the air, or about to be. */
export const popping = (): boolean => liveOrbs() > 0 || (!!lastBirth && performance.now() < lastBirth.over);

/** Tests only: forget everything. */
export const resetMomentForTest = () => {
  press = null;
  pointers = 0;
  lastActivity = 0;
  counter = null;
  overlays = 0;
  overlayAt = -Infinity;
  lastPop.clear();
  early = [];
  lastBirth = null;
  known = null;
  queue.length = 0;
  clearTimeout(drainTimer);
  queueOff?.();
  queueOff = null;
  status = '';
  statusSum = 0;
  clearTimeout(statusTimer);
  claims.clear();
};
