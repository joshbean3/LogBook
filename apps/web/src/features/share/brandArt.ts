import wordmarkInk from '@/ui/brand/wordmark-ink.svg?url';
import wordmarkPaper from '@/ui/brand/wordmark-paper.svg?url';

/**
 * The brand surface the share cards are drawn on (guide 3.4, 8.3; plan 2.5): a canvas cannot read CSS variables in every
 * context it is drawn in (a worker, a test, a page under Increase Contrast), so the palette is the token values from
 * styles/tokens.css, written once here. Brand art only: Linen, Twilight and paper grain never reach app chrome.
 */
export const ART = {
  paper: '#FFFDF8', // brand-ok: canvas palette, --paper
  linen: '#F6F0E5', // brand-ok: canvas palette, --linen
  haze: '#CBE8F8', // brand-ok: canvas palette, --haze
  sky: '#38B6F2', // brand-ok: canvas palette, --sky
  deepSky: '#0A6CA6', // brand-ok: canvas palette, --deep-sky
  twilight: '#1B4870', // brand-ok: canvas palette, --twilight
  nightInk: '#0E2236', // brand-ok: canvas palette, --night-ink
  dusk: '#46596D', // brand-ok: canvas palette, --dusk
  edge: 'rgba(14,34,54,.12)', // --edge
  apricotGlow: 'rgba(255,182,128,.42)', // --glow-hero's inner stop
  apricotNone: 'rgba(255,182,128,0)',
  grain: '#7A5A3C', // brand-ok: canvas palette, the guide's warm brown grain (8.3)
} as const;
/** --grain-opacity: the grain multiplies at 40 percent (guide 5.3: 35 to 50 percent on brand surfaces). */
export const GRAIN_OPACITY = 0.4;

/** Card faces: the static Fraunces instance (canvas cannot set the soft axis), Inter for numbers, Inter Tight for captions. */
export const SERIF = '"Fraunces Card", "Iowan Old Style", Georgia, serif';
export const SANS = '"Inter", -apple-system, sans-serif';
export const CAPTION = '"Inter Tight", "Inter", -apple-system, sans-serif';

// ---------- the grain: fractal-like noise, drawn once into a small tile and laid over the ground as a pattern ----------
let grainTile: HTMLCanvasElement | null = null;
const grain = (): HTMLCanvasElement | null => {
  if (grainTile || typeof document === 'undefined') return grainTile;
  const c = document.createElement('canvas');
  c.width = 192;
  c.height = 192;
  const g = c.getContext('2d');
  if (!g) return null;
  const img = g.createImageData(c.width, c.height);
  // two octaves of value noise: a fine speckle over a softer mottle, the brown at 55 percent at its densest
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const coarse = Array.from({ length: 49 * 49 }, rnd);
  for (let y = 0; y < c.height; y++)
    for (let x = 0; x < c.width; x++) {
      const v = 0.6 * rnd() + 0.4 * (coarse[(y >> 2) * 49 + (x >> 2)] ?? 0);
      const i = (y * c.width + x) * 4;
      img.data[i] = 0x7a;
      img.data[i + 1] = 0x5a;
      img.data[i + 2] = 0x3c;
      img.data[i + 3] = Math.round(v * v * 0.55 * 255);
    }
  g.putImageData(img, 0, 0);
  grainTile = c;
  return c;
};
/** Paper grain over the whole card, multiplied at the grain opacity. */
export const drawGrain = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
  const tile = grain();
  if (!tile) return;
  const pat = ctx.createPattern(tile, 'repeat');
  if (!pat) return;
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.globalAlpha = GRAIN_OPACITY;
  ctx.fillStyle = pat;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
};

/** The one Apricot sunrise glow, an ellipse rising from under the bottom edge (the --glow-hero value). */
export const drawSunrise = (ctx: CanvasRenderingContext2D, w: number, h: number, strength = 1, screen = false) => {
  if (strength <= 0) return;
  const cx = w / 2;
  const cy = h * 1.08;
  const rx = w * 0.7;
  const ry = h * 0.42;
  ctx.save();
  if (screen) ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = strength;
  ctx.translate(cx, cy);
  ctx.scale(rx, ry);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
  g.addColorStop(0, ART.apricotGlow);
  g.addColorStop(1, ART.apricotNone);
  ctx.fillStyle = g;
  ctx.fillRect(-cx / rx, -cy / ry, w / rx, h / ry);
  ctx.restore();
};

// ---------- the lockup: the flat Orb and the outlined wordmark, never canvas text (guide 2.2 to 2.4) ----------
const marks: Partial<Record<'ink' | 'paper', HTMLImageElement>> = {};
const loading: Partial<Record<'ink' | 'paper', Promise<void>>> = {};
/** Load the outlined wordmark in Night Ink or Paper. Never holds a card for more than 1.5 s; a card without it still draws. */
export const loadMark = (tone: 'ink' | 'paper'): Promise<void> => {
  if (typeof Image === 'undefined') return Promise.resolve();
  return (loading[tone] ??= new Promise((ok) => {
    const img = new Image();
    img.onload = () => {
      marks[tone] = img;
      ok();
    };
    img.onerror = () => ok();
    setTimeout(ok, 1500);
    img.src = tone === 'ink' ? wordmarkInk : wordmarkPaper;
  }));
};
/**
 * The horizontal lockup with its left edge at `x` and the name's baseline at `baseline`, `wordW` px of wordmark. Built as the
 * published lockup is (`lockup-horizontal-flat-ink.svg`): the Orb at x-height, 900 of the wordmark's 1988 units, sitting on
 * the baseline, 490 units from the O. At a card's size the Orb is under 28 pt on a phone, so it is the flat Sky disc (2.4).
 * Returns the lockup's width.
 */
export const drawLockup = (ctx: CanvasRenderingContext2D, tone: 'ink' | 'paper', x: number, baseline: number, wordW = 228): number => {
  const u = wordW / 4393;
  const d = 900 * u;
  ctx.save();
  ctx.fillStyle = ART.sky;
  ctx.beginPath();
  ctx.arc(x + d / 2, baseline + 10 * u - d / 2, d / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  const img = marks[tone];
  const wx = x + 1390 * u;
  if (img) ctx.drawImage(img, wx, baseline - 1497 * u, wordW, 1988 * u);
  return 1390 * u + wordW;
};
