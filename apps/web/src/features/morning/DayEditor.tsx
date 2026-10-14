import { MORNING_DEFAULTS, monthOf, num, TYPES, type MorningMode } from '@logbook/shared';
import { useMemo } from 'react';
import { useMorningMutations } from '@/api/queries';
import { haptics } from '@/lib/haptics';
import { Button, ChipButton, Segmented, Stepper } from '@/ui';
import { useSheet } from '@/ui/Sheet';
import { useLog } from '../log/useLog';
import { MiniLine } from './MiniLine';
import { morningOf, short, useRoutineOrder, type DayPatch } from './model';
import { WAKE_MAX, WAKE_MIN } from './Timeline';

const parseMiles = (s: string) => {
  const v = Number(s);
  return Number.isFinite(v) && v > 0 ? Math.round(v * 2) / 2 : null;
};
const parseInt10 = (s: string) => {
  const v = Math.round(Number(s));
  return Number.isFinite(v) ? v : null;
};
/** "7:15", "715" or "7": a morning hour, with or without minutes. */
export const parseWake = (raw: string) => {
  const s = raw.trim().toLowerCase().replace(/\s*(am|a)$/, '');
  const x = /^(\d{1,2})(?::?(\d{2}))?$/.exec(s);
  if (!x) return null;
  const h = Number(x[1]);
  const m = Number(x[2] ?? 0);
  return h <= 23 && m <= 59 ? h * 60 + m : null;
};
const fmtInt = (v: number) => String(v);

/**
 * One day's morning in a sheet: run, gym or rest; the kind of run or workout; the alarm; the miles or minutes. Every change
 * writes at once (as the drags on the timeline do), and the line at the top redraws to scale as it goes. It subscribes on its
 * own so it stays live while it is up.
 */
export const DayEditor = ({ date }: { date: string }) => {
  const sheet = useSheet();
  const log = useLog([monthOf(date)]);
  const order = useRoutineOrder();
  const st = log.boot?.morningSettings ?? MORNING_DEFAULTS;
  const T = useMemo(() => morningOf(log.snap.sessionsOn(date), log.snap.morningOverride(date), st, order), [log.snap, date, st, order]);
  const { setDay } = useMorningMutations();
  const day = T.day;
  const rest = day.mode === 'rest';
  const set = (patch: DayPatch) => setDay.mutate({ date, day: { mode: day.mode, type: day.type, miles: day.miles, minutes: day.minutes, wake: day.wake, ...patch } });
  // the type a mode starts with: the plan's own when it is the plan's mode, else the plain default
  const typeFor = (k: MorningMode) => (k === day.plan.mode ? day.plan.type : k === 'run' ? 'Easy' : k === 'gym' ? 'Strength' : 'Rest');
  const types = day.mode === 'run' ? TYPES.run.filter((x) => x !== 'Run') : TYPES.lift;
  return (
    <div className="m-ed">
      <MiniLine T={T} bar />
      <Segmented className="m-ed-mode" label="Run, gym or rest" options={[['run', 'Run'], ['gym', 'Gym'], ['rest', 'Rest']]} value={day.mode} onChange={(k) => set({ mode: k, type: typeFor(k) })} />
      {rest ? (
        <p className="m-ed-note">A rest morning: no workout, the routine waits for its usual time. Sleep in by moving the alarm.</p>
      ) : (
        <div className="m-ed-types" role="group" aria-label={day.mode === 'run' ? 'Kind of run' : 'Kind of workout'}>
          {(types.includes(day.type) ? types : [day.type, ...types]).map((x) => (
            <ChipButton
              key={x}
              on={x === day.type}
              onClick={() => {
                if (x === day.type) return;
                haptics.select();
                set({ type: x });
              }}
            >
              {x}
            </ChipButton>
          ))}
        </div>
      )}
      <div className="m-ed-steps">
        <div className="field">
          <span className="t-label muted">Alarm</span>
          <Stepper value={day.wake} onChange={(v) => set({ wake: v })} step={5} min={WAKE_MIN} max={WAKE_MAX} format={short} parse={parseWake} label="Alarm" inputProps={{ inputMode: 'numeric', autoComplete: 'off' }} />
        </div>
        {rest ? null : day.mode === 'run' ? (
          <div className="field">
            <span className="t-label muted">Miles</span>
            <Stepper value={day.miles} onChange={(v) => set({ miles: v })} step={0.5} min={0.5} max={30} format={num} parse={parseMiles} label="Miles" inputProps={{ inputMode: 'decimal' }} />
          </div>
        ) : (
          <div className="field">
            <span className="t-label muted">Minutes</span>
            <Stepper value={day.minutes} onChange={(v) => set({ minutes: v })} step={5} min={5} max={240} format={fmtInt} parse={parseInt10} label="Workout minutes" inputProps={{ inputMode: 'numeric' }} />
          </div>
        )}
      </div>
      {T.late ? (
        <p className="m-ed-note warn">
          Back at {short(T.back)}, {T.late} min past the {short(T.settings.after.showerAt)} routine. You leave at {short(T.leave)}.
        </p>
      ) : null}
      <div className="sheet-foot">
        {day.own ? (
          <Button variant="ghost" onClick={() => setDay.mutate({ date, day: null })}>
            {day.plan.label ? `Back to ${day.plan.label}` : 'Back to the plan'}
          </Button>
        ) : (
          <span />
        )}
        <div className="foot-right">
          <Button variant="primary" onClick={sheet.close}>
            Done
          </Button>
        </div>
      </div>
    </div>
  );
};
