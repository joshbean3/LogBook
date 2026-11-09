export type Pt = readonly [number, number];

/**
 * A monotone cubic through the points (Fritsch and Carlson, as d3's curveMonotoneX): smooth, and it never swings past
 * its neighbours, so a line of miles never dips under zero or bulges over a peak it does not have. Points go left to right.
 */
export const monotonePath = (p: readonly Pt[]): string => {
  const n = p.length;
  if (!n) return '';
  const f = (v: number) => v.toFixed(1);
  if (n === 1) return `M${f(p[0]![0])},${f(p[0]![1])}`;
  const dx: number[] = [];
  const m: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx[i] = p[i + 1]![0] - p[i]![0];
    m[i] = (p[i + 1]![1] - p[i]![1]) / (dx[i] || 1);
  }
  // tangents: the mean of the secants either side, flat at a turn
  const t: number[] = new Array(n);
  t[0] = m[0]!;
  t[n - 1] = m[n - 2]!;
  for (let i = 1; i < n - 1; i++) t[i] = m[i - 1]! * m[i]! <= 0 ? 0 : (m[i - 1]! + m[i]!) / 2;
  // and reined in where they would overshoot
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) {
      t[i] = 0;
      t[i + 1] = 0;
      continue;
    }
    const a = t[i]! / m[i]!;
    const b = t[i + 1]! / m[i]!;
    const s = a * a + b * b;
    if (s > 9) {
      const k = 3 / Math.sqrt(s);
      t[i] = k * a * m[i]!;
      t[i + 1] = k * b * m[i]!;
    }
  }
  let d = `M${f(p[0]![0])},${f(p[0]![1])}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i]! / 3;
    d += `C${f(p[i]![0] + h)},${f(p[i]![1] + t[i]! * h)} ${f(p[i + 1]![0] - h)},${f(p[i + 1]![1] - t[i + 1]! * h)} ${f(p[i + 1]![0])},${f(p[i + 1]![1])}`;
  }
  return d;
};
