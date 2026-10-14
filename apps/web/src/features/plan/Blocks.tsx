import { buildTemplate, counts, daysBetween, fmtDate, GOAL_SPECS, mondayOf, monthsBetween, num, parseISO, sessionStatus, shiftDays, TemplateError, tone, weekdayOf, weekSummary, WEEKDAYS, type Goal, type PlanBlock, type Template, type Weekday } from '@logbook/shared';
import { ChevronRight, Plus, Sparkles } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { ApiError } from '@/api/client';
import { usePlanDelete, useTemplatePlan, useTemplateUndo, type PlanTemplateResult } from '@/api/queries';
import { haptics } from '@/lib/haptics';
import { Button, EmptyState, Note, Stepper } from '@/ui/primitives';
import { Pressable } from '@/ui/Pressable';
import { useSheet } from '@/ui/Sheet';
import { useToast } from '@/ui/Toast';
import { useLog, type Log } from '../log/useLog';
import { PlanBuilder } from './PlanBuilder';
import './plan.css';

const tenth = (v: number) => num(Math.round(v * 10) / 10);
const planWeeks = (b: PlanBlock) => Math.ceil((daysBetween(b.start, b.end) + 1) / 7);
const stateOf = (b: PlanBlock, t: string) => (t < b.start ? 'Upcoming' : t > b.end ? 'Finished' : 'Active');
/** The plan to show: the one running today, else the next one to start, else the last one. */
export const heroBlock = (blocks: PlanBlock[], t: string): PlanBlock | null =>
  blocks.find((b) => b.start <= t && t <= b.end) ?? [...blocks].filter((b) => b.start > t).sort((a, b) => (a.start < b.start ? -1 : 1))[0] ?? [...blocks].sort((a, b) => (a.end < b.end ? 1 : -1))[0] ?? null;

/** Planned and run miles per week of a block, for its arc. */
const arcOf = (log: Log, b: PlanBlock) => {
  const out: Array<{ mon: string; planned: number; ran: number }> = [];
  for (let mon = mondayOf(b.start); mon <= b.end; mon = shiftDays(mon, 7)) {
    const w = weekSummary(log.snap, mon);
    out.push({ mon, planned: w.plannedMiles, ran: w.doneMiles });
  }
  return out;
};

/** The block's arc: a bar per week, planned as a ghost, run in blue over it, this week outlined. */
export const Arc = ({ weeks, today, tall }: { weeks: Array<{ mon: string; planned: number; ran: number }>; today: string; tall?: boolean }) => {
  const max = Math.max(1, ...weeks.map((w) => Math.max(w.planned, w.ran)));
  const now = mondayOf(today);
  return (
    <div className={`pl-arc ${tall ? 'tall' : ''}`} aria-hidden="true">
      {weeks.map((w) => (
        <span key={w.mon} className={`pl-arc-wk ${w.mon === now ? 'is-now' : ''} ${w.mon > now ? 'ahead' : ''}`}>
          <i className="plan" style={{ height: `${(w.planned / max) * 100}%` }} />
          {w.mon <= now ? <i className="ran" style={{ height: `${(Math.min(w.ran, max) / max) * 100}%` }} /> : null}
        </span>
      ))}
    </div>
  );
};

const GHOST_ARC = [14, 16, 17.5, 13, 19, 21, 23, 17, 24, 26, 15, 9].map((p, i) => ({ mon: `g${i}`, planned: p, ran: 0 }));

/**
 * The block you are on, as one card under the week: where you are in it, its arc, and New block. Tap it for your plans.
 * With no plan: the ghost of an arc and the one verb, New block. It never promises more than the template sheet gives.
 */
export const BlockCard = ({ log }: { log: Log }) => {
  const sheet = useSheet();
  const t = log.today;
  const blocks = log.boot?.blocks ?? [];
  const b = heroBlock(blocks, t);
  const openNew = () => openTemplate(sheet, log);
  if (!log.boot) return null;
  if (!b)
    return (
      <div className="pl-block-empty sec-primary">
        <EmptyState ghost={<Arc weeks={GHOST_ARC} today="g0" tall />} verb={{ label: 'New block', onPress: openNew, primary: true }}>
          A block lays out the weeks to a goal: building, a down week every fourth, a taper to race day.
        </EmptyState>
      </div>
    );
  const weeks = planWeeks(b);
  const st = stateOf(b, t);
  const wk = st === 'Active' ? Math.min(weeks, Math.floor(daysBetween(b.start, t) / 7) + 1) : 0;
  const arc = arcOf(log, b);
  const peak = Math.max(0, ...arc.map((w) => w.planned));
  return (
    <section className="pl-block sec-primary" aria-label="Your block">
      <Pressable className="pl-block-main" pressScale={0.985} onPress={() => openPlans(sheet, log)} label={`${b.name}. ${st === 'Active' ? `Week ${wk} of ${weeks}` : st}. Your plans`}>
        <span className="pl-block-top">
          <span className="caps">{st === 'Active' ? `Week ${wk} of ${weeks}` : st === 'Upcoming' ? `Starts ${fmtDate('md', b.start)}` : `Finished ${fmtDate('md', b.end)}`}</span>
          <ChevronRight size={18} aria-hidden="true" />
        </span>
        <span className="pl-block-name">{b.name}</span>
        <Arc weeks={arc} today={t} />
        <span className="pl-block-sub">
          {fmtDate('md', b.start)} – {fmtDate('md', b.end)}
          {peak ? ` · peaks at ${tenth(peak)} mi` : ''}
        </span>
      </Pressable>
      <button type="button" className="pl-block-new" onClick={openNew}>
        <Plus size={18} aria-hidden="true" />
        New block
      </button>
    </section>
  );
};

// ---------- the plans sheet ----------
type SheetApi = ReturnType<typeof useSheet>;
export const openPlans = (sheet: SheetApi, log: Log) => sheet.open({ title: 'Plans', body: <PlansPanel log={log} /> });
export const openTemplate = (sheet: SheetApi, log: Log, push = false) => {
  const spec = { title: 'New block', detent: 'large' as const, body: <TemplatePanel log={log} /> };
  if (push) sheet.push(spec);
  else sheet.open(spec);
};

/** Your plans, newest first, each one a row; New block (the one blue) and, with the AI on, "Write my next block". */
const PlansPanel = ({ log }: { log: Log }) => {
  const sheet = useSheet();
  const t = log.today;
  const blocks = [...(log.boot?.blocks ?? [])].sort((a, b) => (a.start < b.start ? 1 : -1));
  return (
    <div className="pl-plans">
      {blocks.length ? (
        <div className="list-edge pl-plan-list">
          {blocks.map((b) => {
            const st = stateOf(b, t);
            return (
              <button key={b.id} type="button" className="pl-plan-row" onClick={() => sheet.push({ eyebrow: `${st} · ${fmtDate('md', b.start)} – ${fmtDate('md', b.end)}`, title: b.name, body: <PlanDetail b={b} log={log} /> })}>
                <span className="pl-plan-main">
                  <span className="pl-plan-name">{b.name}</span>
                  <span className="pl-sub">
                    {fmtDate('md', b.start)} – {fmtDate('md', b.end)} · {planWeeks(b)} weeks
                  </span>
                </span>
                <span className={`chip ${st === 'Active' ? 'open' : st === 'Upcoming' ? 'upcoming' : ''}`}>{st}</span>
                <ChevronRight size={18} className="ink3" aria-hidden="true" />
              </button>
            );
          })}
        </div>
      ) : (
        <p className="t-sub ink2">No plans yet. A block takes a minute: pick a goal, your run days and your weekly miles.</p>
      )}
      {log.features.claude ? (
        <button type="button" className="pl-ai-row" onClick={() => sheet.push({ title: 'Write my next block', detent: 'large', body: <PlanBuilder log={log} /> })}>
          <Sparkles size={18} aria-hidden="true" />
          <span>
            <b>Write my next block</b>
            <span className="pl-sub">From a file, pasted text, or a sentence, with your recent weeks</span>
          </span>
          <ChevronRight size={18} aria-hidden="true" />
        </button>
      ) : null}
      <div className="sheet-foot">
        <span />
        <div className="foot-right">
          <Button variant="primary" onClick={() => openTemplate(sheet, log, true)}>
            New block
          </Button>
        </div>
      </div>
    </div>
  );
};

/** One plan: its arc, what it is, the way to its week, and Delete (with Undo, like everything else). */
const PlanDetail = ({ b, log }: { b: PlanBlock; log: Log }) => {
  const sheet = useSheet();
  const nav = useNavigate();
  const toast = useToast();
  const { remove, restore } = usePlanDelete();
  const t = log.today;
  const arc = arcOf(log, b);
  let done = 0;
  let due = 0;
  for (let d = b.start; d <= b.end && d < t; d = shiftDays(d, 1))
    for (const s of log.snap.sessionsOn(d)) {
      if (s.kind === 'rest') continue;
      const st = sessionStatus(log.snap, d, s);
      if (st === 'skipped') continue;
      due++;
      if (counts(st)) done++;
    }
  const go = () => {
    sheet.close();
    nav(`/plan/week/${b.start <= t && t <= b.end ? t : b.start}`);
  };
  // the server deletes at once (a reload inside the Undo window shows it gone); Undo restores it once the delete has landed
  const del = () => {
    sheet.close();
    haptics.delete();
    const gone = remove.mutateAsync(b);
    gone.catch((e: unknown) => {
      haptics.error();
      toast(e instanceof ApiError && e.status !== 404 ? `Couldn’t delete the plan. ${e.message}` : 'Couldn’t delete the plan. It’s still on your calendar.');
    });
    toast('Plan deleted', {
      label: 'Undo',
      fn: () =>
        void gone.then(
          () =>
            restore.mutate(b, {
              onSuccess: () => haptics.toggle(),
              onError: () => (haptics.error(), toast('Couldn’t bring the plan back. Try again from Plans.')),
            }),
          () => undefined,
        ),
    });
  };
  return (
    <div className="pl-detail">
      <Arc weeks={arc} today={t} tall />
      <p className="t-sub ink2">
        {planWeeks(b)} weeks · {b.sessionCount ?? 0} sessions{due ? ` · ${done} of ${due} kept so far` : ''}
      </p>
      {b.summary ? <p className="t-body">{b.summary}</p> : null}
      <div className="sheet-foot">
        <Button variant="quiet" className="danger-text" onClick={del}>
          Delete plan
        </Button>
        <div className="foot-right">
          <Button variant="soft" onClick={go}>
            {b.start <= t && t <= b.end ? 'This week' : 'Its first week'}
          </Button>
        </div>
      </div>
    </div>
  );
};

// ---------- New block: the template picker ----------
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

/** What the last four weeks say: the days you run and your weekly miles, as the picker's starting point. */
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
 * Pick a goal, the weeks, your run days (tap a letter; hold one for the long run, or pick it in the row under), and your
 * weekly miles: the block draws itself underneath as ghosted weeks, straight from `buildTemplate`, before anything is saved.
 * "Use this plan" writes it (`POST /plans/template`).
 */
const TemplatePanel = ({ log }: { log: Log }) => {
  const sheet = useSheet();
  const nav = useNavigate();
  const toast = useToast();
  const write = useTemplatePlan();
  const undo = useTemplateUndo();
  const t = log.today;
  const start0 = useMemo(() => habitsOf(log), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [goal, setGoal] = useState<Goal>('base');
  const [weeks, setWeeks] = useState(GOAL_SPECS.base.defaultWeeks);
  const [runDays, setRunDays] = useState<Weekday[]>(start0.runDays);
  const [longDay, setLongDay] = useState<Weekday>(start0.runDays.includes('sun') ? 'sun' : start0.runDays[start0.runDays.length - 1]!);
  const [miles, setMiles] = useState(start0.weeklyMiles);
  const [soon, setSoon] = useState(false);
  const [race, setRace] = useState(true);
  const nextMon = shiftDays(mondayOf(t), 7);
  const startDate = soon ? shiftDays(t, 1) : nextMon;
  const firstMon = parseISO(startDate).getDay() === 1 ? startDate : shiftDays(mondayOf(startDate), 7);
  const isRace = goal !== 'base';
  const raceDate = isRace && race ? shiftDays(firstMon, weeks * 7 - 1) : null;
  const pickGoal = (g: Goal) => {
    haptics.select();
    setGoal(g);
    setWeeks(GOAL_SPECS[g].defaultWeeks);
  };
  const toggleDay = (d: Weekday) => {
    haptics.select();
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
    haptics.select();
    setLongDay(d);
    setRunDays((xs) => (xs.includes(d) ? xs : WEEKDAYS.filter((x) => xs.includes(x) || x === d)));
  };
  const input = { goal, weeks, startDate, runDays, longRunDay: longDay, weeklyMiles: miles, raceDate };
  const built = useMemo((): { tpl: Template | null; error: string | null } => {
    try {
      return { tpl: buildTemplate(input), error: null };
    } catch (e) {
      return { tpl: null, error: e instanceof TemplateError ? e.message : 'That block doesn’t work. Change the weeks or the days.' };
    }
  }, [goal, weeks, startDate, runDays.join(','), longDay, miles, raceDate]); // eslint-disable-line react-hooks/exhaustive-deps
  const tpl = built.tpl;
  // what a replace would clear: planned, not kept, from the block's first day (never before today), counted from the
  // months it spans (fetched here, so a block reaching past the prefetched weeks still counts every session it replaces)
  const span = useLog(useMemo(() => (tpl ? monthsBetween(tpl.start > t ? tpl.start : t, tpl.end) : []), [tpl?.start, tpl?.end, t])); // eslint-disable-line react-hooks/exhaustive-deps
  const from = tpl ? (tpl.start > t ? tpl.start : t) : t;
  const existing = tpl ? replaceable(span, from, tpl.end) : 0;
  const counting = !!tpl && !span.ready;
  const use = () => {
    if (!tpl || counting) return;
    const replacing = existing > 0;
    if (replacing) haptics.delete();
    write.mutate(
      { ...input, replace: replacing },
      {
        onSuccess: (r) => {
          haptics.success();
          sheet.close();
          nav(`/plan/week/${r.block.start}`);
          announceApplied(toast, r, replacing, () => undo.mutate(r, { onSuccess: () => (haptics.toggle(), toast('Put back as it was.')), onError: () => (haptics.error(), toast('Couldn’t undo. The new block is still there.')) }));
        },
        onError: (e) => {
          haptics.error();
          toast(e instanceof ApiError ? e.message : 'Couldn’t save the block. Try again.');
        },
      },
    );
  };
  return (
    <div className="tp">
      <div className="ed-group">
        <span className="ed-label" id="tp-goal">
          Training for
        </span>
        <div className="ed-chips" role="radiogroup" aria-labelledby="tp-goal">
          {GOALS.map(([g, w]) => (
            <button key={g} type="button" role="radio" aria-checked={goal === g} className={`pl-chip ${goal === g ? 'on' : ''}`} onClick={() => pickGoal(g)}>
              {w}
            </button>
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
              <Pressable key={d} className={`tp-day ${on ? 'on' : ''} ${longDay === d ? 'long' : ''}`} aria-pressed={on} label={`${DAY_NAME[d]}${on ? ', a run day' : ''}${longDay === d ? ', long run' : ''}`} onPress={() => toggleDay(d)} onLongPress={() => pickLong(d)}>
                <span>{LETTER[d]}</span>
                {longDay === d ? <small>Long</small> : null}
              </Pressable>
            );
          })}
        </div>
        <div className="ed-chips tp-long" role="radiogroup" aria-label="Long run day">
          <span className="ink3 t-sub">Long run</span>
          {runDays.map((d) => (
            <button key={d} type="button" role="radio" aria-checked={longDay === d} className={`pl-chip sm ${longDay === d ? 'on' : ''}`} onClick={() => pickLong(d)}>
              {DAY_NAME[d].slice(0, 3)}
            </button>
          ))}
        </div>
      </div>
      <div className="tp-steps">
        <div className="ed-group">
          <span className="ed-label">{raceDate ? 'Weeks to race day' : 'Weeks'}</span>
          <Stepper label="Weeks" value={weeks} onChange={setWeeks} step={1} min={2} max={30} format={(v) => `${v}`} parse={(s) => (Number(s) > 0 ? Math.round(Number(s)) : null)} inputProps={{ inputMode: 'numeric' }} />
        </div>
        <div className="ed-group">
          <span className="ed-label">Miles a week now</span>
          <Stepper label="Weekly miles" value={miles} onChange={setMiles} step={1} min={3} max={150} format={(v) => `${v}`} parse={(s) => (Number(s) > 0 ? Math.round(Number(s)) : null)} inputProps={{ inputMode: 'numeric' }} />
        </div>
      </div>
      <div className="ed-chips">
        <button type="button" role="switch" aria-checked={soon} className={`pl-chip ${soon ? 'on' : ''}`} onClick={() => (haptics.toggle(), setSoon((v) => !v))}>
          Start tomorrow
        </button>
        {isRace ? (
          <button type="button" role="switch" aria-checked={race} className={`pl-chip ${race ? 'on' : ''}`} onClick={() => (haptics.toggle(), setRace((v) => !v))}>
            Race on the last Sunday
          </button>
        ) : null}
      </div>
      {built.error ? <Note kind="bad">{built.error}</Note> : null}
      {tpl ? <TemplatePreview tpl={tpl} /> : null}
      {existing ? (
        <p className="tp-replace" role="note">
          This takes the place of {existing} planned {existing === 1 ? 'session' : 'sessions'} from {fmtDate('md', from)}. Anything you’ve done stays, and Undo puts it all back.
        </p>
      ) : null}
      <div className="sheet-foot tp-foot">
        <span className="tp-note">{tpl && !existing ? `Starts ${fmtDate('short', tpl.start)}.` : ''}</span>
        <div className="foot-right">
          <Button variant="primary" disabled={!tpl || counting || write.isPending} onClick={use}>
            {write.isPending ? 'Writing it' : existing ? `Replace ${existing} ${existing === 1 ? 'session' : 'sessions'}` : 'Use this plan'}
          </Button>
        </div>
      </div>
    </div>
  );
};

/** Sessions a replace from `from` would take away: planned and not kept (Done or Floor), up to the block's end. */
const replaceable = (log: Log, from: string, to: string) => {
  let n = 0;
  for (let d = from; d <= to; d = shiftDays(d, 1)) for (const s of log.snap.sessionsOn(d)) if (!counts(sessionStatus(log.snap, d, s))) n++;
  return n;
};

/** How long the Undo after a replace stays up (the Toast honours `duration` once foundation adds it; 6.5s until then). */
const REPLACE_UNDO_MS = 8000;
/**
 * The toast after "Use this plan". A replace always carries Undo (contract 1's `POST /plans/template/undo`), when the
 * server said what it replaced; a plain new block just says it is on the calendar.
 */
const announceApplied = (toast: ReturnType<typeof useToast>, r: PlanTemplateResult, replacing: boolean, undo: () => void) => {
  if (!replacing) return toast(`${r.block.name} is on your calendar.`);
  const n = r.replacedIds?.length ?? r.removed;
  const text = `${r.block.name} is on your calendar. ${n} ${n === 1 ? 'session' : 'sessions'} replaced.`;
  if (!r.replacedIds) return toast(text);
  const action = { label: 'Undo', fn: undo, duration: REPLACE_UNDO_MS };
  toast(text, action);
};

/** The block as ghosted weeks: each week's seven days (miles in their colour), its kind and its total. Nothing is saved yet. */
const TemplatePreview = ({ tpl }: { tpl: Template }) => {
  const byDate = new Map(tpl.sessions.map((s) => [s.date, s] as const));
  return (
    <div className="tp-preview" aria-label={`Preview: ${tpl.name}`}>
      <div className="tp-head">
        <span className="tp-name">{tpl.name}</span>
        <p className="t-sub ink2">{tpl.summary}</p>
      </div>
      <div className="tp-weeks" aria-hidden="true">
        {tpl.weeks.map((w) => {
          const mon = mondayOf(w.start);
          return (
            <div key={w.week} className={`tp-week k-${w.kind}`}>
              <span className="tp-wk">
                <b>{w.week === 0 ? '·' : `W${w.week}`}</b>
                <small>{fmtDate('md', mon)}</small>
              </span>
              <span className="tp-cells">
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
      <p className="fine">Each run’s type sets its floor. {tpl.sessions.length} runs. Nothing is saved until you use it.</p>
    </div>
  );
};
