import { buildMorning, clock, durationWords, fmtDate, monthOf, normalizeMorningSettings, parsePace, routineOf, shiftDays, type MorningDay, type MorningMode, type MorningSettings } from '@logbook/shared';
import { motion } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useBootstrap, useMonths, useMorningMutations } from '@/api/queries';
import { buildSnapshot } from '@/api/snapshot';
import { useRouteParams } from '@/app/NavController';
import { fadeIn, useReduced } from '@/lib/motion';
import { useToday } from '@/lib/useToday';
import { Button, ChipButton, Stepper, usePress } from '@/ui';
import { useSheet } from '@/ui/Sheet';
import { MiniTimeline } from '../day/MiniTimeline';
import { morningOf, parseWake, ROUTINE_DEFAULTS, short, stopsOf, WAKE_MIN } from './model';
import { useClosed } from './StepSheets';

/** The latest a morning's leave field goes (6 pm). */
const LEAVE_MAX = 1080;

/** One editable number of the routine: how it reads, how it steps, and the common values a tap on its chip cycles through. */
interface Field {
  id: string;
  label: string;
  sub?: string;
  get: (s: MorningSettings) => number;
  put: (s: MorningSettings, v: number) => MorningSettings;
  step: number;
  min: number;
  max: number;
  /** Common values a tap on the chip steps through. None: the chip opens the stepper. */
  cycle?: number[];
  fmt: (v: number) => string;
  parse: (s: string) => number | null;
}
const mins = (v: number) => (v ? `${v} min` : 'Off');
const int = (s: string) => {
  const v = Math.round(Number(s.replace(/[^\d.]/g, '')));
  return Number.isFinite(v) ? v : null;
};
const at = <G extends 'run' | 'gym' | 'after'>(g: G, k: keyof MorningSettings[G]) => ({
  get: (s: MorningSettings) => s[g][k] as unknown as number,
  put: (s: MorningSettings, v: number) => ({ ...s, [g]: { ...s[g], [k]: v } }),
});
const WAKEUP = [5, 10, 15, 20, 30, 45];

const FIELDS: Record<string, Field> = {
  wake: { id: 'wake', label: 'Usual alarm', sub: 'One morning different? Tap the alarm on the schedule', get: (s) => s.wake, put: (s, v) => ({ ...s, wake: v }), step: 5, min: 240, max: 720, fmt: short, parse: parseWake },
  pace: { id: 'pace', label: 'Easy pace', sub: 'Turns miles into minutes', ...at('run', 'pace'), step: 5, min: 240, max: 1200, fmt: (v) => `${clock(v)}/mi`, parse: parsePace },
  'run.wakeup': { id: 'run.wakeup', label: 'Wake-up routine', sub: 'Alarm to dressed', ...at('run', 'wakeup'), step: 1, min: 0, max: 180, cycle: WAKEUP, fmt: mins, parse: int },
  'run.buffer': { id: 'run.buffer', label: 'Door and cool-down', sub: 'Each side of the run', ...at('run', 'buffer'), step: 1, min: 0, max: 180, cycle: [0, 5, 10, 15], fmt: mins, parse: int },
  'gym.length': { id: 'gym.length', label: 'Usual workout', sub: 'One day different? Tap the workout on the schedule', ...at('gym', 'length'), step: 5, min: 5, max: 240, cycle: [20, 30, 40, 45, 60, 75, 90], fmt: mins, parse: int },
  'gym.walk': { id: 'gym.walk', label: 'Walk to the gym', sub: 'Each way', ...at('gym', 'walk'), step: 1, min: 0, max: 180, cycle: [0, 5, 10, 15, 20], fmt: mins, parse: int },
  'gym.wakeup': { id: 'gym.wakeup', label: 'Wake-up routine', sub: 'Alarm to dressed', ...at('gym', 'wakeup'), step: 1, min: 0, max: 180, cycle: WAKEUP, fmt: mins, parse: int },
};
/** A timeline block's key → the field its Edit opens on. */
const FOCUS: Record<string, string> = { wake: 'run.wakeup', buffer: 'run.buffer', gym: 'gym.length', run: 'pace' };

const nextIn = (cycle: number[], v: number) => cycle.find((c) => c > v) ?? cycle[0]!;

/** A row: the name opens a stepper for exact values; the chip cycles the common ones. */
const FieldRow = ({ f, s, onChange, open, onToggle, highlight, focus }: { f: Field; s: MorningSettings; onChange: (v: number) => void; open: boolean; onToggle: () => void; highlight?: boolean; focus?: boolean }) => {
  const v = f.get(s);
  const name = f.label;
  const reduce = useReduced();
  const press = usePress();
  return (
    <div className={`rt-row ${open ? 'is-open' : ''} ${highlight ? 'is-focus' : ''}`} data-field={f.id}>
      <div className="rt-line">
        <button type="button" className="rt-name" aria-expanded={open} onClick={onToggle}>
          <span className="rt-label">{name}</span>
          {f.sub ? <span className="rt-sub">{f.sub}</span> : null}
        </button>
        <button
          type="button"
          className={`rt-chip pressable ${v === 0 ? 'off' : ''}`}
          data-press="scale"
          {...press.handlers}
          aria-label={`${name}: ${f.fmt(v)}. ${f.cycle ? 'Tap for the next common length' : 'Tap to change'}`}
          onClick={() => {
            if (!f.cycle) return onToggle();
            onChange(nextIn(f.cycle, v));
          }}
        >
          <motion.span key={v} initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={fadeIn}>
            {f.fmt(v)}
          </motion.span>
        </button>
      </div>
      {open ? (
        <motion.div className="rt-fine" initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={fadeIn}>
          {/* the Leave row's door: the field takes focus when the sheet's open animation completes (Sheet v3), never before */}
          <Stepper value={v} onChange={onChange} step={f.step} min={f.min} max={f.max} format={f.fmt} parse={f.parse} label={name} inputProps={{ inputMode: 'numeric', autoComplete: 'off', autoFocus: focus }} />
        </motion.div>
      ) : null}
    </div>
  );
};

/**
 * The timings every morning shares (spec §4.1, M23; a large sheet): when you leave, the usual alarm, and the run and gym
 * mornings' wake-up, travel and workout lengths, previewed at the top as they change. The routine's steps are arranged on
 * This morning's schedule itself. Nothing is written until Save, which sends `wake`, `run`, `gym` (and the routine's start,
 * when the leave time moved it) in one PATCH. `focus: 'leave'` (the Leave row) opens on the leave field with its input
 * focused once the sheet has risen.
 */
export const RoutineEditor = ({ day, settings: initial, focus, dayWord = 'This morning' }: { day: MorningDay; settings: MorningSettings; focus?: string; /** The morning's word: `This morning`, `Tomorrow`, `Yesterday`, `Tuesday`. */ dayWord?: string }) => {
  const sheet = useSheet();
  const { settingsWhen } = useMorningMutations();
  const closed = useClosed();
  const [saved] = useState(() => normalizeMorningSettings(initial));
  const [s, setS] = useState<MorningSettings>(saved);
  const [preview, setPreview] = useState<MorningMode>(day.mode);
  const focused = !focus ? null : day.mode === 'gym' && (focus === 'wake' || focus === 'buffer') ? (focus === 'wake' ? 'gym.wakeup' : 'gym.walk') : (FOCUS[focus] ?? focus);
  const [open, setOpen] = useState<string | null>(focused);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!focused) return;
    const el = root.current?.querySelector(`[data-field="${focused}"]`);
    el?.scrollIntoView({ block: 'center' });
  }, [focused]);

  const dirty = JSON.stringify(s) !== JSON.stringify(saved);
  useEffect(() => sheet.update({ sticky: dirty }), [dirty]); // eslint-disable-line react-hooks/exhaustive-deps

  // the morning this sheet was opened for keeps its own alarm (code review 1 F1): previewed as itself, on that alarm, and named
  // by its word (`This morning`, `Tomorrow`, `Tuesday`: code review 3 N8). The other kinds of morning the chips preview are
  // the routine's own, on the usual alarm
  const wakeOf = (x: MorningSettings) => (day.own ? day.wake : x.wake);
  const total = (x: MorningSettings) => routineOf(x).reduce((m, r) => m + r.mins, 0);
  const kindWord = (m: MorningMode) => (m === 'run' ? 'Run mornings' : m === 'gym' ? 'Gym mornings' : 'Rest mornings');
  const T = useMemo(() => {
    const d: MorningDay = { ...day, mode: preview, wake: preview === day.mode ? wakeOf(s) : s.wake, own: preview === day.mode && day.own, type: preview === day.mode ? day.type : preview === 'run' ? 'Easy' : preview === 'gym' ? 'Strength' : 'Rest', minutes: preview === 'gym' && day.mode !== 'gym' ? s.gym.length : day.minutes };
    return buildMorning(d, s);
  }, [day, preview, s]); // eslint-disable-line react-hooks/exhaustive-deps
  // this morning as it is (its own alarm, its workout), live with the edits: what the Leave row on the page reads
  const mine = useMemo(() => buildMorning({ ...day, wake: wakeOf(s) }, s), [day, s]); // eslint-disable-line react-hooks/exhaustive-deps
  // the same workout on the usual alarm: a morning like this one that keeps the routine's alarm
  const usualLeave = buildMorning({ ...day, wake: s.wake, own: false }, s).leave;

  // the Leave field is every morning's (feel review 3 R3-2): the routine's set start plus its steps, which every morning on
  // time leaves at, whatever this one's alarm or run (a fixed start writes every morning). When this morning leaves at
  // another time, the sub says so and why; the field neither reads nor floors at it. Routine "when I'm back": the field
  // reads a morning like this one on the usual alarm, and a change sets the routine to a fixed start
  const leaveOf = (x: MorningSettings) => (x.after.showerMode === 'fixed' ? x.after.showerAt + total(x) : buildMorning({ ...day, wake: x.wake, own: false }, x).leave);
  const leaveNow = leaveOf(s);
  const leaveSub =
    mine.leave !== leaveNow
      ? `${dayWord}: ${short(mine.leave)}, ${day.own && usualLeave !== mine.leave ? `on its own alarm ${short(day.wake)}` : day.mode === 'rest' ? 'after waking' : `after the ${day.mode === 'gym' ? 'workout' : 'run'}`}`
      : s.after.showerMode !== 'fixed'
        ? 'Sets when the routine starts'
        : `The routine starts at ${short(s.after.showerAt)}`;
  const leave: Field = {
    id: 'leave',
    label: 'Leave for work',
    sub: leaveSub,
    get: leaveOf,
    put: (x, v) => ({ ...x, after: { ...x.after, showerMode: 'fixed', showerAt: Math.max(WAKE_MIN, v - total(x)) } }),
    step: 5,
    min: WAKE_MIN + total(s),
    max: LEAVE_MAX,
    fmt: short,
    parse: parseWake,
  };
  // a morning with its own alarm keeps it, so the Usual alarm row says what it moves: mornings like this one on the usual
  // alarm (feel review 2 R2-2), named as such rather than as every other morning (code review 3 N8), live as it steps
  const usualSub = day.own ? `${kindWord(day.mode)}${day.mode === 'rest' ? '' : ' like this one'}: leave ${short(usualLeave)}` : null;
  const usual = useMemo<Field>(() => (usualSub == null ? FIELDS.wake! : { ...FIELDS.wake!, sub: usualSub }), [usualSub]);
  const row = (id: string) => {
    const f = id === 'leave' ? leave : id === 'wake' ? usual : FIELDS[id]!;
    return <FieldRow key={id} f={f} s={s} highlight={focused === id} focus={focused === id} open={open === id} onToggle={() => setOpen((o) => (o === id ? null : id))} onChange={(v) => setS((cur) => f.put(cur, v))} />;
  };
  const save = () => {
    const after = s.after.showerMode !== saved.after.showerMode || s.after.showerAt !== saved.after.showerAt ? { after: { showerMode: s.after.showerMode, showerAt: s.after.showerAt } } : {};
    // the page answering is the confirmation (no toast, no haptic: §8, §11.4), once the sheet has closed
    const patch = { wake: s.wake, run: s.run, gym: s.gym, ...after };
    settingsWhen(patch, closed());
    sheet.close();
  };

  return (
    <div className="rt" ref={root}>
      <div className="rt-preview">
        <div className="rt-modes" role="group" aria-label="Preview a morning">
          {(['run', 'gym', 'rest'] as const).map((m) => (
            <ChipButton
              key={m}
              on={preview === m}
              onClick={() => setPreview(m)}
            >
              {m === 'run' ? 'Run day' : m === 'gym' ? 'Gym day' : 'Rest day'}
            </ChipButton>
          ))}
        </div>
        <MiniTimeline stops={stopsOf(T)} now={-1} label={`Preview: ${stopsOf(T).map((x) => `${x.label} ${short(x.at)}`).join(', ')}`} />
        <p className="rt-verdict">
          {preview !== day.mode ? `${kindWord(preview)}: ` : day.own ? `${dayWord}, its own alarm ${short(day.wake)}: ` : ''}
          {/* leaving for work, not the run's door (the preview's DOOR is that one: feel review 3 R3-4) */}
          {durationWords(T.leave - T.day.wake)} from alarm to leaving.{T.late ? ` ${T.late} min late for the routine.` : ''}
        </p>
      </div>

      <section className="rt-sec" aria-label="Leave">
        <h3 className="section-title">Leave</h3>
        <div className="rt-list">{row('leave')}</div>
      </section>

      <section className="rt-sec" aria-label="Alarm">
        <h3 className="section-title">Alarm</h3>
        <div className="rt-list">{row('wake')}</div>
      </section>

      <section className="rt-sec" aria-label="Run mornings">
        <h3 className="section-title">Run mornings</h3>
        <div className="rt-list">
          {row('run.wakeup')}
          {row('run.buffer')}
          {row('pace')}
        </div>
      </section>

      <section className="rt-sec" aria-label="Gym mornings">
        <h3 className="section-title">Gym mornings</h3>
        <div className="rt-list">
          {row('gym.wakeup')}
          {row('gym.walk')}
          {row('gym.length')}
        </div>
      </section>

      <div className="sheet-foot">
        <Button
          variant="ghost"
          onClick={() => setS((c) => ({ ...ROUTINE_DEFAULTS, wake: c.wake, after: c.after, focus: c.focus }))}
        >
          Defaults
        </Button>
        <div className="foot-right">
          <Button variant="primary" onClick={save} disabled={!dirty}>
            Save
          </Button>
        </div>
      </div>
    </div>
  );
};

/**
 * Opens the routine editor as a large sheet (contracts §F, spec M23): Settings › Morning routine and This morning's trailing
 * icon. The morning it previews is the pushed page's date when called inside This morning (`useRouteParams().date`), else
 * today. `focus: 'leave'` (the Leave row) opens it on the leave field, focused after the open animation.
 */
export const useOpenRoutineEditor = (): ((focus?: 'leave') => void) => {
  const sheet = useSheet();
  const today = useToday();
  const rp = useRouteParams();
  const date = rp.date && /^\d{4}-\d{2}-\d{2}$/.test(rp.date) ? rp.date : today;
  const boot = useBootstrap();
  const { bundles } = useMonths(useMemo(() => [...new Set([monthOf(date), monthOf(today)])].sort(), [date, today]));
  return (focus) => {
    // the day is read when the sheet opens: building a snapshot on every render of the page holding the hook (This
    // morning's push commit among them) was work nobody looked at
    const snap = buildSnapshot(bundles, today, boot.data?.morningSettings?.run?.pace ?? null);
    const st = boot.data?.morningSettings ?? ROUTINE_DEFAULTS;
    const T = morningOf(snap.sessionsOn(date), snap.morningOverride(date), st);
    const dayWord = date === today ? 'This morning' : date === shiftDays(today, 1) ? 'Tomorrow' : date === shiftDays(today, -1) ? 'Yesterday' : fmtDate('dowLong', date);
    sheet.open({ eyebrow: 'Every morning', title: 'Timings', detent: 'large', body: <RoutineEditor day={T.day} settings={T.settings} focus={focus} dayWord={dayWord} /> });
  };
};
