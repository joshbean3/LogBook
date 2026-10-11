import { clock, decodePolyline, fmtDate, mi, routePath, type ISODate } from '@logbook/shared';

/** A 1080×1920 story card drawn on black: the Aura idea, in Logbook's hand. */
export type Template = 'stamp' | 'route' | 'marker' | 'bubble' | 'week';
export const TEMPLATES: readonly Template[] = ['stamp', 'route', 'marker', 'bubble', 'week'];
export const TEMPLATE_NAME: Record<Template, string> = { stamp: 'Stamp', route: 'Route', marker: 'Marker', bubble: 'Bubble', week: 'Week' };
/** How long the card takes to settle the first time it shows (0 = still). */
export const DRAW_MS: Record<Template, number> = { stamp: 600, route: 1100, marker: 0, bubble: 0, week: 600 };

export interface ShareDay {
  date: ISODate;
  miles: number;
}
export interface ShareData {
  /** The run's name ("Morning Run"), or the plan's label when there is no single activity. */
  name: string;
  /** The plan's label ("Easy 6"), for the caption. */
  label: string;
  date: ISODate;
  /** `HH:MM` start, when Strava knows it. */
  time: string | null;
  miles: number;
  movingSec: number;
  elevFt: number;
  avgHr: number | null;
  polyline: string | null;
  week: { monday: ISODate; days: ShareDay[]; total: number; planned: number } | null;
}
export interface DrawOpts {
  /** 0..1: how far the first-show animation has come. Export at 1. */
  progress: number;
  caption: string;
}

export const W = 1080;
export const H = 1920;
const M = 96;
const WHITE = '#ffffff';
const INK2 = 'rgba(255,255,255,0.72)';
const INK3 = 'rgba(255,255,255,0.5)';
const BLUE = '#2f3bff';
const MARKER = '#f6e64b';
const SERIF = '"Instrument Serif", "Iowan Old Style", Georgia, serif';
const STAMP = '"Inter Tight", "Inter", -apple-system, sans-serif';
const SANS = '"Inter", -apple-system, sans-serif';

// ---------- fonts: the card waits for the bundled faces, never paints a fallback ----------
const FACES = ['italic 400 80px "Instrument Serif"', '900 200px "Inter Tight"', '800 100px "Inter Tight"', '700 100px "Inter"', '600 40px "Inter"', '500 40px "Inter"'];
let fontsReady: Promise<void> | null = null;
export const loadFonts = (): Promise<void> => {
  if (!fontsReady) {
    fontsReady = typeof document !== 'undefined' && 'fonts' in document ? Promise.all(FACES.map((f) => document.fonts.load(f, 'LOGBOOK 0123456789.:’'))).then(() => undefined, () => undefined) : Promise.resolve();
  }
  return fontsReady;
};

// ---------- formatting ----------
const easeOut = (p: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, p)), 3);
/** 8:06 → 8'06'' */
export const paceStamp = (movingSec: number, miles: number): string => (miles > 0.1 && movingSec ? `${clock(movingSec / miles).replace(':', "'")}''` : "—'—''");
const paceColon = (movingSec: number, miles: number): string => (miles > 0.1 && movingSec ? clock(movingSec / miles) : '—');
/** "6.04": two decimals for a card; the app's own `mi` for one. */
const mi2 = (v: number) => (Math.round(v * 100) / 100).toFixed(2);
const DOW = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/** "pov: easy six before work": the plan's label, and the time of day when Strava knows it. */
export const defaultCaption = (d: ShareData): string => {
  const h = d.time ? Number(d.time.slice(0, 2)) : NaN;
  const when = Number.isNaN(h) ? '' : h < 10 ? ' before work' : h < 14 ? ' at lunch' : h >= 17 ? ' after work' : '';
  return `pov: ${d.label.toLowerCase()}${when}`;
};

// ---------- text with tracking ----------
interface TextStyle {
  font: string;
  color: string;
  align?: 'left' | 'center' | 'right';
  tracking?: number;
}
const measure = (ctx: CanvasRenderingContext2D, s: string, st: TextStyle): number => {
  ctx.font = st.font;
  const chars = [...s];
  const tr = st.tracking ?? 0;
  return [...chars].reduce((t, c) => t + ctx.measureText(c).width, 0) + tr * Math.max(0, chars.length - 1);
};
const text = (ctx: CanvasRenderingContext2D, s: string, x: number, y: number, st: TextStyle): number => {
  ctx.font = st.font;
  ctx.fillStyle = st.color;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  const tr = st.tracking ?? 0;
  if (!tr) {
    ctx.textAlign = st.align ?? 'left';
    ctx.fillText(s, x, y);
    ctx.textAlign = 'left';
    return ctx.measureText(s).width;
  }
  const chars = [...s];
  const widths = chars.map((c) => ctx.measureText(c).width);
  const total = widths.reduce((t, w) => t + w, 0) + tr * Math.max(0, chars.length - 1);
  let cx = st.align === 'right' ? x - total : st.align === 'center' ? x - total / 2 : x;
  chars.forEach((c, i) => {
    ctx.fillText(c, cx, y);
    cx += (widths[i] ?? 0) + tr;
  });
  return total;
};
const caps = (ctx: CanvasRenderingContext2D, s: string, x: number, y: number, size = 28, color = INK3, align: TextStyle['align'] = 'left') => text(ctx, s.toUpperCase(), x, y, { font: `600 ${size}px ${SANS}`, color, align, tracking: size * 0.14 });
/** A stamped numeral with its unit stepped down to 40%, both Inter Tight. Returns the width. */
const stamp = (ctx: CanvasRenderingContext2D, n: string, unit: string | null, x: number, y: number, size: number, color = WHITE, weight = 900): number => {
  const w = text(ctx, n, x, y, { font: `${weight} ${size}px ${STAMP}`, color, tracking: -size * 0.04 });
  if (!unit) return w;
  const us = Math.round(size * 0.4);
  const uw = text(ctx, unit.toUpperCase(), x + w + size * 0.08, y, { font: `${weight} ${us}px ${STAMP}`, color: INK2, tracking: -us * 0.02 });
  return w + size * 0.08 + uw;
};
const wrap = (ctx: CanvasRenderingContext2D, s: string, font: string, max: number): string[] => {
  ctx.font = font;
  const lines: string[] = [];
  let cur = '';
  for (const word of s.split(/\s+/).filter(Boolean)) {
    const next = cur ? `${cur} ${word}` : word;
    if (ctx.measureText(next).width <= max || !cur) cur = next;
    else {
      lines.push(cur);
      cur = word;
    }
  }
  if (cur) lines.push(cur);
  return lines;
};

// ---------- the common ground: black, the halo, the wordmark ----------
const ground = (ctx: CanvasRenderingContext2D, halo = 1) => {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  if (halo <= 0) return;
  // the stage light: an ellipse anchored under the bottom edge, as the --halo token draws it
  const cx = W / 2;
  const cy = H * 1.1;
  const rx = W * 0.6;
  const ry = H * 0.7;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(rx, ry);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
  g.addColorStop(0, `rgba(47,59,255,${0.9 * halo})`);
  g.addColorStop(0.7, 'rgba(47,59,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(-cx / rx, -cy / ry, W / rx, H / ry);
  ctx.restore();
};
/** The ring open at the top-right with the check inside, and LOGBOOK in caps, bottom-right. */
const wordmark = (ctx: CanvasRenderingContext2D) => {
  const y = 1700;
  const size = 26;
  const label = 'LOGBOOK';
  const st: TextStyle = { font: `600 ${size}px ${SANS}`, color: INK2, tracking: size * 0.22 };
  const tw = measure(ctx, label, st);
  const ring = 34;
  const x0 = W - M - tw - ring - 14;
  ctx.save();
  ctx.translate(x0, y - size * 0.72 - ring / 2 + size * 0.36);
  ctx.scale(ring / 24, ring / 24);
  ctx.strokeStyle = INK2;
  ctx.lineWidth = 2.2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke(new Path2D('M 19.8 7.5 A 9 9 0 1 1 12 3'));
  ctx.stroke(new Path2D('M7.5 12 L10 14.5 L15.5 9'));
  ctx.restore();
  text(ctx, label, W - M, y, { ...st, align: 'right' });
};
/** Date in caps and the name in the italic serif: the top-left of every single-run card. */
const heading = (ctx: CanvasRenderingContext2D, d: ShareData, nameSize = 72) => {
  caps(ctx, fmtDate('long', d.date), M, 300);
  // a long name steps down a size before it would run off the card
  const fits = (size: number) => measure(ctx, d.name, { font: `italic 400 ${size}px ${SERIF}`, color: WHITE }) <= W - M * 2;
  const size = fits(nameSize) ? nameSize : fits(56) ? 56 : 44;
  const font = `italic 400 ${size}px ${SERIF}`;
  const line = fits(44) ? d.name : (wrap(ctx, d.name, font, W - M * 2)[0] ?? '');
  text(ctx, line, M, 300 + nameSize * 1.15, { font, color: WHITE });
};

// ---------- 1. STAMP: three numerals stacked, labels above ----------
const drawStamp = (ctx: CanvasRenderingContext2D, d: ShareData, p: number) => {
  ground(ctx);
  heading(ctx, d);
  const e = easeOut(p);
  const rows: Array<[string, string, string | null]> = [
    ['Distance', mi2(d.miles * e), 'mi'],
    ['Pace', paceStamp(d.movingSec * e, d.miles * e), null],
    ['Time', clock(d.movingSec * e), null],
  ];
  rows.forEach(([k, v, u], i) => {
    const y = 580 + i * 350;
    caps(ctx, k, M, y);
    stamp(ctx, v, u, M, y + 232, 232);
  });
  const foot: string[] = [];
  if (d.elevFt) foot.push(`${Math.round(d.elevFt)} ft elev`);
  if (d.avgHr != null) foot.push(`${d.avgHr} bpm avg`);
  if (foot.length) caps(ctx, foot.join('   ·   '), M, 1700);
  wordmark(ctx);
};

// ---------- 2. ROUTE: the white line, the four stats in the corner ----------
const routePoints = (polyline: string, w: number, h: number): Array<[number, number]> => {
  const path = routePath(decodePolyline(polyline), w, h, 24);
  return [...path.matchAll(/[ML]([\d.]+) ([\d.]+)/g)].map((m) => [Number(m[1]), Number(m[2])]);
};
const drawRouteLine = (ctx: CanvasRenderingContext2D, pts: Array<[number, number]>, ox: number, oy: number, p: number, width = 9) => {
  if (pts.length < 2) return;
  const n = (pts.length - 1) * easeOut(p);
  const whole = Math.floor(n);
  const frac = n - whole;
  ctx.save();
  ctx.translate(ox, oy);
  ctx.strokeStyle = WHITE;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.shadowColor = 'rgba(255,255,255,0.45)';
  ctx.shadowBlur = 28;
  ctx.beginPath();
  const first = pts[0]!;
  ctx.moveTo(first[0], first[1]);
  for (let i = 1; i <= whole && i < pts.length; i++) ctx.lineTo(pts[i]![0], pts[i]![1]);
  if (whole + 1 < pts.length && frac > 0) {
    const a = pts[whole]!;
    const b = pts[whole + 1]!;
    ctx.lineTo(a[0] + (b[0] - a[0]) * frac, a[1] + (b[1] - a[1]) * frac);
  }
  ctx.stroke();
  ctx.restore();
};
const drawRoute = (ctx: CanvasRenderingContext2D, d: ShareData, p: number) => {
  ground(ctx);
  heading(ctx, d);
  if (d.polyline) drawRouteLine(ctx, routePoints(d.polyline, 840, 800), 120, 450, p);
  const cells: Array<[string, string, string | null]> = [
    ['Distance', mi2(d.miles), 'mi'],
    ['Pace', paceStamp(d.movingSec, d.miles), null],
    ['Time', clock(d.movingSec), null],
    d.avgHr != null ? ['Avg HR', String(d.avgHr), 'bpm'] : ['Elev', String(Math.round(d.elevFt)), 'ft'],
  ];
  cells.forEach(([k, v, u], i) => {
    const x = M + (i % 2) * 440;
    const y = 1320 + Math.floor(i / 2) * 176;
    caps(ctx, k, x, y, 26);
    stamp(ctx, v, u, x, y + 104, 96);
  });
  wordmark(ctx);
};

// ---------- 3. MARKER: the sentence, highlighted ----------
const drawMarker = (ctx: CanvasRenderingContext2D, d: ShareData) => {
  ground(ctx, 0.7);
  heading(ctx, d);
  const lines = [`${mi2(d.miles)} miles,`, `${paceColon(d.movingSec, d.miles)}/mi,`, `${clock(d.movingSec)}.`];
  const size = 128;
  const font = `700 ${size}px ${SANS}`;
  const barH = 168;
  const gap = 24;
  const total = lines.length * barH + (lines.length - 1) * gap;
  let y = 1000 - total / 2;
  for (const line of lines) {
    const w = measure(ctx, line, { font, color: '#000', tracking: -size * 0.02 });
    ctx.fillStyle = MARKER;
    ctx.fillRect(M - 8, y, w + 72, barH);
    text(ctx, line, M + 28, y + barH - 44, { font, color: '#000', tracking: -size * 0.02 });
    y += barH + gap;
  }
  wordmark(ctx);
};

// ---------- 4. BUBBLE: one blue line of chat, the numbers stamped small beneath ----------
const roundRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
};
const drawBubble = (ctx: CanvasRenderingContext2D, d: ShareData, caption: string) => {
  ground(ctx, 0.8);
  heading(ctx, d);
  const size = 72;
  const font = `600 ${size}px ${SANS}`;
  const padX = 64;
  const padY = 52;
  const maxW = 888;
  const lines = wrap(ctx, (caption.trim() || defaultCaption(d)).slice(0, 80), font, maxW - padX * 2);
  ctx.font = font;
  const tw = Math.max(...lines.map((l) => ctx.measureText(l).width), 120);
  const bw = Math.min(maxW, tw + padX * 2);
  const lh = size * 1.22;
  const bh = lines.length * lh + padY * 2;
  const bx = (W - bw) / 2;
  const by = 900 - bh / 2;
  ctx.fillStyle = BLUE;
  roundRect(ctx, bx, by, bw, bh, 56);
  ctx.fill();
  // the tail, bottom-left, as a chat app draws it
  ctx.beginPath();
  ctx.moveTo(bx + 18, by + bh - 48);
  ctx.quadraticCurveTo(bx + 10, by + bh + 10, bx - 30, by + bh + 22);
  ctx.quadraticCurveTo(bx + 40, by + bh + 14, bx + 70, by + bh - 20);
  ctx.closePath();
  ctx.fill();
  lines.forEach((l, i) => text(ctx, l, W / 2, by + padY + size * 0.95 + i * lh, { font, color: WHITE, align: 'center', tracking: -size * 0.015 }));
  const sy = by + bh + 150;
  const row = `${mi2(d.miles)} MI  ·  ${paceStamp(d.movingSec, d.miles)}  ·  ${clock(d.movingSec)}`;
  text(ctx, row, W / 2, sy, { font: `800 56px ${STAMP}`, color: WHITE, align: 'center', tracking: -56 * 0.03 });
  caps(ctx, 'distance  ·  pace  ·  time', W / 2, sy + 48, 24, INK3, 'center');
  wordmark(ctx);
};

// ---------- 5. WEEK: seven small stamps and the total ----------
const drawWeek = (ctx: CanvasRenderingContext2D, d: ShareData, p: number) => {
  ground(ctx);
  const wk = d.week;
  const e = easeOut(p);
  const monday = wk?.monday ?? d.date;
  caps(ctx, `Week of ${fmtDate('md', monday)}`, M, 300);
  text(ctx, 'This week', M, 300 + 72 * 1.15, { font: `italic 400 72px ${SERIF}`, color: WHITE });
  const total = wk?.total ?? d.miles;
  caps(ctx, 'Miles', M, 600);
  const w = stamp(ctx, mi(total * e), 'mi', M, 832, 232);
  if (wk?.planned) caps(ctx, `of ${mi(wk.planned)} planned`, M + w + 36, 832 - 12, 26, INK3);
  const days = wk?.days ?? [{ date: d.date, miles: d.miles }];
  const cols = 7;
  const colW = (W - M * 2) / cols;
  const max = Math.max(1, ...days.map((x) => x.miles));
  const barBottom = 1400;
  const barMax = 340;
  days.forEach((day, i) => {
    const cx = M + colW * i + colW / 2;
    const h = (day.miles / max) * barMax * e;
    ctx.fillStyle = day.miles ? WHITE : 'rgba(255,255,255,0.14)';
    const bw = 56;
    roundRect(ctx, cx - bw / 2, barBottom - Math.max(6, h), bw, Math.max(6, h), 6);
    ctx.fill();
    text(ctx, day.miles ? mi(day.miles) : '—', cx, barBottom + 74, { font: `800 52px ${STAMP}`, color: day.miles ? WHITE : INK3, align: 'center', tracking: -52 * 0.03 });
    caps(ctx, DOW[i] ?? '', cx, barBottom + 128, 26, INK3, 'center');
  });
  wordmark(ctx);
};

export const drawCard = (ctx: CanvasRenderingContext2D, t: Template, d: ShareData, o: DrawOpts) => {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, W, H);
  if (t === 'stamp') drawStamp(ctx, d, o.progress);
  else if (t === 'route') drawRoute(ctx, d, o.progress);
  else if (t === 'marker') drawMarker(ctx, d);
  else if (t === 'bubble') drawBubble(ctx, d, o.caption);
  else drawWeek(ctx, d, o.progress);
};

/** The finished card as a PNG, drawn fresh at full size. */
export const renderCard = async (t: Template, d: ShareData, caption: string): Promise<Blob> => {
  await loadFonts();
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('No canvas');
  drawCard(ctx, t, d, { progress: 1, caption });
  return new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('No image'))), 'image/png'));
};
