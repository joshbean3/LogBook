/** What a habit's mark is: a letter (set in the italic serif), a digit (upright, so a 1 is not read as a slash) or an emoji (upright, whole). */
export type InitialKind = 'letter' | 'digit' | 'emoji';

const EMOJI = /\p{Extended_Pictographic}|\p{Regional_Indicator}|️|⃣/u;

/** The first character of a name as a person sees it: a whole emoji (never half of one), a letter with its accent. */
export const firstGrapheme = (name: string): string => {
  const v = name.trim();
  if (!v) return '';
  try {
    for (const g of new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(v)) return g.segment;
  } catch {
    /* no Segmenter: the first code point (whole, where a slice would cut a surrogate pair) */
  }
  return Array.from(v)[0] ?? '';
};

/** A habit's mark in its ring: the first grapheme of its name, and how to set it. */
export const initialOf = (name: string): { text: string; kind: InitialKind } => {
  const text = firstGrapheme(name);
  return { text, kind: EMOJI.test(text) ? 'emoji' : /^\p{Nd}/u.test(text) ? 'digit' : 'letter' };
};

/** The name among `names` that `name` repeats (case and outer spaces aside), as it is written there; null when it is new. */
export const sameName = (name: string, names: readonly string[]): string | null => {
  const v = name.trim().toLowerCase();
  return v ? (names.find((n) => n.trim().toLowerCase() === v) ?? null) : null;
};
