/**
 * The ticks by the mile (guide 6.5): a minor tick every 0.5 mi, a major every 5 mi; above a 30 mi plan a minor every mile;
 * never more than 60 (a longer plan steps the minor up again). With no plan, the week's own miles set the scale.
 */
export const gaugeTicks = (miles: number): { t: number; major: boolean }[] => {
  const span = miles > 0 ? miles : 0;
  if (span <= 0) return [];
  let step = span > 30 ? 1 : 0.5;
  while (span / step > 60) step *= 2;
  const out: { t: number; major: boolean }[] = [];
  const n = Math.floor(span / step + 1e-6);
  for (let i = 0; i <= n; i++) {
    const m = i * step;
    out.push({ t: m / span, major: Math.abs(m / 5 - Math.round(m / 5)) < 1e-6 });
  }
  return out;
};
