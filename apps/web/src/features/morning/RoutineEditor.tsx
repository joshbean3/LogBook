import { buildMorning, clock, durationWords, normalizeMorningSettings, parsePace, type MorningDay, type MorningMode, type MorningSettings } from '@logbook/shared';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useMorningMutations } from '@/api/queries';
import { haptics } from '@/lib/haptics';
import { rowPresence, springs } from '@/lib/motion';
import { Button, ChipButton, Stepper, useToast } from '@/ui';
import { useSheet } from '@/ui/Sheet';
import { parseWake } from './DayEditor';
import { MiniLine } from './MiniLine';
import { ROUTINE_DEFAULTS, short } from './model';

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
const FieldRow = ({ f, s, onChange, open, onToggle, highlight }: { f: Field; s: MorningSettings; onChange: (v: number) => void; open: boolean; onToggle: () => void; highlight?: boolean }) => {
  const v = f.get(s);
  const name = f.label;
  const reduce = useReducedMotion();
  return (
    <div className={`rt-row ${open ? 'is-open' : ''} ${highlight ? 'is-focus' : ''}`} data-field={f.id}>
      <div className="rt-line">
        <button type="button" className="rt-name" aria-expanded={open} onClick={onToggle}>
          <span className="rt-label">{name}</span>
          {f.sub ? <span className="rt-sub">{f.sub}</span> : null}
        </button>
        <button
          type="button"
          className={`rt-chip ${v === 0 ? 'off' : ''}`}
          aria-label={`${name}: ${f.fmt(v)}. ${f.cycle ? 'Tap for the next common length' : 'Tap to change'}`}
          onClick={() => {
            if (!f.cycle) return onToggle();
            haptics.select();
            onChange(nextIn(f.cycle, v));
          }}
        >
          <motion.span key={v} initial={reduce ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={springs.settle}>
            {f.fmt(v)}
          </motion.span>
        </button>
      </div>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div className="rt-fine" {...rowPresence}>
            <Stepper value={v} onChange={onChange} step={f.step} min={f.min} max={f.max} format={f.fmt} parse={f.parse} label={name} inputProps={{ inputMode: 'numeric', autoComplete: 'off' }} />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
};

/**
 * The timings every morning shares (spec §5.2): the usual alarm, and the run and gym mornings' wake-up, travel and workout
 * lengths, previewed at the top as they change. The routine's steps are arranged on the Morning schedule itself. Nothing is
 * written until Save, which sends `wake`, `run` and `gym` in one PATCH.
 */
export const RoutineEditor = ({ day, settings: initial, focus }: { day: MorningDay; settings: MorningSettings; focus?: string }) => {
  const sheet = useSheet();
  const toast = useToast();
  const { settings } = useMorningMutations();
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

  const T = useMemo(() => {
    const d: MorningDay = { ...day, mode: preview, wake: s.wake, type: preview === day.mode ? day.type : preview === 'run' ? 'Easy' : preview === 'gym' ? 'Strength' : 'Rest', minutes: preview === 'gym' && day.mode !== 'gym' ? s.gym.length : day.minutes };
    return buildMorning(d, s);
  }, [day, preview, s]);

  const row = (id: string) => {
    const f = FIELDS[id]!;
    return <FieldRow key={id} f={f} s={s} highlight={focused === id} open={open === id} onToggle={() => setOpen((o) => (o === id ? null : id))} onChange={(v) => setS((cur) => f.put(cur, v))} />;
  };
  const save = () => {
    settings.mutate({ wake: s.wake, run: s.run, gym: s.gym });
    haptics.success();
    sheet.close();
    toast('Timings saved');
  };

  return (
    <div className="rt" ref={root}>
      <div className="rt-preview">
        <div className="rt-modes" role="group" aria-label="Preview a morning">
          {(['run', 'gym', 'rest'] as const).map((m) => (
            <ChipButton
              key={m}
              on={preview === m}
              onClick={() => {
                if (m === preview) return;
                haptics.select();
                setPreview(m);
              }}
            >
              {m === 'run' ? 'Run day' : m === 'gym' ? 'Gym day' : 'Rest day'}
            </ChipButton>
          ))}
        </div>
        <MiniLine T={T} bar />
        <p className="rt-verdict">
          {durationWords(T.leave - T.day.wake)} from alarm to door.{T.late ? ` ${T.late} min late for the routine.` : ''}
        </p>
      </div>

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
          onClick={() => {
            haptics.select();
            setS((c) => ({ ...ROUTINE_DEFAULTS, wake: c.wake, after: c.after, focus: c.focus }));
          }}
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
