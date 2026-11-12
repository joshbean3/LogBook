import { fmtDate, monthsBetween, shiftDays } from '@logbook/shared';
import { useMemo, useState } from 'react';
import { RANGE_KEYS, RANGE_NAMES, RangeControl, rangeWindow, TrendChart, windowLabel, type RangeKey } from '@/ui/charts';
import { useMedia } from '@/lib/useToday';
import { useLog } from '../log/useLog';
import { HABIT_RANGE, habitsAt, habitsHead, habitsHeadWords, habitsSeries, type HabitsHead } from './habitsHead';
import { buildMetric, habitsDef, HISTORY_DAYS } from './metrics';
import { useMetricSource } from './useMetrics';
import './metric.css';
import './fitness.css';

const Head = ({ h }: { h: HabitsHead }) => (
  <div className="hc-head">
    <span className="sr-only">{habitsHeadWords(h)}</span>
    <span className="hc-big" aria-hidden="true">
      <span className="tnum">{h.big}</span>
      <small>{h.context}</small>
    </span>
    <span className="hc-take" aria-hidden="true">
      {h.take}
    </span>
  </div>
);

/**
 * How the habits are going, as one card at the top of History (Today, Habits, History): the share of habits done, as a
 * 7-day average, over 30 days, 3, 6 or 12 months. The headline is the readout: drag across the line and it says that
 * day; let go and it says the latest share and the range's average. It is the chart the Habits metric page drew, moved
 * to where habits live, so a person with Fitness off still has it. Before any habit has been tapped there is no card.
 */
export const HabitsChart = () => {
  const [range, setRange] = useState<RangeKey>(HABIT_RANGE);
  const t = useLog([]).today;
  const window = rangeWindow(t, range);
  // the window, the 90 days its usual range is built from, and the rolling week before that (as the metric page reads)
  const start = useMemo(() => {
    const a = shiftDays(window.from, -(90 + 28));
    const b = shiftDays(t, -(HISTORY_DAYS + 28));
    return a < b ? a : b;
  }, [window.from, t]);
  const months = useMemo(() => monthsBetween(start, t), [start, t]);
  const log = useLog(months);
  const src = useMetricSource(log, start);
  const m = useMemo(() => buildMetric(habitsDef(), 'habits', src, window), [src, window.from, window.to]); // eslint-disable-line react-hooks/exhaustive-deps
  const narrow = useMedia('(max-width: 374px)');
  const rest = habitsHead(m, range);
  if (!rest) return null;
  const v = m.variant;
  // habits younger than the range draw from their first day
  const drawn = habitsSeries(m);
  return (
    <section className="card hc" aria-label="Habits done">
      <TrendChart
        className="hc-chart"
        label={`${v.lineName}, ${windowLabel(window, t)}. ${habitsHeadWords(rest)}`}
        line={drawn.line}
        band={m.band}
        // a share reads on a 0 to 100 axis
        domain={[0, 100]}
        avg={m.avg ? m.avg : null}
        labels={drawn.dates.map((d) => fmtDate('md', d))}
        format={v.axis}
        zero
        steps={v.steps}
        fill
        height={narrow ? 140 : 160}
        readout={(i) => <Head h={i == null ? rest : habitsAt(drawn, i)} />}
      />
      <RangeControl className="mp-range" value={range} options={RANGE_KEYS} words={RANGE_NAMES} onChange={setRange} label="Range" />
    </section>
  );
};
