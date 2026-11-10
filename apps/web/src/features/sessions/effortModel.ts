/**
 * The effort check-in's words (docs/inspiration.md §3 "Effort dial", §5): 1 to 10, each with a word and a plain line in
 * the talk-test's terms, so a number always says what it means ("6 · Steady: could talk in short sentences").
 */
export const EFFORT_MIN = 1;
export const EFFORT_MAX = 10;

export const EFFORT_WORDS: Record<number, { word: string; line: string }> = {
  1: { word: 'Very easy', line: 'Barely felt like work' },
  2: { word: 'Easy', line: 'Breathing through your nose' },
  3: { word: 'Easy', line: 'Could chat the whole way' },
  4: { word: 'Comfortable', line: 'Could hold a full conversation' },
  5: { word: 'Moderate', line: 'Talking took some effort' },
  6: { word: 'Steady', line: 'Could talk in short sentences' },
  7: { word: 'Hard', line: 'A few words at a time' },
  8: { word: 'Very hard', line: 'Could barely speak' },
  9: { word: 'Near max', line: 'Close to all out' },
  10: { word: 'All out', line: 'Nothing left at the end' },
};

/** A stored effort, or null when it is missing or out of range. */
export const effortOf = (v: unknown): number | null => (typeof v === 'number' && Number.isInteger(v) && v >= EFFORT_MIN && v <= EFFORT_MAX ? v : null);

/** "Steady" */
export const effortWord = (n: number): string => EFFORT_WORDS[n]?.word ?? '';
/** "6 · Steady: could talk in short sentences" */
export const effortLine = (n: number): string => {
  const w = EFFORT_WORDS[n];
  return w ? `${n} · ${w.word}: ${w.line.charAt(0).toLowerCase()}${w.line.slice(1)}` : '';
};

/**
 * The dial's ten colors: one sequential blue ramp, Haze at 1 by way of Sky (4) and Deep Sky (7) to Twilight at 10. Orange
 * is never a scale or a series (guide 3.5, 6.8); the number and its word carry the value, the color only rises with it.
 */
const EFFORT_COLORS = ['#cbe8f8', '#9ad7f6', '#69c7f4', '#38b6f2', '#299dd9', '#1985bf', '#0a6ca6', '#106094', '#155482', '#1b4870'] as const; // brand-ok: a sequential Haze, Sky, Deep Sky, Twilight ramp (guide 6.8: never orange for a series)
/** The dial's colour at `n` (rounded, held to 1–10). */
export const effortColor = (n: number): string => EFFORT_COLORS[Math.min(EFFORT_MAX, Math.max(EFFORT_MIN, Math.round(n))) - EFFORT_MIN]!;

/**
 * The dial's geometry: a 240° arc open at the bottom, 1 at its left end and 10 at its right. `valueAt` turns a point
 * (relative to the arc's centre, y down) into the nearest effort; null for a point in the gap under the dial.
 */
export const ARC_START = 150; // degrees, clockwise from +x (y down): lower left
export const ARC_SWEEP = 240;
export const valueAt = (dx: number, dy: number): number | null => {
  if (Math.hypot(dx, dy) < 1) return null;
  let a = (Math.atan2(dy, dx) * 180) / Math.PI; // -180..180, clockwise from +x since y points down
  if (a < 0) a += 360;
  let rel = a - ARC_START;
  if (rel < 0) rel += 360;
  if (rel > ARC_SWEEP) {
    // in the gap under the dial: the nearer end, so a drag past an end stays on it
    const past = rel - ARC_SWEEP;
    if (past < (360 - ARC_SWEEP) / 2) return EFFORT_MAX;
    return EFFORT_MIN;
  }
  const seg = ARC_SWEEP / (EFFORT_MAX - EFFORT_MIN + 1);
  return Math.min(EFFORT_MAX, EFFORT_MIN + Math.floor(rel / seg));
};
