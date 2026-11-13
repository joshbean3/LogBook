import { createPool, FULL_DAY_CHIP, LAND, POOL_SIZE, POP, STILL, type Light, type PopMode } from './rules';
import './moment.css';
import '@/ui/orbLight.css';

/**
 * The layer the Orbs are drawn on: one fixed element on `body` with six pooled nodes and one chip. It is made the
 * first time an Orb is born and stays. `pointer-events: none` and `aria-hidden`: nothing here is touched or read.
 *
 * An Orb is started by writing its numbers to a node as custom properties and giving the node a class; from there the
 * browser plays CSS keyframes on transform and opacity, and no script runs per frame (the page behind re-renders on a
 * write, a long task at times: the Orb must not wait for it). A node that has finished is free again; a seventh live
 * Orb takes the oldest node.
 */
interface Node {
  el: HTMLElement;
  light: HTMLElement;
  timer: ReturnType<typeof setTimeout> | undefined;
  live: boolean;
  /** Tells the Orb's caller it is over (once). */
  end?: (landed: boolean) => void;
}
let layer: HTMLElement | null = null;
let chip: HTMLElement | null = null;
let chipTimer: ReturnType<typeof setTimeout> | undefined;
const nodes: Node[] = [];
let pool = createPool(POOL_SIZE);
const MODES = ['is-rise', 'is-fly', 'is-still'] as const;
/** How long the full-day chip is up. */
export const CHIP_MS = 2400;

const span = (cls: string, parent: HTMLElement) => {
  const el = document.createElement('span');
  el.className = cls;
  parent.appendChild(el);
  return el;
};
/** The same two layers `ui/OrbLight.tsx` draws (kept in step with it: a pooled node is not a React element). */
const lightIn = (parent: HTMLElement, size: number) => {
  const el = span('orb-light', parent);
  el.style.setProperty('--ol', `${size}px`);
  const glow = document.createElement('i');
  glow.className = 'ol-glow';
  const core = document.createElement('i');
  core.className = 'ol-core';
  el.append(glow, core);
  return el;
};
const ensure = (): HTMLElement | null => {
  if (layer?.isConnected) return layer;
  if (typeof document === 'undefined' || !document.body) return null;
  layer = document.createElement('div');
  layer.className = 'om-layer';
  layer.setAttribute('aria-hidden', 'true');
  // the numbers every Orb shares, written once
  const s = layer.style;
  s.setProperty('--om-from', String(POP.from));
  s.setProperty('--om-peak', String(POP.peak));
  s.setProperty('--om-fade', String(POP.fadeScale));
  s.setProperty('--om-rise-ms', `${POP.riseMs}ms`);
  s.setProperty('--om-pop-ms', `${POP.fadeEndMs}ms`);
  s.setProperty('--om-born-ms', `${POP.settleMs}ms`);
  s.setProperty('--om-still-ms', `${STILL.inMs + STILL.holdMs + STILL.outMs}ms`);
  s.setProperty('--om-chip-ms', `${CHIP_MS}ms`);
  nodes.length = 0;
  for (let i = 0; i < POOL_SIZE; i++) {
    const el = span('om-node', layer);
    const pop = span('om-pop', span('om-land', span('om-rise', span('om-fy', span('om-fx', el)))));
    nodes.push({ el, light: lightIn(pop, POP.size), timer: undefined, live: false });
  }
  chip = span('om-chip', layer);
  const inner = span('om-chip-in', chip);
  lightIn(inner, POP.restSize);
  inner.appendChild(document.createTextNode(FULL_DAY_CHIP));
  document.body.appendChild(layer);
  return layer;
};

export interface Spawn {
  /** The control's center, in the viewport. */
  x: number;
  y: number;
  light: Light;
  mode: PopMode;
  /** A flight: where the counter's sun is from the end of the rise, and how long the flight takes. */
  fly?: { dx: number; dy: number; ms: number };
  /** Called when the Orb is over: `landed` when it reached the counter (never for one that was recycled on the way). */
  onEnd?: (landed: boolean) => void;
}
/** How long an Orb lasts from its birth frame, in ms. */
export const lifeOf = (s: Pick<Spawn, 'mode' | 'light' | 'fly'>): number =>
  s.mode === 'still' ? STILL.inMs + STILL.holdMs + STILL.outMs : s.light.delay + (s.mode === 'fly' && s.fly ? POP.flyAtMs + s.fly.ms : POP.fadeEndMs);

/** Start one Orb on a node of the pool. Returns false when there is no page to draw on. */
export const spawn = (s: Spawn): boolean => {
  if (!ensure()) return false;
  const { index, recycled } = pool.take();
  const node = nodes[index]!;
  const el = node.el;
  if (recycled || node.live) {
    // the oldest live Orb gives up its node: its classes go and the style is read once so the next animation starts
    // from its first frame (the only forced style read here, and only for a seventh Orb in 0.6 s)
    clearTimeout(node.timer);
    el.classList.remove(...MODES);
    void el.offsetWidth;
  }
  const st = el.style;
  st.setProperty('--om-x', `${s.x}px`);
  st.setProperty('--om-y', `${s.y}px`);
  st.setProperty('--om-dx', `${s.light.dx}px`);
  st.setProperty('--om-dy', `${s.light.dy}px`);
  st.setProperty('--om-delay', `${s.light.delay}ms`);
  node.light.style.setProperty('--ol', `${s.light.size}px`);
  if (s.mode === 'fly' && s.fly) {
    st.setProperty('--om-fx', `${s.fly.dx}px`);
    st.setProperty('--om-fy', `${s.fly.dy}px`);
    st.setProperty('--om-fly', `${s.fly.ms}ms`);
    st.setProperty('--om-fly-at', `${s.light.delay + POP.flyAtMs}ms`);
    st.setProperty('--om-end', String(POP.restSize / s.light.size));
  }
  el.classList.add(s.mode === 'fly' && s.fly ? 'is-fly' : s.mode === 'still' ? 'is-still' : 'is-rise');
  node.live = true;
  let ended = false;
  const end = (landed: boolean) => {
    if (ended) return;
    ended = true;
    s.onEnd?.(landed);
  };
  // a node taken over mid-flight still tells its caller it is over (the count must not wait for it)
  node.end?.(false);
  node.end = end;
  node.timer = setTimeout(() => {
    node.end = undefined;
    el.classList.remove(...MODES);
    node.live = false;
    pool.free(index);
    end(s.mode === 'fly' && !!s.fly);
  }, lifeOf(s) + 34);
  return true;
};

/** Show the full-day chip with the middle of its trailing edge (`anchor: 'end'`) or its center at the point. */
export const showChip = (x: number, y: number, anchor: 'end' | 'center'): boolean => {
  if (!ensure() || !chip) return false;
  clearTimeout(chipTimer);
  chip.classList.remove('is-on');
  // measured once, here: the chip is its own layer, so this reads no layout of the page behind
  const w = chip.offsetWidth;
  const h = chip.offsetHeight;
  const vw = window.innerWidth;
  const left = Math.max(16, Math.min(vw - 16 - w, anchor === 'end' ? x - w : x - w / 2));
  const top = Math.max(8, y - h / 2);
  chip.style.setProperty('--om-x', `${Math.round(left)}px`);
  chip.style.setProperty('--om-y', `${Math.round(top)}px`);
  chip.classList.add('is-on');
  chipTimer = setTimeout(() => chip?.classList.remove('is-on'), CHIP_MS + 50);
  return true;
};

/**
 * Take every Orb in the air away at once (a sheet or a menu is on its way up: nothing is drawn over it). Each one's
 * caller is told it is over, not landed, so the count has it all the same. The chip stays: it is words, by the counter.
 */
export const clearOrbs = () => {
  nodes.forEach((node, index) => {
    if (!node.live) return;
    clearTimeout(node.timer);
    node.el.classList.remove(...MODES);
    node.live = false;
    pool.free(index);
    const end = node.end;
    node.end = undefined;
    end?.(false);
  });
};

/** How many Orbs are in the air. */
export const liveOrbs = (): number => pool.live();
export const LAND_MS = LAND.ms;

/** Tests only: take the layer away. */
export const resetLayerForTest = () => {
  for (const n of nodes) clearTimeout(n.timer);
  clearTimeout(chipTimer);
  layer?.remove();
  pool = createPool(POOL_SIZE);
  layer = null;
  chip = null;
  nodes.length = 0;
};
