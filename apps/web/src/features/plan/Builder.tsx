import { buildTemplate, counts, fmtDate, GOAL_SPECS, mondayOf, monthsBetween, num, parseISO, sessionStatus, shiftDays, TemplateError, tone, weekdayOf, weekSummary, WEEKDAYS, type Goal, type PlanBlock, type Template, type Weekday } from '@logbook/shared';
import { AnimatePresence, motion } from 'motion/react';
import { useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type FocusEvent as ReactFocusEvent, type ReactNode } from 'react';
import { useNav, useTab } from '@/app/NavController';
import { ApiError } from '@/api/client';
import { useTemplatePlan, useTemplateUndo, type PlanTemplateResult } from '@/api/queries';
import { haptics } from '@/lib/haptics';
import { crossfade, reducedFade, useReduced } from '@/lib/motion';
import { Button, Note, Stepper } from '@/ui/primitives';
import { Pressable } from '@/ui/Pressable';
import { useSheet, type SheetSpec } from '@/ui/Sheet';
import { useToast } from '@/ui/Toast';
import { useLog, type Log } from '../log/useLog';
import { builderVerb, type BuilderPrefill } from './builderModel';
import './plan.css';

/*
 * The block builder (docs/feel.md §7.4): a large sheet whose fixed header is the ghost preview (160 tall: the block's
 * shape as a grid of weeks, live as the controls change; a goal change crossfades it, nothing else moves), the controls
 * under it, and one verb in the foot that says what it does: `Use this plan`, or `Replace 44 planned sessions from Oct 19`.
 * The header and the body are two siblings in the sheet, so the body publishes what it built through a small store made per
 * open (`ghostStore`) and the header subscribes to it.
 */

const tenth = (v: number) => num(Math.round(v * 10) / 10);
/** A number field takes a typed number in place of the one it shows (feel review 2 G: `8` then `5` read `85`). */
const selectAll = (e: ReactFocusEvent<HTMLInputElement>) => {
  const el = e.currentTarget;
  el.select();
  // WebKit can drop a selection made on focus as the touch ends: once more on the next frame
  requestAnimationFrame(() => document.activeElement === el && el.select());
};

// ---------- the store the body writes and the header reads ----------
export interface GhostState {
  tpl: Template | null;
  error: string | null;
  goal: Goal;
}
interface GhostStore {
  get: () => GhostState;
  set: (s: GhostState) => void;
  subscribe: (f: () => void) => () => void;
}
const ghostStore = (initial: GhostState): GhostStore => {
  let v = initial;
  const subs = new Set<() => void>();
  return {
    get: () => v,
    set: (n) => {
      v = n;
      for (const f of subs) f();
    },
    subscribe: (f) => {
      subs.add(f);
      return () => void subs.delete(f);
    },
  };
};

// ---------- the ghost header ----------
/** One column per week of the block, Monday at the top; a run is its tone, brighter the longer it is. */
const GhostGrid = ({ tpl }: { tpl: Template }) => {
  const byDate = new Map(tpl.sessions.map((s) => [s.date, s] as const));
  const max = Math.max(1, ...tpl.sessions.map((s) => s.miles));
  return (
    <div className="bh-grid" style={{ ['--n' as string]: tpl.weeks.length }} aria-hidden="true">
      {tpl.weeks.map((w) => {
        const mon = mondayOf(w.start);
        return (
          <span key={w.week} className={`bh-wk k-${w.kind}`}>
            {Array.from({ length: 7 }, (_, i) => {
              const d = shiftDays(mon, i);
              const s = byDate.get(d);
              const out = d < tpl.start || d > tpl.end;
              return <i key={i} className={`bh-cell ${s ? `t-${tone(s)}` : out ? 'out' : ''}`} style={s ? { opacity: 0.4 + (0.6 * s.miles) / max } : undefined} />;
            })}
          </span>
        );
      })}
    </div>
  );
};

/** The sheet's fixed header: what the block will look like, before anything is saved. */
const GhostHeader = ({ store }: { store: GhostStore }) => {
  const g = useSyncExternalStore(store.subscribe, store.get);
  const reduce = useReduced();
  const tpl = g.tpl;
  const weeks = tpl ? tpl.weeks.filter((w) => w.week > 0).length : 0;
  const peak = tpl ? Math.max(0, ...tpl.weeks.map((w) => w.miles)) : 0;
  let face: ReactNode = null;
  if (tpl)
    face = (
      <>
        <span className="caps bh-caps">
          {weeks} {weeks === 1 ? 'week' : 'weeks'} · {tpl.sessions.length} runs · peak {tenth(peak)} mi
        </span>
        <span className="bh-name">{tpl.name}</span>
        <span className="bh-dates">
          {fmtDate('md', tpl.start)} – {fmtDate('md', tpl.end)}
        </span>
        <GhostGrid tpl={tpl} />
      </>
    );
  else if (g.error)
    face = (
      <>
        <span className="caps bh-caps">No block yet</span>
        <span className="bh-name">That doesn’t fit</span>
        <span className="bh-error">{g.error}</span>
      </>
    );
  return (
    <div className="bh" aria-label={tpl ? `Preview: ${tpl.name}, ${weeks} weeks, ${tpl.sessions.length} runs` : 'Preview'} role="img">
      <AnimatePresence initial={false}>
        <motion.div key={tpl ? g.goal : 'none'} className="bh-face" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={reduce ? reducedFade : crossfade}>
          {face}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

// ---------- the body: the controls ----------
const GOALS: Array<[Goal, string]> = [
  ['base', 'Just running'],
  ['5k', '5K'],
  ['10k', '10K'],
  ['half', 'Half'],
  ['marathon', 'Marathon'],
];
const LETTER: Record<Weekday, string> = { mon: 'M', tue: 'T', wed: 'W', thu: 'T', fri: 'F', sat: 'S', sun: 'S' };
const DAY_NAME: Record<Weekday, string> = { mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday' };
const KIND_WORD: Record<string, string> = { 'lead-in': 'Lead-in', build: '', down: 'Down week', taper: 'Taper', race: 'Race week' };

/** What the last four weeks say: the days you run and your weekly miles. */
const habitsOf = (log: Log) => {
  const t = log.today;
  const mon = mondayOf(t);
  const seen = new Map<Weekday, number>();
  let miles = 0;
  for (let w = 1; w <= 4; w++) {
    const m = shiftDays(mon, -7 * w);
    miles += weekSummary(log.snap, m).doneMiles;
    for (let i = 0; i < 7; i++) {
      const d = shiftDays(m, i);
      if (log.snap.runsOn(d).length) seen.set(weekdayOf(d), (seen.get(weekdayOf(d)) ?? 0) + 1);
    }
  }
  const days = WEEKDAYS.filter((d) => (seen.get(d) ?? 0) >= 2);
  const runDays = days.length >= 2 ? days : (['tue', 'thu', 'sat', 'sun'] as Weekday[]);
  const avg = Math.round(miles / 4);
  return { runDays, weeklyMiles: Math.min(150, Math.max(10, avg || 15)) };
};

/**
 * The starting point: the prefill (the next block, from the ending one), else the account's training answers (onboarding,
 * Settings › Training), else what the last four weeks say.
 */
const startOf = (log: Log, prefill?: BuilderPrefill) => {
  const h = habitsOf(log);
  const prof = log.boot?.user.trainingProfile ?? null;
  const pick = prefill?.runDays?.length ? WEEKDAYS.filter((_, i) => prefill.runDays!.includes(i)) : prof?.runDays?.length ? WEEKDAYS.filter((d) => prof.runDays.includes(d)) : null;
  const runDays = pick?.length ? pick : h.runDays;
  const long = prefill?.longRunDay !== undefined ? WEEKDAYS[prefill.longRunDay] : prof?.longRunDay;
  const miles = prefill?.weeklyMiles ?? prof?.weeklyMiles;
  const goal = prefill?.goal ?? prof?.goal;
  return {
    runDays,
    longDay: long && runDays.includes(long) ? long : runDays.includes('sun') ? 'sun' : runDays[runDays.length - 1]!,
    weeklyMiles: miles ? Math.min(150, Math.max(3, Math.round(miles))) : h.weeklyMiles,
    goal: (goal && goal in GOAL_SPECS ? goal : 'base') as Goal,
  };
};

/**
 * Sessions a replace from `from` would take away, by the server's rule (contract 1): every planned session not kept (Done
 * or Floor) from `from` to the new block's end, plus what is left of each block it overlaps, to that block's end.
 */
const replaceable = (log: Log, from: string, to: string, overlap: PlanBlock[]) => {
  let n = 0;
  for (let d = from; d <= to; d = shiftDays(d, 1)) for (const s of log.snap.sessionsOn(d)) if (!counts(sessionStatus(log.snap, d, s))) n++;
  const end = overlap.reduce((e, b) => (b.end > e ? b.end : e), to);
  for (let d = shiftDays(to, 1); d <= end; d = shiftDays(d, 1))
    for (const s of log.snap.sessionsOn(d)) if (s.blockId && overlap.some((b) => b.id === s.blockId && d <= b.end) && !counts(sessionStatus(log.snap, d, s))) n++;
  return n;
};

/** How long the Undo after a new block stays up. */
const BLOCK_UNDO_MS = 8000;

/** The builder's input from its controls (the same rule for the first render and every change). */
const inputOf = (t: string, c: { goal: Goal; weeks: number; runDays: Weekday[]; longDay: Weekday; miles: number; soon: boolean; race: boolean; preStart: string | null }) => {
  const nextMon = shiftDays(mondayOf(t), 7);
  const startDate = c.preStart ?? (c.soon ? shiftDays(t, 1) : nextMon);
  const firstMon = parseISO(startDate).getDay() === 1 ? startDate : shiftDays(mondayOf(startDate), 7);
  const raceDate = c.goal !== 'base' && c.race ? shiftDays(firstMon, c.weeks * 7 - 1) : null;
  return { goal: c.goal, weeks: c.weeks, startDate, runDays: c.runDays, longRunDay: c.longDay, weeklyMiles: c.miles, raceDate };
};
const build = (input: ReturnType<typeof inputOf>): { tpl: Template | null; error: string | null } => {
  try {
    return { tpl: buildTemplate(input), error: null };
  } catch (e) {
    return { tpl: null, error: e instanceof TemplateError ? e.message : 'That block doesn’t work. Change the weeks or the days.' };
  }
};
/** The controls' first values: the prefill, the training answers, the last four weeks (startOf); built once per open. */
const seedOf = (log: Log, prefill?: BuilderPrefill) => {
  const start0 = startOf(log, prefill);
  const t = log.today;
  const c = { goal: start0.goal, weeks: GOAL_SPECS[start0.goal].defaultWeeks, runDays: start0.runDays, longDay: start0.longDay, miles: start0.weeklyMiles, soon: false, race: true, preStart: prefill?.startDate && prefill.startDate > t ? prefill.startDate : null };
  return { c, built: build(inputOf(t, c)) };
};
type Seed = ReturnType<typeof seedOf>;

const BuilderBody = ({ log, store, seed }: { log: Log; store: GhostStore; seed: Seed }) => {
  const sheet = useSheet();
  const nav = useNav();
  const tab = useTab();
  const toast = useToast();
  const write = useTemplatePlan();
  const undo = useTemplateUndo();
  const t = log.today;
  const s0 = seed.c;
  const [goal, setGoal] = useState<Goal>(s0.goal);
  const [weeks, setWeeks] = useState(s0.weeks);
  const [runDays, setRunDays] = useState<Weekday[]>(s0.runDays);
  const [longDay, setLongDay] = useState<Weekday>(s0.longDay);
  const [miles, setMiles] = useState(s0.miles);
  const [soon, setSoon] = useState(s0.soon);
  const [race, setRace] = useState(s0.race);
  // a prefilled start (the day after the ending block) holds until "Start tomorrow" is toggled; never today or earlier
  const [preStart, setPreStart] = useState(s0.preStart);
  const isRace = goal !== 'base';
  // the body outlives nothing: a write that lands after the sheet was dismissed still says what it did (code review 1 #2)
  const alive = useRef(true);
  useEffect(
    () => () => {
      alive.current = false;
    },
    [],
  );
  const pickGoal = (g: Goal) => {
    setGoal(g);
    setWeeks(GOAL_SPECS[g].defaultWeeks);
  };
  const toggleDay = (d: Weekday) => {
    setRunDays((xs) => {
      if (xs.includes(d)) {
        if (xs.length === 1) return xs;
        const next = xs.filter((x) => x !== d);
        if (d === longDay) setLongDay(next[next.length - 1]!);
        return next;
      }
      return WEEKDAYS.filter((x) => xs.includes(x) || x === d);
    });
  };
  const pickLong = (d: Weekday) => {
    setLongDay(d);
    setRunDays((xs) => (xs.includes(d) ? xs : WEEKDAYS.filter((x) => xs.includes(x) || x === d)));
  };
  const input = inputOf(t, { goal, weeks, runDays, longDay, miles, soon, race, preStart });
  const { startDate, raceDate } = input;
  // the first render reuses the seed the header was made with (the same input, built once)
  const first = useRef<Seed['built'] | null>(seed.built);
  const built = useMemo(() => {
    const f = first.current;
    first.current = null;
    return f ?? build(input);
  }, [goal, weeks, startDate, runDays.join(','), longDay, miles, raceDate]); // eslint-disable-line react-hooks/exhaustive-deps
  const tpl = built.tpl;
  // the week-by-week list (84 cells) renders after the open: null on the first render, the template in a deferred one
  // (code review 1 #9: without an initial value it rendered in the open's commit)
  const listTpl = useDeferredValue(tpl, null);
  // the header shows what the controls build, on the same frame (a layout effect re-renders the header before paint)
  useLayoutEffect(() => store.set({ tpl, error: built.error, goal }), [built, goal, store, tpl]);
  // what a replace would clear: planned, not kept, from the block's first day (never before today), counted from the
  // months it spans (fetched here, so a block reaching past the prefetched weeks still counts every session it replaces)
  // (and, like the server, the rest of any block it overlaps: that block ends the day before this one starts)
  const overlap = (log.boot?.blocks ?? []).filter((b) => tpl && b.start <= tpl.end && b.end >= tpl.start);
  const last = overlap.reduce((e, b) => (b.end > e ? b.end : e), tpl?.end ?? t);
  const span = useLog(useMemo(() => (tpl ? monthsBetween(tpl.start > t ? tpl.start : t, last) : []), [tpl?.start, last, t])); // eslint-disable-line react-hooks/exhaustive-deps
  const from = tpl ? (tpl.start > t ? tpl.start : t) : t;
  const existing = tpl ? replaceable(span, from, tpl.end, overlap) : 0;
  const counting = !!tpl && !span.ready;
  const use = () => {
    if (!tpl || counting || write.isPending) return;
    const replacing = existing > 0;
    // the promise settles whether or not the sheet is still open (mutate's own callbacks need a mounted observer): a write
    // that lands after a dismiss still raises its Undo, and a failure still says so (code review 1 #2)
    write.mutateAsync({ ...input, replace: replacing }).then(
      (r) => {
        // a destructive commit with Undo (spec §11.4), when it commits; a plain new block is silent
        if (replacing) haptics.delete();
        const wasOpen = alive.current;
        if (wasOpen) sheet.close();
        // the new block's first week, only when the builder was opened on Plan and is still open: a write that lands after
        // a dismiss moves nothing (the owner may be anywhere by then; spec: nothing changes without a user action, code
        // review 2 #5). Over Today the tab stays (spec §1.3). The toast with Undo shows either way.
        if (tab === 'plan' && wasOpen) nav.go(`/plan/week/${mondayOf(r.block.start)}`);
        // the sheet (and this component) is gone by the time Undo is tapped: follow the promise, not mutate's callbacks.
        // The restored rows are the answer to an Undo; only a failure says something (spec §8: toasts for Undo and errors)
        announceApplied(toast, r, () =>
          undo.mutateAsync(r).then(
            () => undefined,
            () => toast('Couldn’t undo. The new block is still there.'),
          ),
        );
      },
      (e) => toast(e instanceof ApiError ? e.message : 'Couldn’t save the block. Try again.'),
    );
  };
  // a number field the owner types in sits above the foot and the keyboard (review-feel-1 #7; spec §0.2, risk 6)
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    let cur: HTMLElement | null = null;
    const fit = () => {
      if (!cur || document.activeElement !== cur) return;
      const sc = cur.closest<HTMLElement>('.sheet-body');
      if (!sc) return;
      const vv = window.visualViewport;
      const kbLine = vv ? vv.offsetTop + vv.height : window.innerHeight;
      const foot = el.querySelector<HTMLElement>('.tp-foot');
      const limit = Math.min(kbLine, foot ? foot.getBoundingClientRect().top : Infinity) - 12;
      const top = sc.getBoundingClientRect().top + 12;
      const r = cur.getBoundingClientRect();
      if (r.bottom > limit) sc.scrollTop += r.bottom - limit;
      else if (r.top < top) sc.scrollTop -= top - r.top;
    };
    const onIn = (e: FocusEvent) => {
      const f = e.target as HTMLElement;
      if (!f.matches('input, textarea')) return;
      cur = f;
      requestAnimationFrame(fit);
    };
    const onOut = () => (cur = null);
    const onType = () => requestAnimationFrame(fit);
    el.addEventListener('focusin', onIn);
    el.addEventListener('focusout', onOut);
    el.addEventListener('input', onType);
    window.visualViewport?.addEventListener('resize', fit);
    return () => {
      el.removeEventListener('focusin', onIn);
      el.removeEventListener('focusout', onOut);
      el.removeEventListener('input', onType);
      window.visualViewport?.removeEventListener('resize', fit);
    };
  }, []);
  return (
    <div ref={root} className="tp">
      <div className="ed-group">
        <span className="ed-label" id="tp-goal">
          Training for
        </span>
        <div className="ed-chips" role="radiogroup" aria-labelledby="tp-goal">
          {GOALS.map(([g, w]) => (
            <Pressable key={g} role="radio" aria-checked={goal === g} className={`pl-chip ${goal === g ? 'on' : ''}`} onPress={() => pickGoal(g)}>
              {w}
            </Pressable>
          ))}
        </div>
      </div>
      <div className="ed-group">
        <span className="ed-label" id="tp-days">
          Run days <span className="ink3">· hold a day for the long run</span>
        </span>
        <div className="tp-days" role="group" aria-labelledby="tp-days">
          {WEEKDAYS.map((d) => {
            const on = runDays.includes(d);
            return (
              <Pressable key={d} className={`tp-day ${on ? 'on' : ''} ${longDay === d ? 'long' : ''}`} aria-pressed={on} label={`${DAY_NAME[d]}${on ? ', a run day' : ''}${longDay === d ? ', long run' : ''}`} onPress={() => toggleDay(d)} onHold={() => pickLong(d)}>
                <span>{LETTER[d]}</span>
                {longDay === d ? <small>Long</small> : null}
              </Pressable>
            );
          })}
        </div>
        <div className="ed-chips tp-long" role="radiogroup" aria-label="Long run day">
          <span className="ink3 t-sub">Long run</span>
          {runDays.map((d) => (
            <Pressable key={d} role="radio" aria-checked={longDay === d} className={`pl-chip sm ${longDay === d ? 'on' : ''}`} onPress={() => pickLong(d)}>
              {DAY_NAME[d].slice(0, 3)}
            </Pressable>
          ))}
        </div>
      </div>
      <div className="tp-steps">
        <div className="ed-group">
          <span className="ed-label">{raceDate ? 'Weeks to race day' : 'Weeks'}</span>
          <Stepper label="Weeks" value={weeks} onChange={setWeeks} step={1} min={2} max={30} format={(v) => `${v}`} parse={(s) => (Number(s) > 0 ? Math.round(Number(s)) : null)} inputProps={{ inputMode: 'numeric', onFocus: selectAll }} />
        </div>
        <div className="ed-group">
          <span className="ed-label">Miles a week now</span>
          <Stepper label="Weekly miles" value={miles} onChange={setMiles} step={1} min={3} max={150} format={(v) => `${v}`} parse={(s) => (Number(s) > 0 ? Math.round(Number(s)) : null)} inputProps={{ inputMode: 'numeric', onFocus: selectAll }} />
        </div>
      </div>
      <div className="ed-chips">
        <Pressable role="switch" aria-checked={soon} className={`pl-chip ${soon ? 'on' : ''}`} onPress={() => (setPreStart(null), setSoon((v) => !v))}>
          Start tomorrow
        </Pressable>
        {isRace ? (
          <Pressable role="switch" aria-checked={race} className={`pl-chip ${race ? 'on' : ''}`} onPress={() => setRace((v) => !v)}>
            Race on the last Sunday
          </Pressable>
        ) : null}
      </div>
      {built.error ? <Note kind="bad">{built.error}</Note> : null}
      {listTpl ? <WeekByWeek tpl={listTpl} /> : null}
      <div className="sheet-foot tp-foot">
        <p className="tp-note">{!tpl ? '' : existing ? 'Anything you’ve done stays, and Undo puts it all back.' : `Starts ${fmtDate('short', tpl.start)}. Nothing is saved until you use it.`}</p>
        <Button variant="primary" block className="tp-verb" disabled={!tpl || counting || write.isPending} onClick={use}>
          {write.isPending ? 'Writing it' : counting ? 'Checking your calendar…' : builderVerb(existing, from)}
        </Button>
      </div>
    </div>
  );
};

/** After the verb: the block is on the calendar, with Undo (it puts back what a replace took away). */
const announceApplied = (toast: ReturnType<typeof useToast>, r: PlanTemplateResult, undo: () => void) => {
  const n = r.replacedIds?.length ?? 0;
  toast(`${r.block.name} is on your calendar.${n ? ` ${n} ${n === 1 ? 'session' : 'sessions'} replaced.` : ''}`, { label: 'Undo', fn: undo, duration: BLOCK_UNDO_MS });
};

/** The weeks with their numbers (the header has the shape; this has each day's miles). */
const WeekByWeek = ({ tpl }: { tpl: Template }) => {
  const byDate = new Map(tpl.sessions.map((s) => [s.date, s] as const));
  return (
    <div className="tp-preview">
      <span className="ed-label">Week by week</span>
      <div className="tp-weeks" aria-label={`${tpl.name}, week by week`}>
        {tpl.weeks.map((w) => {
          const mon = mondayOf(w.start);
          return (
            <div key={w.week} className={`tp-week k-${w.kind}`}>
              <span className="tp-wk">
                <b>{w.week === 0 ? '·' : `W${w.week}`}</b>
                <small>{fmtDate('md', mon)}</small>
              </span>
              <span className="tp-cells" aria-hidden="true">
                {Array.from({ length: 7 }, (_, i) => {
                  const s = byDate.get(shiftDays(mon, i));
                  return <span key={i} className={`tp-cell ${s ? `t-${tone(s)}` : ''}`}>{s ? (s.type === 'Race' ? 'R' : num(s.miles)) : ''}</span>;
                })}
              </span>
              <span className="tp-tot">
                <b>{tenth(w.miles)}</b>
                {KIND_WORD[w.kind] ? <small>{KIND_WORD[w.kind]}</small> : null}
              </span>
            </div>
          );
        })}
      </div>
      <p className="fine">{tpl.summary} Each run’s type sets its floor.</p>
    </div>
  );
};

/** The builder as a sheet spec: large, the ghost preview as its fixed header (contracts §C.1 `header`). */
export const builderSpec = (log: Log, prefill?: BuilderPrefill): SheetSpec => {
  // the header's first face is the block the controls start on: no empty face crossfading to it during the open
  // (code review 1 #9)
  const seed = seedOf(log, prefill);
  const store = ghostStore({ tpl: seed.built.tpl, error: seed.built.error, goal: seed.c.goal });
  return {
    title: prefill ? 'Next block' : 'New block',
    detent: 'large',
    header: <GhostHeader store={store} />,
    body: <BuilderBody log={log} store={store} seed={seed} />,
  };
};
