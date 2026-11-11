import type { ISODate } from '@logbook/shared';
import { haptics } from '@/lib/haptics';
import { SEG_TONE_WAYFINDING, Segmented, Stepper } from '@/ui/primitives';
import { useSheet } from '@/ui/Sheet';
import { shortClock } from './dayWords';
import { afternoonStops, setAfternoon, type SessionKind, setTrainWhen, setTrainWhenDefault, useAfternoon, useTrainWhen, useTrainWhenDefault, type TrainWhen } from './trainWhen';

/** `said` is what VoiceOver reads for each segment (today-top-20: "No set time", not "No time"). */
const OPTS: Array<{ v: TrainWhen; label: string; said: string }> = [
  { v: 'morning', label: 'Morning', said: 'Morning' },
  { v: 'afternoon', label: 'Afternoon', said: 'Afternoon' },
  { v: 'none', label: 'No time', said: 'No set time' },
];

/**
 * Morning · Afternoon · No time: when this day's training happens, on the shared segmented control (guide 6.3: text only;
 * its thumb in the wayfinding tone, layout plan U6). No haptic on a segmented change, as every segmented control (contracts
 * §C.6); the card follows at once. Its taps stay its own: the hero under it opens the session.
 */
export const WhenPill = ({ date }: { date: ISODate }) => {
  const when = useTrainWhen(date);
  return (
    <div className="hero-when" onClick={(e) => e.stopPropagation()}>
      <Segmented
        label="When you train"
        tone={SEG_TONE_WAYFINDING}
        value={when}
        onChange={(v) => setTrainWhen(date, v)}
        options={OPTS.map(({ v, label, said }) => [
          v,
          <>
            <span aria-hidden="true">{label}</span>
            <span className="sr-only">{said}</span>
          </>,
        ])}
      />
    </div>
  );
};

const clockText = (m: number) => shortClock(m);

/**
 * A typed time for the end of work (today-top-22): `6`, `6:00`, `6.00`, `600`, `18:00`, `6 pm`, `6:30pm`. Without AM or PM an
 * hour before 11 is the afternoon's (work ends between 11:00 and 21:00). Null when it is not a time.
 */
export const parseOffWork = (t: string): number | null => {
  const m = /^\s*(\d{1,2})(?:[:.]?(\d{2}))?\s*([ap])?\.?\s*m?\.?\s*$/i.exec(t);
  if (!m) return null;
  let h = Number(m[1]);
  const min = m[2] ? Number(m[2]) : 0;
  if (h > 23 || min > 59) return null;
  const ap = m[3]?.toLowerCase();
  if (ap === 'p' && h < 12) h += 12;
  else if (ap === 'a' && h === 12) h = 0;
  else if (!ap && h < 11) h += 12;
  return h * 60 + min;
};
const minutesOf = (t: string) => (Number.isFinite(parseInt(t, 10)) ? parseInt(t, 10) : /^\s*none\s*$/i.test(t) ? 0 : null);
const NUMERIC = { inputMode: 'numeric', autoComplete: 'off', enterKeyHint: 'done' } as const;

/** The afternoon's settings: when work ends, the way home, changing, after the session, the default for new days, and the line they make. */
export const AfternoonSheet = ({ minutes, kind }: { minutes: number; kind?: SessionKind | null }) => {
  const pm = useAfternoon();
  const def = useTrainWhenDefault();
  const sheet = useSheet();
  const stops = afternoonStops(pm, minutes, kind);
  return (
    <div className="pm-sheet">
      <p className="pm-line">
        {stops.map((s) => (
          <span key={s.key}>
            {/* the summary's labels stay on one line: `Off` here, `Off work` on the card's line */}
            <small>{s.key === 'off' ? 'Off' : s.label}</small>
            <b>{clockText(s.at)}</b>
          </span>
        ))}
      </p>
      <label className="pm-row">
        <span>Off work</span>
        <Stepper value={pm.offWork} onChange={(v) => setAfternoon({ offWork: v })} step={15} min={11 * 60} max={21 * 60} format={clockText} parse={parseOffWork} label="Off work" inputProps={NUMERIC} />
      </label>
      <label className="pm-row">
        <span>Way home</span>
        <Stepper value={pm.commute} onChange={(v) => setAfternoon({ commute: v })} step={5} min={0} max={120} format={(v) => (v ? `${v} min` : 'None')} parse={minutesOf} label="Way home in minutes" inputProps={NUMERIC} />
      </label>
      {/* the minutes between getting home and the start, said and changeable (they were a hidden 10) */}
      <label className="pm-row">
        <span>Changing</span>
        <Stepper value={pm.change} onChange={(v) => setAfternoon({ change: v })} step={5} min={0} max={30} format={(v) => (v ? `${v} min` : 'None')} parse={minutesOf} label="Minutes to change" inputProps={NUMERIC} />
      </label>
      <label className="pm-row">
        <span>After the session</span>
        <Stepper value={pm.after} onChange={(v) => setAfternoon({ after: v })} step={5} min={0} max={90} format={(v) => `${v} min`} parse={minutesOf} label="Minutes after the session" inputProps={NUMERIC} />
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
              aria-label={v === 'none' ? 'No set time' : undefined}
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
