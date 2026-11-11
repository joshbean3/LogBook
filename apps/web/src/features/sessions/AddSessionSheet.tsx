import { fmtDate, heroSession, label, mondayOf, monthsBetween, num, parseISO, shiftDays, tone, type Session } from '@logbook/shared';
import type * as React from 'react';
import { Fragment, useMemo, useRef, useState } from 'react';
import { newSessionId } from '@/api/queries';
import { useToday } from '@/lib/useToday';
import { Button, ChipButton, Segmented, Stepper } from '@/ui/primitives';
import { Pressable } from '@/ui/Pressable';
import { useSheet, type SheetApi } from '@/ui/Sheet';
import { useLog } from '../log/useLog';
import { weekTitle } from '../plan/context';
import { afterSheetLeft, useAddSession } from './addSession';
import { refocusMoved } from './MoveSheet';
import { SessionEditor } from './SessionEditor';
import { buildSession, liftChoices, milesFor, minutesFor, MILES_MAX, MILES_MIN, MILES_STEP, MINUTES_MAX, MINUTES_MIN, MINUTES_STEP, RUN_KINDS, type AddDraft, type AddHistory, type AddKind, type RunKind } from './addModel';
import './daypicker.css';
import './addsession.css';

const DOW = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
// the stepper shows the number alone: the unit is said once, by the control beside it
const fmtMi = (v: number) => num(v);
const parseMi = (s: string) => {
  const v = Number(s.replace(/[^\d.]/g, ''));
  return Number.isFinite(v) && v > 0 ? Math.round(v * 2) / 2 : null;
};
const fmtMin = (v: number) => String(v);
/** A unit as it is drawn ("mi") and as VoiceOver says it ("Miles"). */
const unitWord = (short: string, said: string) => (
  <>
    <span aria-hidden="true">{short}</span>
    <span className="sr-only">{said}</span>
  </>
);
const parseMin = (s: string) => {
  const v = Math.round(Number(s.replace(/[^\d]/g, '')));
  return Number.isFinite(v) && v > 0 ? v : null;
};

/**
 * Add a run or a lift to the week that is open (Plan), in one short sheet: the week's seven days as a strip (the picked
 * day filled, today ringed, a bar in the color of what already sits on a day), Run or Lift, then only what a session
 * needs: a run its kind and its miles (or minutes), a lift one the owner already has or a name. One line says what goes
 * in and where, and that a day already past is added as done. `More options` opens the full editor with what was picked
 * (cross training, rest, notes, the other run types). Add closes the sheet; the row is in the week at once, with Undo.
 */
export const AddSessionSheet = ({ mon, date }: { mon: string; date: string }) => {
  const sheet = useSheet();
  const commit = useAddSession();
  const [day, setDay] = useState(date);
  const [kind, setKind] = useState<AddKind>('run');
  const [run, setRun] = useState<RunKind>('Easy');
  const [unit, setUnit] = useState<'mi' | 'min'>('mi');
  // what was stepped, per kind: a kind that was not touched follows its default as the data arrives
  const [miles, setMiles] = useState<Partial<Record<RunKind, number>>>({});
  const [mins, setMins] = useState<Partial<Record<RunKind, number>>>({});
  const [pick, setPick] = useState(0);
  const [name, setName] = useState('');

  // twelve weeks behind the week (the last run of a kind, the owner's lifts) and eight behind today (their recent runs)
  const t = useToday();
  const months = useMemo(() => {
    const lo = shiftDays(mon, -84) < shiftDays(t, -56) ? shiftDays(mon, -84) : shiftDays(t, -56);
    const hi = shiftDays(mon, 6) > t ? shiftDays(mon, 6) : t;
    return monthsBetween(lo, hi);
  }, [mon, t]);
  const log = useLog(months);
  const hist = useMemo<AddHistory>(() => {
    const recent: Session[] = [];
    for (let i = 6; i >= -84; i--) recent.push(...[...log.snap.sessionsOn(shiftDays(mon, i))].reverse());
    const runs: number[] = [];
    for (let i = 0; i <= 56 && runs.length < 8; i++) for (const a of log.snap.runsOn(shiftDays(t, -i))) runs.push(a.miles);
    const p = log.boot?.user.trainingProfile;
    return { recent, runs, profile: p ? { weeklyMiles: p.weeklyMiles, runDays: p.runDays.length } : null, pace: log.boot?.morningSettings?.run?.pace ?? null };
  }, [log.snap, log.boot, mon, t]);
  const lifts = useMemo(() => liftChoices(hist.recent), [hist.recent]);

  const m = miles[run] ?? milesFor(run, hist);
  const min = mins[run] ?? minutesFor(m, hist.pace);
  const typed = name.trim();
  const draft: AddDraft = kind === 'run' ? { kind: 'run', type: run, miles: unit === 'mi' ? m : null, minutes: unit === 'min' ? min : null } : { kind: 'lift', choice: lifts[pick] ?? lifts[0] ?? null, name };
  const preview = buildSession('draft', day, t, draft);
  const past = day < t;
  const when = day === t ? 'Today' : fmtDate('short', day);
  // the one line over Add: what goes in (a run by minutes says them: its name has no miles to say), the day, and "Added as
  // done" for a day already past
  const said = [...(draft.kind === 'run' && draft.miles == null ? [`${min} min`] : []), when, ...(past ? ['Added as done'] : [])];

  const sent = useRef(false);
  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    // one tap, one session: a second tap while the sheet is on its way out adds nothing
    if (sent.current) return;
    sent.current = true;
    const s = buildSession(newSessionId(), day, t, draft);
    const hadFocus = !!document.activeElement && document.activeElement !== document.body;
    // the sheet falls away first, on frames of its own; the row is written the moment the sheet has left the screen. The
    // write renders every mounted tab: in the same task as the close it took the sheet's first frames and the sheet
    // vanished in one. This way the tap is answered at once, and the row lands in view: lit, the rows under it sliding
    sheet.close();
    afterSheetLeft(() => {
      commit(s, t);
      // the row the sheet was opened from may be gone (an empty day is now this session): focus goes to the new row
      if (hadFocus) refocusMoved(s.id, s.date);
    });
  };
  const more = () => sheet.open({ title: 'Add a session', detent: 'large', body: <SessionEditor date={day} session={preview} restore /> });

  return (
    <form className="sa" onSubmit={submit}>
      <div className="sa-days dpk-week" role="radiogroup" aria-label="Day">
        {DOW.map((letter, i) => {
          const d = shiftDays(mon, i);
          const lead = heroSession(log.snap.sessionsOn(d));
          const what = lead ? (lead.kind === 'rest' ? 'rest' : label(lead)) : 'nothing planned';
          return (
            <Pressable key={d} role="radio" aria-checked={d === day} aria-current={d === t ? 'date' : undefined} className={`dpk-day ${d === day ? 'is-sel' : ''} ${d === t ? 'is-today' : ''} ${d < t ? 'is-past' : ''}`} label={`${fmtDate('long', d)}, ${what}`} onPress={() => setDay(d)}>
              <span className="dpk-dow">{letter}</span>
              <span className="dpk-pill">
                <span className="dpk-num">{parseISO(d).getDate()}</span>
                <i className={`dpk-bar ${lead && lead.kind !== 'rest' ? `t-${tone(lead)}` : 'none'}`} aria-hidden="true" />
              </span>
            </Pressable>
          );
        })}
      </div>
      {/* what it is, as one unit on Paper (the sheet's ground is Cloud, where a segmented track cannot be seen) */}
      <div className="card sa-card">
        <Segmented<AddKind>
          label="Run or lift"
          value={kind}
          onChange={setKind}
          options={[
            ['run', 'Run'],
            ['lift', 'Lift'],
          ]}
        />
        {kind === 'run' ? (
          <div className="sa-block">
            <div className="sa-chips is-four" role="radiogroup" aria-label="Kind of run">
              {RUN_KINDS.map((k) => (
                <ChipButton key={k} role="radio" aria-checked={run === k} on={run === k} onClick={() => setRun(k)}>
                  {k}
                </ChipButton>
              ))}
            </div>
            <div className="sa-amount">
              {unit === 'mi' ? (
                <Stepper label="Miles" value={m} onChange={(v) => setMiles((x) => ({ ...x, [run]: v }))} step={MILES_STEP} min={MILES_MIN} max={MILES_MAX} format={fmtMi} parse={parseMi} inputProps={{ inputMode: 'decimal' }} />
              ) : (
                <Stepper label="Minutes" value={min} onChange={(v) => setMins((x) => ({ ...x, [run]: v }))} step={MINUTES_STEP} min={MINUTES_MIN} max={MINUTES_MAX} format={fmtMin} parse={parseMin} inputProps={{ inputMode: 'numeric' }} />
              )}
              <Segmented<'mi' | 'min'>
                className="sa-unit"
                tone="quiet"
                label="Miles or minutes"
                value={unit}
                onChange={setUnit}
                options={[
                  ['mi', unitWord('mi', 'Miles')],
                  ['min', unitWord('min', 'Minutes')],
                ]}
              />
            </div>
          </div>
        ) : (
          <div className="sa-block">
            <div className="sa-chips" role="radiogroup" aria-label="Lift">
              {lifts.map((c, i) => {
                const on = !typed && pick === i;
                return (
                  <ChipButton
                    key={c.key}
                    role="radio"
                    aria-checked={on}
                    on={on}
                    onClick={() => {
                      setPick(i);
                      setName('');
                    }}
                  >
                    <span className="sa-chip-name">{c.name}</span>
                  </ChipButton>
                );
              })}
            </div>
            <input className="in sa-name" value={name} maxLength={60} placeholder="Or name it" aria-label="Name" enterKeyHint="done" autoCapitalize="sentences" onChange={(e) => setName(e.target.value)} />
          </div>
        )}
      </div>
      <div className="sheet-foot sa-foot">
        {/* one run of text, read as one line: each part whole, and each " · " held to the part before it by a no-break
            space, so a line that wraps ends with the dot and the next starts with words */}
        <p className="sa-sum" aria-live="polite">
          <b className="sa-sum-name">{label(preview)}</b>
          {said.map((x) => (
            <Fragment key={x}>
              {'\u00a0· '}
              <span>{x}</span>
            </Fragment>
          ))}
        </p>
        <Button variant="primary" block type="submit">
          {past ? 'Add as done' : 'Add'}
        </Button>
        <Button variant="quiet" block onClick={more}>
          More options
        </Button>
      </div>
    </form>
  );
};

/** Open the Add sheet for the week of `mon`, on `date` (addModel.ts's `defaultDay` picks it when no day was tapped). */
export const openAddSession = (sheet: SheetApi, mon: string, date: string, today: string) => sheet.open({ eyebrow: weekTitle(mondayOf(mon), today), title: 'Add a session', body: <AddSessionSheet mon={mondayOf(mon)} date={date} /> });
