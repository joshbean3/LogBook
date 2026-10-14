import { clock, decodePolyline, fmtDate, mi, mondayOf, routePath, shiftDays, today, type ISODate } from '@logbook/shared';

/** A 1080×1920 story card drawn on black: the Aura idea, in Logbook's hand. */
export type Template = 'stamp' | 'route' | 'marker' | 'day' | 'bubble' | 'week';
export const TEMPLATES: readonly Template[] = ['stamp', 'route', 'marker', 'day', 'bubble', 'week'];
export const TEMPLATE_NAME: Record<Template, string> = { stamp: 'Stamp', route: 'Route', marker: 'Marker', day: 'Day', bubble: 'Bubble', week: 'Week' };
/** How long the card takes to settle the first time it shows (0 = still). */
export const DRAW_MS: Record<Template, number> = { stamp: 600, route: 1100, marker: 0, day: 0, bubble: 0, week: 600 };

/**
 * What kind of day is being shared, which picks the cards: a run (its numbers), a lift (sets), a rest day, or a day with
 * words and no training. A card never prints a zero or a dash: a row with nothing to say is left out.
 */
export type ShareDayType = 'run' | 'lift' | 'rest' | 'journal';

export interface ShareDay {
  date: ISODate;
  miles: number;
}
export interface ShareData {
  /** The run's name ("Morning Run"), or the plan's label when there is no single activity. */
  name: string;
  /** The plan's label ("Easy 6"); null when the run was unplanned. */
  label: string | null;
  /** The day's verdict in the brand voice: "Floor held." / "Easy 6, done." / "6.0 mi, off the plan." The Bubble's default line. */
  verdict: string;
  date: ISODate;
  /** `HH:MM` start, when the run carries one. */
  time: string | null;
  miles: number;
  movingSec: number;
  elevFt: number;
  avgHr: number | null;
  polyline: string | null;
  week: { monday: ISODate; days: ShareDay[]; total: number; planned: number } | null;
  /** The kind of day (default: a run when it has miles, else rest). */
  dayType?: ShareDayType;
  /** Habits lit that day, when there are habits. */
  habits?: { lit: number; of: number } | null;
  /** The day's own words: its latest journal entry, cut to fit. */
  journal?: string | null;
  /** A lift day: how many sets, and the best one ("Squat 225 × 5"). */
  lift?: { sets: number; top: string | null } | null;
}

/** The day type, read from the data (old callers set none). */
export const dayTypeOf = (d: ShareData): ShareDayType => d.dayType ?? (d.miles > 0 ? 'run' : 'rest');

/**
 * The cards a day gets, its lead card first: a run gets its numbers (Stamp, Route when there is a line, Marker); any other
 * day gets the Day card. The Bubble says the day's line; the Week card only comes when the week has miles in it.
 */
export const templatesFor = (d: ShareData): Template[] => {
  const type = dayTypeOf(d);
  const out: Template[] = type === 'run' && d.miles > 0 ? ['stamp', ...(d.polyline ? (['route'] as const) : []), 'marker'] : ['day'];
  out.push('bubble');
  if (d.week && d.week.total > 0) out.push('week');
  return out;
};
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
const SERIF = '"Instrument Serif", "Iowan Old Style", Georgia, serif';
const STAMP = '"Inter Tight", "Inter", -apple-system, sans-serif';
const SANS = '"Inter", -apple-system, sans-serif';

// ---------- fonts: the card waits for the bundled faces, never paints a fallback ----------
const FACES = ['italic 400 80px "Instrument Serif"', 'italic 400 160px "Instrument Serif"', '900 200px "Inter Tight"', '800 100px "Inter Tight"', '700 100px "Inter"', '600 40px "Inter"', '500 40px "Inter"'];
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

/** The Bubble says what the day said: the verdict, in the brand voice. Falls back to the distance when there is none. */
export const defaultCaption = (d: ShareData): string => d.verdict.trim() || (d.miles > 0 ? `${mi(d.miles)} mi.` : 'Rest. It counts.');

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
/** Date in caps at 32 and the name in the italic serif, up to two lines: the top-left of every single-run card. */
const HEAD_DATE_Y = 300;
const HEAD_NAME = 112;
/** On Stamp and Route the name is the hero. */
const HERO_NAME = 160;
const serifAt = (size: number) => `italic 400 ${size}px ${SERIF}`;
/** Draws the heading; returns the baseline of the name's last line so what follows can clear a two-line name. */
const heading = (ctx: CanvasRenderingContext2D, d: ShareData, size = HEAD_NAME): number => {
  caps(ctx, fmtDate('long', d.date), M, HEAD_DATE_Y, 32);
  const max = W - M * 2;
  // the name steps down a size at a time, to 96 at the smallest, until it fits two lines with no word wider than the card
  const fits = (f: string) => {
    ctx.font = f;
    return d.name.split(/\s+/).every((w) => ctx.measureText(w).width <= max) && wrap(ctx, d.name, f, max).length <= 2;
  };
  let sz = size;
  while (sz > 96 && !fits(serifAt(sz))) sz -= 8;
  const font = serifAt(sz);
  const lineH = Math.round(sz * 1.05);
  const all = wrap(ctx, d.name, font, max);
  const lines = all.slice(0, 2);
  // a name that still needs a third line at 96 ends the second with an ellipsis
  if (all.length > 2) {
    ctx.font = font;
    let l = lines[1]!;
    while (l.length > 1 && ctx.measureText(`${l}…`).width > max) l = l.slice(0, -1).trimEnd();
    lines[1] = `${l}…`;
  }
  const y0 = HEAD_DATE_Y + sz;
  lines.forEach((l, i) => text(ctx, l, M, y0 + i * lineH, { font, color: WHITE }));
  return y0 + (lines.length - 1) * lineH;
};

// ---------- 1. STAMP: three numerals stacked, labels above ----------
const drawStamp = (ctx: CanvasRenderingContext2D, d: ShareData, p: number) => {
  ground(ctx);
  const nameY = heading(ctx, d, HERO_NAME);
  const e = easeOut(p);
  // a run logged by hand has no clock: its pace and time rows are left out, never stamped as zeros
  const timed = d.movingSec > 0 && d.miles > 0.1;
  const rows: Array<[string, string, string | null]> = [
    ['Distance', mi2(d.miles * e), 'mi'],
    ...(timed
      ? ([
          ['Pace', paceStamp(d.movingSec * e, d.miles * e), null],
          ['Time', clock(d.movingSec * e), null],
        ] as Array<[string, string, string | null]>)
      : []),
  ];
  // the first label clears the name's descenders; the last numeral lands at 1600, above the foot line at 1700
  const size = rows.length > 1 ? 200 : 280;
  // one row (a run logged by hand) stands in the middle of the card, not stranded under the name
  const first = rows.length > 1 ? nameY + 150 : Math.max(nameY + 150, 820);
  const step = rows.length > 1 ? (1600 - size - first) / (rows.length - 1) : 0;
  rows.forEach(([k, v, u], i) => {
    const y = Math.round(first + i * step);
    caps(ctx, k, M, y);
    stamp(ctx, v, u, M, y + size, size);
  });
  const foot: string[] = [];
  if (!timed) foot.push('Logged');
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
  const nameY = heading(ctx, d, HERO_NAME);
  // the line takes whatever room is left between the name and the stats, so a two-line name never touches it
  const top = nameY + 70;
  const bottom = 1230;
  if (d.polyline) drawRouteLine(ctx, routePoints(d.polyline, 840, bottom - top), 120, top, p);
  const timed = d.movingSec > 0 && d.miles > 0.1;
  const cells: Array<[string, string, string | null]> = [
    ['Distance', mi2(d.miles), 'mi'],
    ...(timed
      ? ([
          ['Pace', paceStamp(d.movingSec, d.miles), null],
          ['Time', clock(d.movingSec), null],
        ] as Array<[string, string, string | null]>)
      : []),
    ...(d.avgHr != null ? ([['Avg HR', String(d.avgHr), 'bpm']] as Array<[string, string, string | null]>) : d.elevFt > 0 ? ([['Elev', String(Math.round(d.elevFt)), 'ft']] as Array<[string, string, string | null]>) : []),
  ];
  cells.forEach(([k, v, u], i) => {
    const x = M + (i % 2) * 440;
    const y = 1320 + Math.floor(i / 2) * 176;
    caps(ctx, k, x, y, 26);
    stamp(ctx, v, u, x, y + 104, 96);
  });
  wordmark(ctx);
};

// ---------- 3. MARKER: the sentence, highlighted in white; black type on white bars, the one card that inverts ----------
const drawMarker = (ctx: CanvasRenderingContext2D, d: ShareData) => {
  ground(ctx, 0.7);
  const nameY = heading(ctx, d);
  const timed = d.movingSec > 0 && d.miles > 0.1;
  const parts = [`${mi2(d.miles)} miles`, ...(timed ? [`${paceColon(d.movingSec, d.miles)}/mi`, clock(d.movingSec)] : [])];
  const lines = parts.map((l, i) => (i < parts.length - 1 ? `${l},` : l));
  const size = 128;
  const font = `700 ${size}px ${SANS}`;
  const barH = 168;
  const gap = 24;
  const total = lines.length * barH + (lines.length - 1) * gap;
  let y = Math.max(1000 - total / 2, nameY + 110);
  for (const line of lines) {
    const w = measure(ctx, line, { font, color: '#000', tracking: -size * 0.02 });
    ctx.fillStyle = WHITE;
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
  const nameY = heading(ctx, d);
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
  const by = Math.max(900 - bh / 2, nameY + 110);
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
  // the numbers under the bubble: only the ones the day has (a rest day has none, a logged run only its miles)
  const sy = by + bh + 150;
  const cells: Array<[string, string]> = [];
  if (d.miles > 0) cells.push([`${mi2(d.miles)} MI`, 'distance']);
  if (d.miles > 0.1 && d.movingSec > 0) cells.push([paceStamp(d.movingSec, d.miles), 'pace'], [clock(d.movingSec), 'time']);
  if (!cells.length && d.lift?.sets) cells.push([`${d.lift.sets} SETS`, 'lifted']);
  if (!cells.length && d.habits?.lit) cells.push([`${d.habits.lit} OF ${d.habits.of}`, 'habits lit']);
  if (cells.length) {
    text(ctx, cells.map((c) => c[0]).join('  ·  '), W / 2, sy, { font: `800 56px ${STAMP}`, color: WHITE, align: 'center', tracking: -56 * 0.03 });
    caps(ctx, cells.map((c) => c[1]).join('  ·  '), W / 2, sy + 48, 24, INK3, 'center');
  }
  wordmark(ctx);
};

// ---------- 4b. DAY: a day that isn't a run, said in what it had (sets, habits lit, its words) ----------
const drawDay = (ctx: CanvasRenderingContext2D, d: ShareData) => {
  ground(ctx, 0.8);
  const nameY = heading(ctx, d, HERO_NAME);
  let y = nameY + 170;
  // the stamped facts first, each a caps label over a numeral; only the ones the day has
  const facts: Array<[string, string, string | null, string | null]> = [];
  if (d.lift?.sets) facts.push(['Lifted', String(d.lift.sets), d.lift.sets === 1 ? 'set' : 'sets', d.lift.top]);
  if (d.habits && d.habits.lit > 0) facts.push(['Habits', d.habits.lit === d.habits.of ? 'All' : `${d.habits.lit}`, d.habits.lit === d.habits.of ? 'lit' : `of ${d.habits.of} lit`, null]);
  for (const [k, v, u, note] of facts) {
    caps(ctx, k, M, y);
    stamp(ctx, v, u, M, y + 176, 176);
    y += 176 + 40;
    if (note) {
      text(ctx, note, M, y + 20, { font: `600 44px ${SANS}`, color: INK2 });
      y += 70;
    }
    y += 70;
  }
  // then the day's line, in the serif: its own words, or the verdict ("Rest. It counts.")
  const line = (d.journal?.trim() || d.verdict.trim() || '').slice(0, 160);
  if (line) {
    const size = facts.length ? 72 : 96;
    const font = serifAt(size);
    const maxLines = Math.max(1, Math.floor((1600 - y) / (size * 1.18)));
    const all = wrap(ctx, d.journal ? `“${line}”` : line, font, W - M * 2);
    const lines = all.slice(0, Math.min(maxLines, 6));
    if (all.length > lines.length) lines[lines.length - 1] = `${lines[lines.length - 1]!.replace(/[,.;:”]?$/, '')}…`;
    lines.forEach((l, i) => text(ctx, l, M, y + size + i * size * 1.18, { font, color: facts.length ? INK2 : WHITE }));
  }
  wordmark(ctx);
};

// ---------- 5. WEEK: seven small stamps and the total ----------
/** "This week" only for the week we are in; any other week is its dates, "Sep 7 – 13" or "Sep 28 – Oct 4". */
export const weekTitle = (monday: ISODate, now: ISODate = today()): string => {
  if (monday === mondayOf(now)) return 'This week';
  const sunday = shiftDays(monday, 6);
  const sameMonth = monday.slice(0, 7) === sunday.slice(0, 7);
  return `${fmtDate('md', monday)} – ${sameMonth ? Number(sunday.slice(8, 10)) : fmtDate('md', sunday)}`;
};
const drawWeek = (ctx: CanvasRenderingContext2D, d: ShareData, p: number) => {
  ground(ctx);
  const wk = d.week;
  const e = easeOut(p);
  const monday = wk?.monday ?? mondayOf(d.date);
  caps(ctx, 'Week', M, HEAD_DATE_Y, 32);
  text(ctx, weekTitle(monday), M, HEAD_DATE_Y + HEAD_NAME * 1.1, { font: serifAt(HEAD_NAME), color: WHITE });
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
    // a day with no miles keeps its stub of a bar and says nothing: never a dash or a zero
    if (day.miles) text(ctx, mi(day.miles), cx, barBottom + 74, { font: `800 52px ${STAMP}`, color: WHITE, align: 'center', tracking: -52 * 0.03 });
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
  else if (t === 'day') drawDay(ctx, d);
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
