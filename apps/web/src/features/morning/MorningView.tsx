import { buildMorning, clock, clockOfDay, durationWords, fmtDate, mondayOf, monthOf, MORNING_DEFAULTS, morningDayFor, num, pad, parsePace, shiftDays, tone, TYPES, type MorningDayOverride, type MorningSettings, type MorningTimeline, type TimelineBlock } from '@logbook/shared';
import { motion, useReducedMotion } from 'motion/react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useMorningMutations } from '@/api/queries';
import { haptic } from '@/lib/haptics';
import { liftFx, useHoldDrag } from '@/lib/useDrag';
import { Button, DateNav, DayStrip, EmptyState, Field, Group, Loading, Note, PageHeader, Row, SectionHead, Segmented, Stepper } from '@/ui/primitives';
import { useSheet } from '@/ui/Sheet';
import { useLog } from '../log/useLog';
// the aura card grammar lives with Today; Morning borrows it rather than redrawing it
import './morning.css';

type L = ReturnType<typeof useLog>;

const fmtMiles = (v: number) => num(v);
const parseMiles = (s: string) => {
  const v = Number(s);
  return Number.isFinite(v) && v > 0 ? Math.round(v * 2) / 2 : null;
};
const fmtInt = (v: number) => String(v);
const parseInt10 = (s: string) => {
  const v = Math.round(Number(s));
  return Number.isFinite(v) ? v : null;
};
/** "7:15", "715" or "7": a morning hour, with or without minutes. */
const parseWake = (raw: string) => {
  const s = raw.trim().toLowerCase().replace(/\s*(am|a)$/, '');
  const x = /^(\d{1,2})(?::?(\d{2}))?$/.exec(s);
  if (!x) return null;
  const h = Number(x[1]);
  const m = Number(x[2] ?? 0);
  return h <= 23 && m <= 59 ? h * 60 + m : null;
};
/** "7:20 AM" split so the number can be big and the meridiem small. */
const timeParts = (m: number) => {
  const [v = '', u = ''] = clockOfDay(m).split(' ');
  return { v, u };
};
/** "7:20" without the meridiem, for tight spots. */
const short = (m: number) => timeParts(m).v;

/** Minutes since midnight, refreshed every half minute. */
const useNowMinutes = () => {
  const read = () => {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
  };
  const [m, setM] = useState(read);
  useEffect(() => {
    const iv = setInterval(() => setM(read()), 30_000);
    return () => clearInterval(iv);
  }, []);
  return m;
};

// ---------- 7-day strip: the week around the viewed day, one tone dot per planned session ----------
const WeekStrip = ({ date, today, log, go }: { date: string; today: string; log: L; go: (d: string) => void }) => {
  const mon = mondayOf(date);
  const days = Array.from({ length: 7 }, (_, i) => shiftDays(mon, i));
  return (
    <DayStrip
      className="strip-lit"
      days={days}
      selected={date}
      today={today}
      onPick={go}
      labelOf={(d) => fmtDate('short', d)}
      extra={(d) => {
        // a rest day carries the rest tone; so does a day the athlete turned into a rest morning
        const on = log.snap.sessionsOn(d);
        const s = on.find((x) => x.kind !== 'rest') ?? on.find((x) => x.kind === 'rest');
        if (log.snap.morningOverride(d)?.mode === 'rest') return <i className="dcell-dot t-rest" />;
        return s ? <i className={`dcell-dot t-${tone(s)}`} /> : <i className="dcell-dot none" />;
      }}
    />
  );
};

// ---------- hero: the head of the timeline as an aura card, the times of the morning stamped on it (four, or three on a rest morning) ----------
const MorningHero = ({ T, date, today, onEdit }: { T: MorningTimeline; date: string; today: string; onEdit: () => void }) => {
  const door = T.blocks.find((b) => b.key === 'buffer')?.start ?? T.day.wake;
  const rest = T.day.mode === 'rest';
  const shower = T.blocks.find((b) => b.key === 'shower')?.start ?? T.leave;
  const word = T.day.mode === 'gym' ? 'Gym' : rest ? 'Rest' : 'Run';
  const verdict = T.late
    ? `Back ${short(T.back)}, ${T.late} min late for the shower.`
    : rest
      ? `${T.day.wake > T.settings.wake ? 'Sleep in' : 'A rest morning'}. Leave at ${short(T.leave)}.`
      : T.day.mode === 'gym'
        ? `Out the door ${short(door)}, home ${short(T.back)}.`
        : `Out the door ${short(door)}, back ${short(T.back)}.`;
  const stats: Array<[string, number]> = rest
    ? [
        ['Wake', T.day.wake],
        ['Shower', shower],
        ['Leave', T.leave],
      ]
    : [
        ['Wake', T.day.wake],
        ['Door', door],
        ['Back', T.back],
        ['Leave', T.leave],
      ];
  return (
    <div className={`aura m-aura${rest ? ' m-rest' : ''}`}>
      <span className="aura-glow" aria-hidden="true" />
      <div className="aura-top">
        <span className="caps">{date === today ? 'Today’s morning' : fmtDate('short', date)}</span>
        <span className="m-aura-tools">
          <span className="caps">{durationWords(T.leave - T.day.wake)}</span>
          <Button variant="quiet" size="sm" className="m-edit" onClick={onEdit}>
            Edit
          </Button>
        </span>
      </div>
      <h2 className="aura-title display">{word}</h2>
      <p className="aura-verdict">{verdict}</p>
      <div className="aura-stats">
        {stats.map(([k, m]) => {
          const { v, u } = timeParts(m);
          return (
            <span key={k} className="aura-stat">
              <span className="caps">{k}</span>
              <span className="stamp aura-num">
                {v}
                <small>{u}</small>
              </span>
            </span>
          );
        })}
      </div>
    </div>
  );
};

// ---------- controls: mode, type, wake and distance, all in one group ----------
const Controls = ({ date, T }: { date: string; T: MorningTimeline }) => {
  const { setDay } = useMorningMutations();
  const day = T.day;
  const rest = day.mode === 'rest';
  const types = day.mode === 'run' ? TYPES.run.filter((x) => x !== 'Run') : TYPES.lift;
  const set = (patch: Partial<typeof day>) => setDay.mutate({ date, day: { mode: day.mode, type: day.type, miles: day.miles, minutes: day.minutes, wake: day.wake, ...patch } });
  // the type a mode starts with: the plan's own when it is the plan's mode, else the plain default
  const typeFor = (k: typeof day.mode) => (k === day.plan.mode ? day.plan.type : k === 'run' ? 'Easy' : k === 'gym' ? 'Strength' : 'Rest');
  return (
    <Group>
      <div className="lrow">
        <Segmented className="grow" label="Running, workout or rest" options={[['run', 'Running'], ['gym', 'Workout'], ['rest', 'Rest']]} value={day.mode} onChange={(k) => set({ mode: k, type: typeFor(k) })} />
      </div>
      {rest ? null : (
        <Row
          className="m-type"
          title={<span className="m-lbl">Type</span>}
          right={
            <select className="m-select" aria-label={day.mode === 'run' ? 'Type of run' : 'Type of workout'} value={day.type} onChange={(e) => set({ type: e.target.value })}>
              {(types.includes(day.type) ? types : [day.type, ...types]).map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </select>
          }
        />
      )}
      <div className="m-steppers">
        <div className="field">
          <span className="t-label muted">Wake up</span>
          <Stepper value={day.wake} onChange={(v) => set({ wake: v })} step={5} min={240} max={720} format={short} parse={parseWake} label="Wake-up time" inputProps={{ inputMode: 'numeric', autoComplete: 'off' }} />
        </div>
        {rest ? null : day.mode === 'run' ? (
          <div className="field">
            <span className="t-label muted">Miles</span>
            <Stepper value={day.miles} onChange={(v) => set({ miles: v })} step={0.5} min={0.5} max={30} format={fmtMiles} parse={parseMiles} label="Miles" inputProps={{ inputMode: 'decimal' }} />
          </div>
        ) : (
          <div className="field">
            <span className="t-label muted">Minutes</span>
            <Stepper value={day.minutes} onChange={(v) => set({ minutes: v })} step={5} min={5} max={240} format={fmtInt} parse={parseInt10} label="Workout minutes" inputProps={{ inputMode: 'numeric' }} />
          </div>
        )}
      </div>
      {day.plan.label || day.own ? (
        <div className="lrow m-plan">
          <span className="m-plan-line grow">
            <span className="caps">{day.plan.label ? 'Training plan' : 'Your own'}</span>
            {day.plan.label ? <span className="stamp m-plan-stamp">{day.plan.label}</span> : <span className="stamp m-plan-stamp">Morning</span>}
          </span>
          {day.own ? (
            <button type="button" className="link sm quiet" onClick={() => setDay.mutate({ date, day: null })}>
              Reset
            </button>
          ) : null}
        </div>
      ) : null}
    </Group>
  );
};

/** The plan editor in a sheet. It subscribes on its own, so the steppers and the readout stay live while it is up. */
const EditSheet = ({ date }: { date: string }) => {
  const sheet = useSheet();
  const log = useLog([monthOf(date)]);
  const st = log.boot?.morningSettings ?? MORNING_DEFAULTS;
  const T = useMemo(() => buildMorning(morningDayFor(log.snap.sessionsOn(date), log.snap.morningOverride(date), st), st), [log.snap, date, st]);
  const door = T.blocks.find((b) => b.key === 'buffer')?.start ?? T.day.wake;
  return (
    <>
      <Controls date={date} T={T} />
      <p className="t-sub ink2 m-readout">
        {T.day.mode === 'rest' ? `No workout. Wake ${short(T.day.wake)}, leave ${short(T.leave)}.` : `Out the door ${short(door)}, back ${short(T.back)}, leave ${short(T.leave)}.${T.late ? ` ${T.late} min late for the shower.` : ''}`}
      </p>
      <div className="sheet-foot">
        <div className="foot-right">
          <Button variant="primary" onClick={sheet.close}>
            Done
          </Button>
        </div>
      </div>
    </>
  );
};

// ---------- timeline: a 48px axis, blocks at 1.6px a minute ----------
const PX = 1.6;
const GAP = 4;
const MIN_H = 32;
const LEAVE_H = 32;
interface Laid {
  b: TimelineBlock;
  top: number;
  h: number;
}
const layoutBlocks = (blocks: TimelineBlock[]) => {
  const items: Laid[] = [];
  let y = 0;
  for (const b of blocks) {
    const h = Math.max(MIN_H, Math.round(b.mins * PX));
    items.push({ b, top: y, h });
    y += h + GAP;
  }
  return { items, end: y };
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const WAKE_MIN = 240;
const WAKE_MAX = 720;
const WAKE_STEP = 5;
const MILES_STEP = 0.5;
const MIN_STEP = 5;
type Draft = Partial<Pick<MorningDayOverride, 'wake' | 'miles' | 'minutes'>>;

/**
 * The timeline you can take hold of. Hold the Wake block (300ms, one haptic) and drag it down for a later alarm, up for an
 * earlier one, in 5-minute steps; every block below recomputes as it goes. Drag the bottom edge of the run or gym block to
 * change what it holds: half-miles for a run, five minutes for the gym. The live value sits in the block; the day is written once the finger lifts.
 * Both take the arrow keys too.
 */
const Timeline = ({ T, isToday, date }: { T: MorningTimeline; isToday: boolean; date: string }) => {
  const now = useNowMinutes();
  const reduce = useReducedMotion();
  const { setDay } = useMorningMutations();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [live, setLive] = useState<'wake' | 'size' | null>(null);
  const draftRef = useRef<Draft | null>(null);
  draftRef.current = draft;
  const TT = useMemo(() => (draft ? buildMorning({ ...T.day, ...draft }, T.settings) : T), [T, draft]);
  const commit = (patch: Draft) => {
    const d = T.day;
    setDay.mutate({ date, day: { mode: d.mode, type: d.type, miles: d.miles, minutes: d.minutes, wake: d.wake, ...patch } });
  };
  const tick = (next: Draft) => {
    const cur = draftRef.current ?? {};
    const changed = (Object.keys(next) as Array<keyof Draft>).some((k) => cur[k] !== next[k]);
    if (!changed) return;
    haptic('tick');
    // the ref leads the render, so a release right after the last step commits that step, not the one before
    draftRef.current = next;
    setDraft(next);
  };
  const finish = (apply: boolean) => {
    const d = draftRef.current;
    setLive(null);
    draftRef.current = null;
    setDraft(null);
    if (!apply || !d) return;
    const moved = (d.wake != null && d.wake !== T.day.wake) || (d.miles != null && d.miles !== T.day.miles) || (d.minutes != null && d.minutes !== T.day.minutes);
    if (moved) commit(d);
  };
  const wakeOf = (dy: number) => clamp(T.day.wake + Math.round(dy / PX / WAKE_STEP) * WAKE_STEP, WAKE_MIN, WAKE_MAX);
  const wakeDrag = useHoldDrag<HTMLLIElement>({
    onArm: () => {
      haptic();
      setLive('wake');
      setDraft({ wake: T.day.wake });
    },
    onMove: (p) => tick({ wake: wakeOf(p.dy) }),
    // the release point is the last word: a final move can be coalesced away before the up
    onDrop: (p) => {
      tick({ wake: wakeOf(p.dy) });
      finish(true);
    },
    onCancel: () => finish(false),
  });
  const run = T.day.mode === 'run';
  const sizeOf = (dy: number): Draft => {
    const mins = dy / PX;
    return run ? { miles: clamp(Math.round((T.day.miles + (mins * 60) / T.settings.run.pace) / MILES_STEP) * MILES_STEP, 0.5, 30) } : { minutes: clamp(Math.round((T.day.minutes + mins) / MIN_STEP) * MIN_STEP, 5, 240) };
  };
  const sizeDrag = useHoldDrag<HTMLSpanElement>({
    holdMs: 0,
    onStart: () => {
      haptic();
      setLive('size');
      setDraft(run ? { miles: T.day.miles } : { minutes: T.day.minutes });
    },
    onMove: (p) => tick(sizeOf(p.dy)),
    onDrop: (p) => {
      tick(sizeOf(p.dy));
      finish(true);
    },
    onCancel: () => finish(false),
  });
  const stepKey = (e: React.KeyboardEvent, apply: (dir: 1 | -1) => void) => {
    const dir = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    haptic('tick');
    apply(dir);
  };
  const { items, end } = useMemo(() => layoutBlocks(TT.blocks), [TT.blocks]);
  const total = end + LEAVE_H;
  const yOf = (t: number) => {
    const first = items[0];
    if (!first || t <= first.b.start) return 0;
    for (const it of items) if (t >= it.b.start && t <= it.b.end) return it.top + (it.b.mins ? ((t - it.b.start) / it.b.mins) * it.h : 0);
    return end;
  };
  const ticks: Array<{ t: number; y: number }> = [];
  for (let t = Math.ceil(TT.day.wake / 30) * 30; t <= TT.leave; t += 30) {
    const y = yOf(t);
    const prev = ticks[ticks.length - 1];
    if (prev && y - prev.y < 20) continue;
    if (total - y < 24) continue;
    ticks.push({ t, y });
  }
  const showNow = isToday && now >= TT.day.wake && now <= TT.leave;
  const nowY = showNow ? yOf(now) : 0;
  const tickLabel = (t: number) => `${Math.floor(t / 60) % 12 || 12}:${pad(t % 60)}`;
  return (
    <div className={`tl ${live ? 'is-live' : ''}`} style={{ height: total }}>
      <div className="tl-axis" aria-hidden="true">
        {ticks.map(({ t, y }) => (
          <span key={t} className="tl-tick caps" style={{ top: y - 7 }}>
            {tickLabel(t)}
          </span>
        ))}
      </div>
      <ol className="tl-blocks">
        {items.map(({ b, top, h }, i) => {
          const past = isToday && b.end <= now;
          const range = `${short(b.start)}–${short(b.end)}`;
          if (b.key === 'free')
            return (
              <li key={i} className={`tl-free ${past ? 'past' : ''}`} style={{ top, height: h }}>
                <span className="tl-label">Free · {durationWords(b.mins)}</span>
                <span className="tl-range caps">{range}</span>
              </li>
            );
          const main = b.key === 'run' || b.key === 'gym';
          const wake = b.key === 'wake';
          // the session block is the lit one: its own number stamped on it, the family as the 3px bar and a faint halo
          const stamp = main ? (b.key === 'run' ? [num(TT.day.miles), 'mi'] : [String(TT.day.minutes), 'min']) : null;
          const lbl = main ? (b.key === 'run' ? `${TT.day.type} run` : b.label) : b.label;
          // the wake block lifts in hand; a block being resized stays at rest and only its edge brightens
          const lifted = wake && live === 'wake';
          const sizing = main && live === 'size';
          return (
            <motion.li
              key={i}
              ref={wake ? wakeDrag.ref : undefined}
              className={`tl-block k-${b.key} ${main ? 'lit' : ''} ${b.tone ? `t-${b.tone}` : ''} ${past ? 'past' : ''} ${h >= 48 ? 'tall' : ''} ${lifted ? 'is-lifted' : ''} ${sizing ? 'is-sizing' : ''}`}
              style={{ top, height: h }}
              animate={liftFx(lifted, reduce)}
              {...(wake ? wakeDrag.bind : {})}
              tabIndex={wake ? 0 : undefined}
              role={wake ? 'slider' : undefined}
              aria-label={wake ? 'Wake-up time. Hold and drag, or use the arrow keys, to move it five minutes' : undefined}
              aria-valuemin={wake ? WAKE_MIN : undefined}
              aria-valuemax={wake ? WAKE_MAX : undefined}
              aria-valuenow={wake ? TT.day.wake : undefined}
              aria-valuetext={wake ? clockOfDay(TT.day.wake) : undefined}
              onKeyDown={wake ? (e) => stepKey(e, (dir) => commit({ wake: clamp(T.day.wake + dir * WAKE_STEP, WAKE_MIN, WAKE_MAX) })) : undefined}
            >
              <span className="tl-halo" aria-hidden="true" />
              <div className="tl-main">
                <span className="tl-label">{lbl}</span>
                {h >= 60 && (b.key !== 'gym' || b.sub) ? <span className="caps">{[b.key === 'gym' ? '' : durationWords(b.mins), b.sub].filter(Boolean).join(' · ')}</span> : null}
              </div>
              {stamp ? (
                <span className="tl-side">
                  <span className="stamp tl-stamp">
                    {stamp[0]}
                    <small>{stamp[1]}</small>
                  </span>
                  {h >= 48 ? <span className="tl-range caps">{range}</span> : null}
                </span>
              ) : wake && live === 'wake' ? (
                <span className="stamp tl-stamp tl-live" aria-hidden="true">
                  {short(TT.day.wake)}
                </span>
              ) : (
                <span className="tl-range caps">{range}</span>
              )}
              {main ? (
                <span
                  ref={sizeDrag.ref}
                  className="tl-grip"
                  {...sizeDrag.bind}
                  tabIndex={0}
                  role="slider"
                  aria-label={run ? 'Miles. Drag the edge, or use the arrow keys, to change it by half a mile' : 'Minutes. Drag the edge, or use the arrow keys, to change it by five'}
                  aria-valuemin={run ? 0.5 : 5}
                  aria-valuemax={run ? 30 : 240}
                  aria-valuenow={run ? TT.day.miles : TT.day.minutes}
                  aria-valuetext={run ? `${num(TT.day.miles)} mi` : `${TT.day.minutes} min`}
                  onKeyDown={(e) => stepKey(e, (dir) => commit(run ? { miles: clamp(T.day.miles + dir * MILES_STEP, 0.5, 30) } : { minutes: clamp(T.day.minutes + dir * MIN_STEP, 5, 240) }))}
                />
              ) : null}
            </motion.li>
          );
        })}
        <li className="tl-leave" style={{ top: end, height: LEAVE_H }}>
          <span className="tl-label">Leave for work</span>
          <span className="stamp tl-stamp">{short(TT.leave)}</span>
        </li>
      </ol>
      {showNow ? (
        <div className="tl-now" style={{ top: nowY - 1 }} aria-label={`Now, ${clockOfDay(now)}`}>
          <i />
        </div>
      ) : null}
    </div>
  );
};

// ---------- word and quote ----------
const Focus = ({ st }: { st: MorningSettings }) => {
  const { settings } = useMorningMutations();
  const [edit, setEdit] = useState(false);
  const [word, setWord] = useState(st.focus.word);
  const [quote, setQuote] = useState(st.focus.quote);
  const [by, setBy] = useState(st.focus.by);
  const has = st.focus.word || st.focus.quote;
  const open = () => {
    setWord(st.focus.word);
    setQuote(st.focus.quote);
    setBy(st.focus.by);
    setEdit(true);
  };
  return (
    <>
      <SectionHead
        title="Word & quote"
        meta={has && !edit ? 'Stays until you change it' : undefined}
        action={
          has && !edit ? (
            <button type="button" className="link" onClick={open}>
              Change
            </button>
          ) : undefined
        }
      />
      <Group>
        {edit ? (
          <div className="group-pad m-editor">
            <Field label="Word of the day">
              <input className="in" value={word} onChange={(e) => setWord(e.target.value)} maxLength={40} placeholder="One word, e.g. Steady" autoFocus />
            </Field>
            <Field label="Quote of the day">
              <textarea className="in" rows={3} value={quote} onChange={(e) => setQuote(e.target.value)} maxLength={400} placeholder="A line to carry through the day" />
            </Field>
            <Field label="By">
              <input className="in" value={by} onChange={(e) => setBy(e.target.value)} maxLength={80} placeholder="Who said it (optional)" />
            </Field>
            <div className="row">
              <Button
                variant="primary"
                onClick={() => {
                  settings.mutate({ focus: { word: word.trim(), quote: quote.trim(), by: by.trim() } });
                  setEdit(false);
                }}
              >
                Save
              </Button>
              <Button variant="ghost" onClick={() => setEdit(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : !has ? (
          <EmptyState
            action={
              <Button variant="soft" className="m-add" onClick={open}>
                Add
              </Button>
            }
          >
            Pick a word and a line to start the day with. They stay here every morning until you change them.
          </EmptyState>
        ) : (
          <div className="group-pad m-focus">
            {st.focus.word ? <div className="stamp m-word">{st.focus.word}</div> : null}
            {st.focus.quote ? <blockquote className="display m-quote">“{st.focus.quote}”</blockquote> : null}
            {st.focus.quote && st.focus.by ? <div className="caps">{st.focus.by}</div> : null}
          </div>
        )}
      </Group>
    </>
  );
};

// ---------- settings tab: grouped lists, label left, input right ----------
const Unit = ({ children, unit }: { children: ReactNode; unit: string }) => (
  <span className="m-unit">
    {children}
    <span className="t-cap muted">{unit}</span>
  </span>
);

const SettingsPane = ({ st }: { st: MorningSettings }) => {
  const { settings } = useMorningMutations();
  const minutes = (grp: 'run' | 'gym' | 'after', key: string, label: string, sub?: string, max = 180) => {
    const value = (st[grp] as unknown as Record<string, number>)[key] ?? 0;
    return (
      <Row
        key={key}
        title={<span className="m-lbl">{label}</span>}
        sub={sub}
        right={
          <Unit unit="min">
            <input
              key={value}
              className="in m-num"
              type="number"
              inputMode="numeric"
              aria-label={label}
              min={0}
              max={max}
              step={1}
              defaultValue={value}
              onBlur={(e) => {
                const v = Math.round(Number(e.target.value));
                if (e.target.value !== '' && v >= 0 && v <= max && v !== value) settings.mutate({ [grp]: { [key]: v } });
                else e.target.value = String(value);
              }}
            />
          </Unit>
        }
      />
    );
  };
  return (
    <div className="m-set">
      <SectionHead title="Running" />
      <Group>
        <Row
          title={<span className="m-lbl">Pace</span>}
          sub="Sets how long the run takes"
          right={
            <Unit unit="/mi">
              <input
                key={st.run.pace}
                className="in m-num"
                inputMode="numeric"
                aria-label="Pace per mile"
                defaultValue={clock(st.run.pace)}
                placeholder="9:00"
                onBlur={(e) => {
                  const v = parsePace(e.target.value);
                  if (v && v !== st.run.pace) settings.mutate({ run: { pace: v } });
                  else e.target.value = clock(st.run.pace);
                }}
              />
            </Unit>
          }
        />
        {minutes('run', 'wakeup', 'Wake-up routine', 'From alarm to dressed')}
        {minutes('run', 'buffer', 'Buffer', 'Out the door, then cool down')}
      </Group>

      <SectionHead title="Workout" />
      <Group>
        {minutes('gym', 'length', 'Usual length', 'Change it day by day on the Plan tab', 240)}
        {minutes('gym', 'wakeup', 'Wake-up routine', 'From alarm to dressed')}
        {minutes('gym', 'walk', 'Walk to the gym', 'Counted both ways')}
      </Group>

      <SectionHead title="After" />
      <Group>
        <div className="lrow">
          <Segmented className="grow" label="When the shower starts" options={[['fixed', 'Set time'], ['after', 'After']]} value={st.after.showerMode} onChange={(k) => settings.mutate({ after: { showerMode: k } })} />
        </div>
        {st.after.showerMode === 'fixed' ? (
          <Row
            title={<span className="m-lbl">Shower starts</span>}
            sub="Get back late and the plan shows what to change."
            right={
              <Unit unit="AM">
                <input
                  key={st.after.showerAt}
                  className="in m-num"
                  inputMode="numeric"
                  autoComplete="off"
                  aria-label="Shower start time"
                  defaultValue={short(st.after.showerAt)}
                  placeholder="8:40"
                  onBlur={(e) => {
                    const v = parseWake(e.target.value);
                    if (v != null && v >= 240 && v <= 720 && v !== st.after.showerAt) settings.mutate({ after: { showerAt: v } });
                    else e.target.value = short(st.after.showerAt);
                  }}
                />
              </Unit>
            }
          />
        ) : (
          <div className="lrow">
            <span className="t-sub muted">Leaving time moves with the run or workout.</span>
          </div>
        )}
        {minutes('after', 'shower', 'Shower')}
        {minutes('after', 'ready', 'Get ready')}
        {minutes('after', 'smoothie', 'Blend smoothie', '0 to skip')}
        {minutes('after', 'prep', 'Final prep')}
      </Group>

      <Button className="m-set-reset" variant="ghost" block onClick={() => settings.mutate({ run: MORNING_DEFAULTS.run, gym: MORNING_DEFAULTS.gym, after: MORNING_DEFAULTS.after })}>
        Reset
      </Button>
    </div>
  );
};

// ---------- the view ----------
export default function MorningView() {
  const params = useParams();
  const nav = useNavigate();
  const sheet = useSheet();
  const [tab, setTab] = useState<'plan' | 'settings'>('plan');
  const base = useLog([]);
  const t = base.today;
  const date = params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : t;
  const months = useMemo(() => [monthOf(mondayOf(date)), monthOf(shiftDays(mondayOf(date), 6))], [date]);
  const log = useLog(months);
  const go = (d: string) => nav(d === t ? '/morning' : `/morning/${d}`);
  const st = log.boot?.morningSettings ?? MORNING_DEFAULTS;
  const T = useMemo(() => buildMorning(morningDayFor(log.snap.sessionsOn(date), log.snap.morningOverride(date), st), st), [log.snap, date, st]);
  return (
    <div className="page">
      <PageHeader
        title="Morning"
        sub={
          date === t ? (
            `Today · ${fmtDate('md', date)}`
          ) : (
            <span className="ph-sub-row">
              {`${date === shiftDays(t, 1) ? 'Tomorrow · ' : date === shiftDays(t, -1) ? 'Yesterday · ' : ''}${fmtDate('md', date)}`}
              <button type="button" className="link sm quiet" onClick={() => go(t)}>
                Today
              </button>
            </span>
          )
        }
        actions={tab === 'plan' ? <DateNav onPrev={() => go(shiftDays(date, -1))} onNext={() => go(shiftDays(date, 1))} prevLabel="Previous day" nextLabel="Next day" /> : undefined}
      >
        <Segmented className="m-tabs" label="Morning tabs" options={[['plan', 'Plan'], ['settings', 'Settings']]} value={tab} onChange={setTab} />
      </PageHeader>
      {!log.boot ? (
        <Loading text="Loading your morning…" />
      ) : tab === 'settings' ? (
        <SettingsPane st={st} />
      ) : (
        <>
          <div className="section" style={{ marginTop: 16 }}>
            <MorningHero T={T} date={date} today={t} onEdit={() => sheet.open({ title: 'Edit morning', body: <EditSheet date={date} /> })} />
            <WeekStrip date={date} today={t} log={log} go={go} />
          </div>

          <SectionHead title="Timeline" />
          {T.late ? (
            <Note kind="warn">
              Back at {clockOfDay(T.back)}, {T.late} min past your {clockOfDay(T.settings.after.showerAt)} shower, so you leave at {clockOfDay(T.leave)} instead of {clockOfDay(T.onTime ?? T.leave)}. To stay on time: wake by {clockOfDay(T.fix!.latestWake)}
              {T.fix?.maxMiles != null ? `, or ${T.fix.maxMiles > 0 ? `run ${num(T.fix.maxMiles)} mi` : 'skip the run'}` : ''}.
            </Note>
          ) : null}
          <Timeline T={T} isToday={date === t} date={date} />

          <Focus st={st} />
        </>
      )}
    </div>
  );
}
