import { CloudSun, Minus, Sunrise } from 'lucide-react';
import type { ISODate } from '@logbook/shared';
import { haptics } from '@/lib/haptics';
import { Pressable } from '@/ui/Pressable';
import { Stepper } from '@/ui/primitives';
import { useSheet } from '@/ui/Sheet';
import { shortClock } from './dayWords';
import { afternoonStops, setAfternoon, setTrainWhen, setTrainWhenDefault, useAfternoon, useTrainWhen, useTrainWhenDefault, type TrainWhen } from './trainWhen';

const OPTS: Array<{ v: TrainWhen; label: string; Icon: typeof Sunrise }> = [
  { v: 'morning', label: 'Morning', Icon: Sunrise },
  { v: 'afternoon', label: 'Afternoon', Icon: CloudSun },
  { v: 'none', label: 'No time', Icon: Minus },
];

/** Morning · Afternoon · No time: when this day's training happens. A selection tick on change; the card follows at once. */
export const WhenPill = ({ date }: { date: ISODate }) => {
  const when = useTrainWhen(date);
  return (
    <div className="hero-when" role="radiogroup" aria-label="When you train">
      {OPTS.map(({ v, label, Icon }) => (
        <Pressable
          key={v}
          className={`hero-when-opt ${when === v ? 'on' : ''}`}
          press="dim"
          role="radio"
          aria-checked={when === v}
          label={`Train ${label.toLowerCase()}`}
          onPress={(e) => {
            e.stopPropagation();
            if (v === when) return;
            haptics.select();
            setTrainWhen(date, v);
          }}
        >
          <Icon size={13} strokeWidth={2.4} aria-hidden="true" />
          {label}
        </Pressable>
      ))}
    </div>
  );
};

const clockText = (m: number) => shortClock(m);

/** The afternoon's settings: when work ends and the way home, the default for new days, and the line they make. */
export const AfternoonSheet = ({ minutes }: { minutes: number }) => {
  const pm = useAfternoon();
  const def = useTrainWhenDefault();
  const sheet = useSheet();
  const stops = afternoonStops(pm, minutes);
  return (
    <div className="pm-sheet">
      <p className="pm-line">
        {stops.map((s) => (
          <span key={s.key}>
            <small>{s.label}</small>
            <b>{clockText(s.at)}</b>
          </span>
        ))}
      </p>
      <label className="pm-row">
        <span>Off work</span>
        <Stepper value={pm.offWork} onChange={(v) => setAfternoon({ offWork: v })} step={15} min={11 * 60} max={21 * 60} format={clockText} parse={() => null} label="Off work" />
      </label>
      <label className="pm-row">
        <span>Way home</span>
        <Stepper value={pm.commute} onChange={(v) => setAfternoon({ commute: v })} step={5} min={0} max={120} format={(v) => (v ? `${v} min` : 'None')} parse={(t) => (Number.isFinite(parseInt(t, 10)) ? parseInt(t, 10) : null)} label="Way home in minutes" />
      </label>
      <label className="pm-row">
        <span>After the run</span>
        <Stepper value={pm.after} onChange={(v) => setAfternoon({ after: v })} step={5} min={0} max={90} format={(v) => `${v} min`} parse={(t) => (Number.isFinite(parseInt(t, 10)) ? parseInt(t, 10) : null)} label="Minutes after the run" />
      </label>
      <div className="pm-row pm-default">
        <span>New days start as</span>
        <div className="pm-seg" role="radiogroup" aria-label="Default training time">
          {OPTS.map(({ v, label }) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={def === v}
              className={def === v ? 'on' : ''}
              onClick={() => {
                if (def !== v) haptics.select();
                setTrainWhenDefault(v);
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <button type="button" className="btn primary block" onClick={() => sheet.close()}>
        Done
      </button>
    </div>
  );
};
