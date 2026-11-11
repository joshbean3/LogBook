import { BUILDER_LIMITS, builderDates, builderInput, counts, fmtDate, GOAL_SPECS, mondayOf, monthsBetween, num, sessionStatus, shiftDays, tone, WEEKDAYS, type AnswersFromRuns, type BuilderAnswers, type Goal, type PlanBlock, type Template, type Weekday } from '@logbook/shared';
import { AnimatePresence, motion } from 'motion/react';
import { useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties, type FocusEvent as ReactFocusEvent, type ReactNode } from 'react';
import { useNav, useTab } from '@/app/NavController';
import { ApiError } from '@/api/client';
import { useTemplatePlan, useTemplateUndo, type PlanTemplateResult } from '@/api/queries';
import { DISCLAIMER } from '@/lib/copy';
import { haptics } from '@/lib/haptics';
import { crossfade, reducedFade, useReduced } from '@/lib/motion';
import { Button, Note, Stepper } from '@/ui/primitives';
import { Pressable } from '@/ui/Pressable';
import { useSheet, type SheetSpec } from '@/ui/Sheet';
import { useToast } from '@/ui/Toast';
import { AssistantPermission } from '../assistant/Permission';
import '../assistant/assistant.css';
import { useLog, type Log } from '../log/useLog';
import { AssistBar, AssistVeil, useBuilderAssist } from './BuilderAssist';
import type { FlashKey } from './assistModel';
import { builderNote, builderVerb, clampTyped, raceRowWords, startWords, type BuilderPrefill } from './builderModel';
import { build, seedOf, type Seed } from './builderSeed';
import './plan.css';
import { dayRange } from '@/ui/charts/range';

/*
 * The block builder (docs/feel.md §7.4): a large sheet whose fixed header is the ghost preview (160 tall: the block's
 * shape as a grid of weeks, live as the controls change; a goal change crossfades it, nothing else moves), the controls
 * under it, and one verb in the foot that says what it does: `Use this plan`, or `Replace 44 sessions` (the date in the note).
 * The header and the body are two siblings in the sheet, so the body publishes what it built through a small store made per
 * open (`ghostStore`) and the header subscribes to it.
 *
 * The answers are one object (`BuilderAnswers`, shared with the server's contract): the controls change it by hand, and
 * the assistant at the top of the body (BuilderAssist.tsx) changes it from a sentence, with a line that says what changed
 * and Undo. A plan the assistant shaped says so in its `source`.
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
          {dayRange(tpl.start, tpl.end)}
        </span>
        <GhostGrid tpl={tpl} />
      </>
    );
  else if (g.error)
    face = (
      <>
        <span className="caps bh-caps">No plan yet</span>
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
/** Each row is a week, so the word is the kind alone (the column is 68 wide at 11 px caps). */
const KIND_WORD: Record<string, string> = { 'lead-in': 'Warm-up', build: '', down: 'Down', taper: 'Taper', race: 'Race' };

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
const L = BUILDER_LIMITS;
/** Under this height the preview header and a keyboard leave no room for the assistant's composer between them. */
const SHORT_SCREEN_PX = 700;

/** What the sheet tells the body when it closes (the body is not unmounted until the close has run). */
interface BuilderLife {
  onClose: () => void;
}

const BuilderBody = ({ log, store, seed, ghost, life }: { log: Log; store: GhostStore; seed: Seed; ghost: ReactNode; life: BuilderLife }) => {
  const sheet = useSheet();
  const nav = useNav();
  const tab = useTab();
  const toast = useToast();
  const write = useTemplatePlan();
  const undo = useTemplateUndo();
  const t = log.today;
  const [a, setA] = useState<BuilderAnswers>(seed.a);
  const aRef = useRef(a);
  aRef.current = a;
  /** Which answers were read from tracked runs and not set by the person since: those are never sent to the assistant. */
  const fromRuns = useRef<AnswersFromRuns>(seed.fromRuns);
  /** Assistant updates applied and not undone: above zero, the plan's source says the assistant shaped it. */
  const assisted = useRef(0);
  /** The controls the last assistant update (or its Undo) changed: each shows a short halo. `n` replays it. */
  const [flash, setFlash] = useState<{ keys: FlashKey[]; n: number }>({ keys: [], n: 0 });
  const { goal, weeks, runDays, longRunDay: longDay, weeklyMiles: miles, soon, race } = a;
  const isRace = goal !== 'base';
  const assist = useBuilderAssist({
    enabled: log.features.claude,
    today: t,
    answers: () => aRef.current,
    fromRuns: () => fromRuns.current,
    onChange: (next, keys, runs, by) => {
      fromRuns.current = runs;
      assisted.current = Math.max(0, assisted.current + by);
      setA(next);
      setFlash((f) => ({ keys, n: f.n + 1 }));
    },
  });
  // closing the sheet stops a request in flight at once (the body itself is unmounted only when the close has run)
  life.onClose = assist.stop;
  /** A change made by hand. It retires the assistant's line: its Undo would take this change away with its own. */
  const edit = (next: BuilderAnswers, own?: keyof AnswersFromRuns) => {
    if (own) fromRuns.current = { ...fromRuns.current, [own]: false };
    assist.retire();
    setA(next);
  };
  const setWeeks = (v: number) => edit({ ...a, weeks: v });
  // a peak never sits under the miles run now
  const setMiles = (v: number) => edit({ ...a, weeklyMiles: v, peakMiles: a.peakMiles != null && a.peakMiles < v ? v : a.peakMiles }, 'weeklyMiles');
  const setPeak = (v: number | null) => edit({ ...a, peakMiles: v == null ? null : Math.max(v, a.weeklyMiles) });
  const halo = (k: FlashKey) => (flash.keys.includes(k) ? <span className="pa-halo" data-run={flash.n % 2 ? 'a' : 'b'} style={{ '--i': flash.keys.indexOf(k) } as CSSProperties} aria-hidden="true" /> : null);
  // the body outlives nothing: a write that lands after the sheet was dismissed still says what it did (code review 1 #2)
  const alive = useRef(true);
  useEffect(() => {
    // set again on every mount: StrictMode runs the cleanup once on the dev build, and the sheet then never closed
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const pickGoal = (g: Goal) => edit({ ...a, goal: g, weeks: GOAL_SPECS[g].defaultWeeks });
  const toggleDay = (d: Weekday) => {
    if (runDays.includes(d)) {
      if (runDays.length === 1) return;
      const next = runDays.filter((x) => x !== d);
      edit({ ...a, runDays: next, longRunDay: d === longDay ? next[next.length - 1]! : longDay }, 'runDays');
    } else edit({ ...a, runDays: WEEKDAYS.filter((x) => runDays.includes(x) || x === d) }, 'runDays');
  };
  const pickLong = (d: Weekday) => edit({ ...a, longRunDay: d, runDays: runDays.includes(d) ? runDays : WEEKDAYS.filter((x) => runDays.includes(x) || x === d) }, 'runDays');
  const input = builderInput(a, t);
  const { startDate, raceDate, firstMon } = builderDates(a, t);
  // the first render reuses the seed the header was made with (the same input, built once)
  const first = useRef<Seed['built'] | null>(seed.built);
  const built = useMemo(() => {
    const f = first.current;
    first.current = null;
    return f ?? build(input);
  }, [goal, weeks, startDate, runDays.join(','), longDay, miles, raceDate, a.peakMiles]); // eslint-disable-line react-hooks/exhaustive-deps
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
    write.mutateAsync({ ...input, replace: replacing, ...(assisted.current > 0 ? { assisted: true } : {}) }).then(
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
            () => toast('Couldn’t undo. The new plan is still there.'),
          ),
        );
      },
      (e) => toast(e instanceof ApiError ? e.message : 'Couldn’t save the plan. Try again.'),
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
      // a foot that is not drawn (the assistant's composer has the keyboard) is no limit
      const limit = Math.min(kbLine, foot && foot.offsetParent ? foot.getBoundingClientRect().top : Infinity) - 12;
      const top = sc.getBoundingClientRect().top + 12;
      const r = cur.getBoundingClientRect();
      if (r.bottom > limit) sc.scrollTop += r.bottom - limit;
      else if (r.top < top) sc.scrollTop -= top - r.top;
    };
    const onIn = (e: FocusEvent) => {
      const f = e.target as HTMLElement;
      // the assistant's composer places itself (lib/keyboard.ts revealField)
      if (!f.matches('input, textarea') || f.closest('[data-pa]')) return;
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
  // the permission step takes the sheet while it is asked: the preview steps out of the header, and comes back after.
  // On a short screen (an iPhone SE, or Display Zoom) the preview also steps out while the composer has the keyboard:
  // under a fixed 172 px header there would be no room left for the composer above the keys.
  const asking = assist.asking;
  const noGhost = asking || (assist.composing && typeof window !== 'undefined' && window.innerHeight < SHORT_SCREEN_PX);
  const hadNoGhost = useRef(false);
  useEffect(() => {
    if (noGhost === hadNoGhost.current) return;
    hadNoGhost.current = noGhost;
    sheet.update({ header: noGhost ? undefined : ghost });
  }, [noGhost]); // eslint-disable-line react-hooks/exhaustive-deps
  if (asking)
    return (
      <div ref={root} className="tp is-asking">
        <AssistantPermission gate={assist.gate} retry={assist.retryConsent} date={t} inPane onNotNow={assist.notNow} />
      </div>
    );
  return (
    <div ref={root} className={`tp${assist.composing ? ' is-composing' : ''}`}>
      {assist.enabled ? <AssistBar assist={assist} /> : null}
      <section className="card tp-card pa-flashable" aria-labelledby="tp-goal">
        <span className="tp-card-h" id="tp-goal">
          Training for
        </span>
        <div className="ed-chips" role="radiogroup" aria-labelledby="tp-goal">
          {GOALS.map(([g, w]) => (
            <Pressable key={g} role="radio" aria-checked={goal === g} className={`pl-chip ${goal === g ? 'on' : ''}`} onPress={() => pickGoal(g)}>
              {w}
            </Pressable>
          ))}
        </div>
        {halo('goal')}
      </section>
      <section className="card tp-card pa-flashable" aria-labelledby="tp-days">
        <span className="tp-card-top">
          <span className="tp-card-h" id="tp-days">
            Run days
          </span>
          <span className="tp-card-s">Hold a day for the long run</span>
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
          <span className="tp-card-s">Long run</span>
          {runDays.map((d) => (
            <Pressable key={d} role="radio" aria-checked={longDay === d} className={`pl-chip sm ${longDay === d ? 'on' : ''}`} onPress={() => pickLong(d)}>
              {DAY_NAME[d].slice(0, 3)}
            </Pressable>
          ))}
        </div>
        {halo('days')}
      </section>
      <div className="tiles tp-steps">
        <div className="tile tp-step pa-flashable">
          <span className="tile-label">{raceDate ? 'Weeks to race day' : 'Weeks'}</span>
          <Stepper label="Weeks" value={weeks} onChange={setWeeks} step={1} min={L.weeksMin} max={L.weeksMax} format={(v) => `${v}`} parse={(s) => clampTyped(s, L.weeksMin, L.weeksMax)} inputProps={{ inputMode: 'numeric', onFocus: selectAll }} />
          {halo('weeks')}
        </div>
        <div className="tile tp-step pa-flashable">
          <span className="tile-label">Miles a week now</span>
          <Stepper label="Weekly miles" value={miles} onChange={setMiles} step={1} min={L.milesMin} max={L.milesMax} format={(v) => `${v}`} parse={(s) => clampTyped(s, L.milesMin, L.milesMax)} inputProps={{ inputMode: 'numeric', onFocus: selectAll }} />
          {halo('miles')}
        </div>
        {a.peakMiles != null ? (
          // a peak the assistant was asked for: the build stops there. It can be changed here, or handed back to the plan
          <div className="tile tp-step tp-peak pa-flashable">
            <span className="tp-peak-top">
              <span className="tile-label">Peak miles a week</span>
              <button type="button" className="tp-peak-clear" onClick={() => setPeak(null)}>
                Let the plan pick
              </button>
            </span>
            <Stepper label="Peak miles a week" value={a.peakMiles} onChange={setPeak} step={1} min={miles} max={L.milesMax} format={(v) => `${v}`} parse={(s) => clampTyped(s, miles, L.milesMax)} inputProps={{ inputMode: 'numeric', onFocus: selectAll }} />
            {halo('peak')}
          </div>
        ) : null}
      </div>
      <div className="group tp-opts">
        <Pressable role="switch" aria-checked={soon} className="tp-opt pa-flashable" press="surface" onPress={() => edit({ ...a, startDate: null, soon: !soon })}>
          <span className="tp-opt-main">
            <span className="tp-opt-t">Start tomorrow</span>
            <span className="tp-opt-s">{startWords(soon, startDate, firstMon, a.startDate != null)}</span>
          </span>
          <span className={`pl-switch ${soon ? 'on' : ''}`} aria-hidden="true" />
          {halo('start')}
        </Pressable>
        {isRace ? (
          <Pressable role="switch" aria-checked={race} className="tp-opt pa-flashable" press="surface" onPress={() => edit({ ...a, race: !race })}>
            <span className="tp-opt-main">
              <span className="tp-opt-t">{raceRowWords(a.raceDay)}</span>
              <span className="tp-opt-s">{raceDate ? `Race day ${fmtDate('md', raceDate)}, with a taper before it` : 'No race day: the plan just ends'}</span>
            </span>
            <span className={`pl-switch ${race ? 'on' : ''}`} aria-hidden="true" />
            {halo('race')}
          </Pressable>
        ) : null}
      </div>
      {built.error ? <Note kind="bad">{built.error}</Note> : null}
      {listTpl ? <WeekByWeek tpl={listTpl} /> : null}
      <p className="fine tp-disclaimer">{DISCLAIMER}</p>
      <div className="sheet-foot tp-foot">
        <p className="tp-note">{!tpl ? '' : builderNote(existing, from, tpl.start)}</p>
        {/* while the assistant's composer holds words, Send is the one Sky button (layout standard 2.10's rule) */}
        <Button variant={assist.typing ? 'default' : 'primary'} block className="tp-verb" disabled={!tpl || counting || write.isPending} onClick={use}>
          {write.isPending ? 'Writing it' : counting ? 'Checking your calendar…' : builderVerb(existing)}
        </Button>
      </div>
      <AssistVeil assist={assist} anchor={root} />
    </div>
  );
};

/** After the verb: the block is on the calendar, with Undo (it puts back what a replace took away). */
export const announceApplied = (toast: ReturnType<typeof useToast>, r: PlanTemplateResult, undo: () => void) => {
  const n = r.replacedIds?.length ?? 0;
  toast(`${r.block.name} is on your calendar.${n ? ` ${n} ${n === 1 ? 'session' : 'sessions'} replaced.` : ''}`, { label: 'Undo', fn: undo, duration: BLOCK_UNDO_MS });
};

/** The weeks with their numbers (the header has the shape; this has each day's miles). */
const WeekByWeek = ({ tpl }: { tpl: Template }) => {
  const byDate = new Map(tpl.sessions.map((s) => [s.date, s] as const));
  return (
    <section className="card tp-card tp-preview" aria-label="Week by week">
      <span className="tp-card-h">Week by week</span>
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
      <p className="tp-sum">{tpl.summary}</p>
    </section>
  );
};

/** The builder as a sheet spec: large, the ghost preview as its fixed header (contracts §C.1 `header`). */
export const builderSpec = (log: Log, prefill?: BuilderPrefill): SheetSpec => {
  // the header's first face is the block the controls start on: no empty face crossfading to it during the open
  // (code review 1 #9)
  const seed = seedOf(log, prefill);
  const store = ghostStore({ tpl: seed.built.tpl, error: seed.built.error, goal: seed.a.goal });
  const ghost = <GhostHeader store={store} />;
  const life: BuilderLife = { onClose: () => undefined };
  return {
    title: prefill ? 'Next plan' : 'New plan',
    detent: 'large',
    header: ghost,
    body: <BuilderBody log={log} store={store} seed={seed} ghost={ghost} life={life} />,
    onClose: () => life.onClose(),
  };
};
