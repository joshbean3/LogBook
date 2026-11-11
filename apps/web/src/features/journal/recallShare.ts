import { ART, CAPTION, drawGrain, drawLockup, loadMark, SERIF } from '../share/brandArt';

/**
 * "Remember when" as a card to keep or send: drawn on a canvas (Linen and grain, the Haze header, the words in the Fraunces italic, the date)
 * and saved as a PNG, or copied as text. The canvas work is in the browser; the line breaking is pure and tested.
 */

/** A word wider than a line, cut by characters into pieces that each fit (the last piece is what is left). */
const breakWord = (w: string, max: number, measure: (s: string) => number): string[] => {
  const out: string[] = [];
  let cur = '';
  for (const ch of Array.from(w)) {
    if (cur && measure(cur + ch) > max) {
      out.push(cur);
      cur = ch;
    } else cur += ch;
  }
  if (cur) out.push(cur);
  return out;
};

/** Break words into lines no wider than `max`; a word wider than a line is broken by characters (a pasted link, say). */
export const wrapLines = (text: string, max: number, measure: (s: string) => number): string[] => {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = '';
  for (const w0 of words) {
    const pieces = measure(w0) > max ? breakWord(w0, max, measure) : [w0];
    for (const [i, w] of pieces.entries()) {
      const next = cur ? `${cur} ${w}` : w;
      if (cur && (i > 0 || measure(next) > max)) {
        lines.push(cur);
        cur = w;
      } else cur = next;
    }
  }
  if (cur) lines.push(cur);
  return lines;
};

/** At most `n` lines; when some are left out the last one kept ends in an ellipsis that fits. */
export const clampLines = (lines: string[], n: number, max: number, measure: (s: string) => number): string[] => {
  if (lines.length <= n) return lines;
  const kept = lines.slice(0, n);
  let last = kept[n - 1]!;
  while (last && measure(`${last}…`) > max) last = last.slice(0, -1);
  kept[n - 1] = `${last.trimEnd()}…`;
  return kept;
};

/** The words as they are copied: the reminder, then where it came from. */
export const recallText = (summary: string, when: string) => `${summary}\n\nRemember when · ${when}`;

const W = 1080;
const H = 1350;
const PAD = 96;

/** The card as a PNG: 1080 by 1350, the size a phone keeps and shares as a photo. A light brand surface (plan 2.5): Linen
 *  with paper grain, a Paper card with its edge, the in-app card's Haze wash at the top, the reminder in the Fraunces
 *  italic, and the Orby lockup at the foot. */
export const drawRecall = async (summary: string, when: string): Promise<Blob> => {
  try {
    await Promise.all([document.fonts.load('italic 64px "Fraunces Card"'), document.fonts.load('600 30px "Inter Tight"'), loadMark('ink')]);
  } catch {
    /* the fallbacks draw it */
  }
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  if (!g) throw new Error('No canvas');
  // the page: Linen with grain, and the card on it
  g.fillStyle = ART.linen;
  g.fillRect(0, 0, W, H);
  drawGrain(g, W, H);
  const x = 56;
  const y = 56;
  const cw = W - 2 * x;
  const ch = H - 2 * y;
  const r = 48;
  g.save();
  g.beginPath();
  g.roundRect(x, y, cw, ch, r);
  g.clip();
  g.fillStyle = ART.paper;
  g.fillRect(x, y, cw, ch);
  // the header: the Haze wash settling into the Paper, as the card is drawn in the app
  const hh = 300;
  const head = g.createLinearGradient(0, y, 0, y + hh);
  head.addColorStop(0, ART.haze);
  head.addColorStop(1, ART.paper);
  g.fillStyle = head;
  g.fillRect(x, y, cw, hh);
  g.restore();
  // Paper on Linen gets the 1 px edge (guide 5.4), drawn at the card's scale
  g.save();
  g.strokeStyle = ART.edge;
  g.lineWidth = 3;
  g.beginPath();
  g.roundRect(x, y, cw, ch, r);
  g.stroke();
  g.restore();
  // the caption: Inter Tight 600, caps, +0.14 em, Dusk
  g.fillStyle = ART.dusk;
  g.font = `600 30px ${CAPTION}`;
  if ('letterSpacing' in g) (g as unknown as { letterSpacing: string }).letterSpacing = '4.2px';
  g.fillText(`REMEMBER WHEN · ${when.toUpperCase()}`, x + PAD - 40, y + 120);
  if ('letterSpacing' in g) (g as unknown as { letterSpacing: string }).letterSpacing = '0px';
  // the words, as large as they fit
  let size = 92;
  let lines: string[] = [];
  const maxW = cw - 2 * (PAD - 40);
  const room = ch - hh - 220;
  const measure = (t: string) => g.measureText(t).width;
  for (; size >= 44; size -= 4) {
    g.font = `italic 400 ${size}px ${SERIF}`;
    lines = wrapLines(summary, maxW, measure);
    if (lines.length * size * 1.25 < room) break;
  }
  // still too long at the smallest size: as many lines as fit, the last one ending in an ellipsis
  if (size < 44) {
    size = 44;
    g.font = `italic 400 ${size}px ${SERIF}`;
    lines = clampLines(lines, Math.max(1, Math.floor(room / (size * 1.25))), maxW, measure);
  }
  g.fillStyle = ART.nightInk;
  const lh = size * 1.25;
  let ty = y + hh + 90 + size;
  for (const l of lines) {
    g.fillText(l, x + PAD - 40, ty);
    ty += lh;
  }
  // where it was kept: the Orby lockup, the flat Orb and the outlined wordmark in Night Ink (never canvas text)
  drawLockup(g, 'ink', x + PAD - 40, y + ch - 72, 228);
  return new Promise((ok, no) => c.toBlob((b) => (b ? ok(b) : no(new Error('No image'))), 'image/png'));
};
