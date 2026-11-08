/**
 * "Remember when" as a card to keep or send: drawn on a canvas (the soft Columbia header, the words in the serif, the date)
 * and saved as a PNG, or copied as text. The canvas work is in the browser; the line breaking is pure and tested.
 */

/** Break words into lines no wider than `max` (a word longer than a line gets a line of its own). */
export const wrapLines = (text: string, max: number, measure: (s: string) => number): string[] => {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (cur && measure(next) > max) {
      lines.push(cur);
      cur = w;
    } else cur = next;
  }
  if (cur) lines.push(cur);
  return lines;
};

/** The words as they are copied: the reminder, then where it came from. */
export const recallText = (summary: string, when: string) => `${summary}\n\nRemember when · ${when}`;

const W = 1080;
const H = 1350;
const PAD = 96;

/** The card as a PNG: 1080 by 1350, the size a phone keeps and shares as a photo. */
export const drawRecall = async (summary: string, when: string): Promise<Blob> => {
  try {
    await Promise.all([document.fonts.load('italic 64px "Instrument Serif"'), document.fonts.load('600 30px Inter')]);
  } catch {
    /* the fallbacks draw it */
  }
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  if (!g) throw new Error('No canvas');
  // the page, a whisper of Columbia, and the card on it
  g.fillStyle = '#f3f8fb';
  g.fillRect(0, 0, W, H);
  const x = 56;
  const y = 56;
  const cw = W - 2 * x;
  const ch = H - 2 * y;
  const r = 48;
  g.save();
  g.beginPath();
  g.roundRect(x, y, cw, ch, r);
  g.clip();
  g.fillStyle = '#ffffff';
  g.fillRect(x, y, cw, ch);
  // the soft Columbia header, lit from below like the app's halo
  const hh = 300;
  const head = g.createLinearGradient(0, y, 0, y + hh);
  head.addColorStop(0, '#b9d9eb');
  head.addColorStop(1, '#e8f3f9');
  g.fillStyle = head;
  g.fillRect(x, y, cw, hh);
  const glow = g.createRadialGradient(W / 2, y + hh + 40, 10, W / 2, y + hh + 40, 520);
  glow.addColorStop(0, 'rgba(255,255,255,0.9)');
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = glow;
  g.fillRect(x, y, cw, hh);
  g.restore();
  // the caps line
  g.fillStyle = '#2f5d85';
  g.font = '600 30px Inter, -apple-system, sans-serif';
  if ('letterSpacing' in g) (g as unknown as { letterSpacing: string }).letterSpacing = '4px';
  g.fillText(`REMEMBER WHEN · ${when.toUpperCase()}`, x + PAD - 40, y + 120);
  if ('letterSpacing' in g) (g as unknown as { letterSpacing: string }).letterSpacing = '0px';
  // the words, as large as they fit
  let size = 92;
  let lines: string[] = [];
  const maxW = cw - 2 * (PAD - 40);
  for (; size >= 44; size -= 4) {
    g.font = `italic ${size}px "Instrument Serif", Georgia, serif`;
    lines = wrapLines(summary, maxW, (s) => g.measureText(s).width);
    if (lines.length * size * 1.25 < ch - hh - 220) break;
  }
  g.fillStyle = '#0f2a44';
  const lh = size * 1.25;
  let ty = y + hh + 90 + size;
  for (const l of lines) {
    g.fillText(l, x + PAD - 40, ty);
    ty += lh;
  }
  // the mark of where it was kept
  g.fillStyle = '#5e7891';
  g.font = 'italic 40px "Instrument Serif", Georgia, serif';
  g.fillText('Logbook', x + PAD - 40, y + ch - 72);
  return new Promise((ok, no) => c.toBlob((b) => (b ? ok(b) : no(new Error('No image'))), 'image/png'));
};

/** Keep the image: the share sheet where it takes files (a phone saves it to Photos from there), else a download. */
export const saveImage = async (blob: Blob, name: string): Promise<'shared' | 'downloaded' | 'cancelled'> => {
  const file = new File([blob], name, { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return 'shared';
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled';
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return 'downloaded';
};
