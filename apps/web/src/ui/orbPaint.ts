/**
 * The orb, painted: a drop of glowing gel. Pure drawing on a 2D canvas, no React, so the same function paints the live mark,
 * the splash and the static icons.
 *
 * What makes it read as liquid:
 *   the skin     a closed curve through 10 points whose radii ride slow, layered sine waves (never the same twice), so
 *                the outline wobbles like surface tension holding a drop
 *   the currents four soft colour masses (gold and orange at the heart, rose, periwinkle, ice) drift on their own looping
 *                paths inside the skin and bleed into each other
 *   the light    a broad specular sheen on the upper left, a thin rim light round the edge, and a glow outside that breathes
 *
 * `t` is seconds. `energy` 1 is at rest; higher (the assistant thinking) moves and wobbles faster and brightens the heart.
 */

/** The orb's palettes: the brand's own, and four variants built from the same colours (for markers, moods, kinds). */
export type OrbVariant = 'brand' | 'sun' | 'sky' | 'dusk' | 'tide';
type RGB = [number, number, number];
interface Palette {
  /** the heart's four stops, centre out */
  heart: [RGB, RGB, RGB, RGB];
  /** the three currents */
  currents: [RGB, RGB, RGB];
  /** the body: highlight, mid, edge */
  body: [string, string, string];
  glow: [RGB, RGB];
}
const PALETTES: Record<OrbVariant, Palette> = {
  brand: { heart: [[255, 240, 190], [255, 205, 110], [255, 140, 70], [242, 101, 34]], currents: [[160, 140, 255], [150, 240, 255], [255, 150, 190]], body: ['#ffffff', '#e3f0fa', '#a9c6f0'], glow: [[255, 170, 120], [150, 160, 255]] },
  sun: { heart: [[255, 248, 214], [255, 214, 120], [255, 164, 72], [242, 120, 34]], currents: [[255, 196, 120], [255, 230, 170], [255, 160, 140]], body: ['#fffdf6', '#fff0d9', '#f6cf9c'], glow: [[255, 190, 110], [255, 160, 120]] },
  sky: { heart: [[240, 252, 255], [190, 232, 252], [140, 200, 240], [80, 150, 220]], currents: [[150, 240, 255], [185, 217, 235], [140, 170, 255]], body: ['#ffffff', '#e6f3fb', '#a8cdeb'], glow: [[150, 210, 255], [185, 217, 235]] },
  dusk: { heart: [[255, 236, 246], [250, 185, 215], [200, 150, 255], [140, 120, 240]], currents: [[255, 160, 200], [180, 160, 255], [150, 200, 255]], body: ['#fffaff', '#f1e9fb', '#c9b8f2'], glow: [[240, 160, 210], [170, 150, 255]] },
  tide: { heart: [[220, 236, 250], [140, 180, 225], [70, 120, 180], [30, 70, 120]], currents: [[120, 170, 230], [150, 230, 255], [90, 110, 200]], body: ['#f4f9fd', '#cfe2f3', '#7fa6cf'], glow: [[110, 150, 210], [150, 200, 240]] },
};
const rgba = (c: RGB, a: number) => `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${a})`;

export interface OrbPaintOpts {
  variant?: OrbVariant;
  /** Canvas size in CSS px (square); the orb's own diameter is `size / PAD`. */
  size: number;
  t: number;
  energy?: number;
}

/** The canvas is this much wider than the orb, for the glow. */
export const ORB_PAD = 1.5;

const TAU = Math.PI * 2;
const N = 10;

/** Smooth, never-repeating wobble: three incommensurate sines per point. */
const wave = (i: number, t: number) =>
  Math.sin(t * 0.9 + i * 1.7) * 0.5 + Math.sin(t * 1.37 + i * 2.9 + 1.3) * 0.32 + Math.sin(t * 0.53 + i * 0.8 + 4.1) * 0.28;

const skin = (ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, t: number, amp: number) => {
  const pts: Array<[number, number]> = [];
  for (let i = 0; i < N; i++) {
    const a = (i / N) * TAU + Math.sin(t * 0.21) * 0.25;
    const rr = r * (1 + amp * wave(i, t));
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
  }
  // a closed curve through the midpoints, each point a control: no corners anywhere
  ctx.beginPath();
  const mid = (p: [number, number], q: [number, number]): [number, number] => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
  const m0 = mid(pts[N - 1]!, pts[0]!);
  ctx.moveTo(m0[0], m0[1]);
  for (let i = 0; i < N; i++) {
    const p = pts[i]!;
    const m = mid(p, pts[(i + 1) % N]!);
    ctx.quadraticCurveTo(p[0], p[1], m[0], m[1]);
  }
  ctx.closePath();
};

const blob = (ctx: CanvasRenderingContext2D, x: number, y: number, r: number, stops: Array<[number, string]>) => {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  for (const [o, c] of stops) g.addColorStop(o, c);
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
};

export const paintOrb = (ctx: CanvasRenderingContext2D, { size, t: time, energy = 1, variant = 'brand' }: OrbPaintOpts) => {
  const P = PALETTES[variant];
  const t = time * (0.55 + 0.45 * energy);
  // the whole drop floats a little, as if suspended
  const c = size / 2;
  const R = size / ORB_PAD / 2;
  const fx = c + R * 0.035 * Math.sin(t * 0.63);
  const fy = c + R * 0.045 * Math.sin(t * 0.47 + 1.1);
  const amp = 0.05 + 0.03 * (energy - 1);
  ctx.clearRect(0, 0, size, size);

  // the glow outside: breathing, warm low and cool high, so it radiates rather than sits. Each glow's radius stops at the
  // canvas edge nearest its centre, so it has faded to nothing before the canvas ends (no cut edge, shell-22)
  const breathe = 1 + 0.06 * Math.sin(t * 1.1);
  const fit = (x: number, y: number, r: number) => Math.max(0, Math.min(r, x, y, size - x, size - y));
  const g1x = c + R * 0.12 * Math.sin(t * 0.4);
  const g1y = c + R * 0.1;
  const g2x = c + R * 0.25 * Math.cos(t * 0.33);
  const g2y = c - R * 0.15;
  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  blob(ctx, g1x, g1y, fit(g1x, g1y, R * 1.45 * breathe), [
    [0, rgba(P.glow[0], 0.3)],
    [0.55, rgba(P.glow[0], 0.1)],
    [1, rgba(P.glow[0], 0)],
  ]);
  blob(ctx, g2x, g2y, fit(g2x, g2y, R * 1.5 * breathe), [
    [0, rgba(P.glow[1], 0.28)],
    [0.6, rgba(P.glow[1], 0.08)],
    [1, rgba(P.glow[1], 0)],
  ]);
  ctx.restore();

  // the drop: everything below is clipped to its moving skin
  ctx.save();
  skin(ctx, fx, fy, R, t, amp);
  ctx.shadowColor = rgba(P.glow[1], 0.55);
  ctx.shadowBlur = R * 0.35;
  const base = ctx.createRadialGradient(c - R * 0.3, c - R * 0.35, R * 0.1, c, c, R * 1.05);
  base.addColorStop(0, P.body[0]);
  base.addColorStop(0.45, P.body[1]);
  base.addColorStop(1, P.body[2]);
  ctx.fillStyle = base;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.clip();

  // the currents: each a soft mass on its own looping path, bleeding into the others
  const heart = 1 + 0.12 * (energy - 1) * (0.5 + 0.5 * Math.sin(t * 5));
  blob(ctx, c + R * 0.5 * Math.cos(t * 0.47 + 2), c + R * 0.45 * Math.sin(t * 0.61 + 1), R * 0.95, [
    [0, rgba(P.currents[0], 0.85)],
    [0.6, rgba(P.currents[0], 0.35)],
    [1, rgba(P.currents[0], 0)],
  ]);
  blob(ctx, c + R * 0.55 * Math.cos(t * 0.38 + 4.2), c + R * 0.5 * Math.sin(t * 0.52 + 3), R * 0.8, [
    [0, rgba(P.currents[1], 0.85)],
    [0.7, rgba(P.currents[1], 0.2)],
    [1, rgba(P.currents[1], 0)],
  ]);
  blob(ctx, c + R * 0.45 * Math.cos(t * 0.55 + 0.6), c + R * 0.4 * Math.sin(t * 0.43 + 5), R * 0.85, [
    [0, rgba(P.currents[2], 0.8)],
    [0.65, rgba(P.currents[2], 0.25)],
    [1, rgba(P.currents[2], 0)],
  ]);
  const hx = c - R * 0.12 + R * 0.22 * Math.cos(t * 0.5);
  const hy = c - R * 0.05 + R * 0.2 * Math.sin(t * 0.37 + 1.4);
  blob(ctx, hx, hy, R * 0.82 * heart, [
    [0, rgba(P.heart[0], 1)],
    [0.22, rgba(P.heart[1], 0.98)],
    [0.5, rgba(P.heart[2], 0.9)],
    [0.78, rgba(P.heart[3], 0.35)],
    [1, rgba(P.heart[3], 0)],
  ]);

  // the sheen: a broad soft highlight up and left, sliding a little with the surface
  const sx = c - R * 0.38 + R * 0.06 * Math.sin(t * 0.7);
  const sy = c - R * 0.48 + R * 0.05 * Math.cos(t * 0.6);
  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(-0.5);
  ctx.scale(1, 0.55);
  blob(ctx, 0, 0, R * 0.55, [
    [0, 'rgba(255, 255, 255, 0.85)'],
    [0.5, 'rgba(255, 255, 255, 0.3)'],
    [1, 'rgba(255, 255, 255, 0)'],
  ]);
  ctx.restore();
  ctx.restore();

  // the rim light: a thin bright edge, strongest where the light hits
  ctx.save();
  skin(ctx, fx, fy, R, t, amp);
  const rim = ctx.createLinearGradient(c - R, c - R, c + R, c + R);
  rim.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
  rim.addColorStop(0.5, 'rgba(255, 255, 255, 0.15)');
  rim.addColorStop(1, 'rgba(190, 200, 255, 0.6)');
  ctx.strokeStyle = rim;
  ctx.lineWidth = Math.max(0.75, R * 0.035);
  ctx.stroke();
  ctx.restore();
};
