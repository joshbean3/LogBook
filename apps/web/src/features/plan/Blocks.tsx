import { counts, daysBetween, fmtDate, mondayOf, monthsBetween, num, sessionStatus, shiftDays, weekSummary, type Goal, type PlanBlock, type Weekday } from '@logbook/shared';
import { ChevronRight } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { useNav } from '@/app/NavController';
import { ApiError } from '@/api/client';
import { usePlanDelete } from '@/api/queries';
import { haptics } from '@/lib/haptics';
import { Button, EmptyState, Group, Row, Stepper } from '@/ui/primitives';
import { useSheet } from '@/ui/Sheet';
import { useToast } from '@/ui/Toast';
import { useLog, type Log } from '../log/useLog';
import { DayLetters } from '../onboarding/controls';
import { fixLongRun } from '../onboarding/model';
import { build, builderSpec, startOf, templateCaps, useApplyTemplate, useReplaceCount, WeekByWeek } from './Builder';
import { builderVerb, type BuilderPrefill } from './builderModel';
import { openLibrary } from './Library';
import './plan.css';

const tenth = (v: number) => num(Math.round(v * 10) / 10);
/**
 * A block's weeks as the builder numbers them: Monday-based, after a lead-in when it does not start on a Monday (`·, W1,
 * W2 …` in the builder's grid). `firstMon` is week 1's Monday; `weekOf(d)` is 0 in the lead-in.
 */
const firstMonOf = (b: PlanBlock) => (mondayOf(b.start) === b.start ? b.start : shiftDays(mondayOf(b.start), 7));
export const planWeeks = (b: PlanBlock) => {
  const m = firstMonOf(b);
  return b.end < m ? 1 : Math.floor(daysBetween(m, b.end) / 7) + 1;
};
export const weekOf = (b: PlanBlock, d: string) => {
  const m = firstMonOf(b);
  return d < m ? 0 : Math.min(planWeeks(b), Math.floor(daysBetween(m, d) / 7) + 1);
};
export const stateOf = (b: PlanBlock, t: string) => (t < b.start ? 'Upcoming' : t > b.end ? 'Finished' : 'Active');
/** The goal a block was built for, read from its name (a template names itself after the goal). */
export const goalOfBlock = (b: PlanBlock): Goal => (/^half/i.test(b.name) ? 'half' : /^marathon/i.test(b.name) ? 'marathon' : /^10k/i.test(b.name) ? '10k' : /^5k/i.test(b.name) ? '5k' : 'base');
/**
 * The plan to show: the one running today, else the next one to start, else the last one. A block that a newer one has
 * replaced is never it: Rebuild (or a new block over the old one) ends the old block the day before the new one starts, so
 * its leftover days ("Oct 15 – Oct 18") still cover today, but the plan is the new block now.
 */
export const heroBlock = (blocks: PlanBlock[], t: string): PlanBlock | null => {
  const replaced = (b: PlanBlock) => blocks.some((n) => n.id !== b.id && n.createdAt > b.createdAt && n.start > b.end && n.end >= t);
  const live = blocks.filter((b) => b.end >= t && !replaced(b));
  return (
    live.find((b) => b.start <= t) ??
    [...live].sort((a, b) => (a.start < b.start ? -1 : 1))[0] ??
    [...blocks].sort((a, b) => (a.end < b.end ? 1 : -1))[0] ??
    null
  );
};

/** Planned and run miles per week of a block, for its arc. */
export const arcOf = (log: Log, b: PlanBlock) => {
  const out: Array<{ mon: string; planned: number; ran: number }> = [];
  for (let mon = mondayOf(b.start); mon <= b.end; mon = shiftDays(mon, 7)) {
    const w = weekSummary(log.snap, mon);
    out.push({ mon, planned: w.plannedMiles, ran: w.doneMiles });
  }
  return out;
};

/** The block's arc: a box per week, planned as a ghost, run in blue over it, this week outlined. */
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

/** What the block card shows, computed once per data change (PlanView passes it to every week and month page). */
export interface BlockCardData {
  t: string;
  boot: boolean;
  b: PlanBlock | null;
  st: 'Upcoming' | 'Finished' | 'Active';
  weeks: number;
  wk: number;
  arc: Array<{ mon: string; planned: number; ran: number }>;
  peak: number;
}
export const blockCardOf = (log: Log): BlockCardData => {
  const t = log.today;
  const b = heroBlock(log.boot?.blocks ?? [], t);
  const weeks = b ? planWeeks(b) : 0;
  const st = b ? stateOf(b, t) : 'Active';
  const arc = b ? arcOf(log, b) : [];
  return { t, boot: !!log.boot, b, st, weeks, wk: b && st === 'Active' ? weekOf(b, t) : 0, arc, peak: Math.max(0, ...arc.map((w) => w.planned)) };
};

/**
 * The card's caption for the page it sits under (`page`: that page's first and last day): inside the block, that page's
 * place in it (`week 3 of 11`; a month, its weeks); before it, when it starts; after it, when it ended. With no page,
 * today's place.
 */
const whereFor = (d: BlockCardData, page?: { from: string; to: string }) => {
  const { b, st, weeks, wk } = d;
  if (!b) return '';
  const lead = `lead-in · week 1 starts ${fmtDate('md', firstMonOf(b))}`;
  const today = st === 'Active' ? (wk ? `week ${wk} of ${weeks}` : lead) : st === 'Upcoming' ? `starts ${fmtDate('md', b.start)}` : `finished ${fmtDate('md', b.end)}`;
  if (!page) return today;
  if (page.to < b.start) return `starts ${fmtDate('md', b.start)}`;
  if (page.from > b.end) return `${b.end < d.t ? 'ended' : 'ends'} ${fmtDate('md', b.end)}`;
  // a week page is one of the block's weeks (or its lead-in); a month page, the weeks it shows
  const a = weekOf(b, page.from > b.start ? page.from : b.start);
  const z = weekOf(b, page.to < b.end ? page.to : b.end);
  if (!z) return lead;
  const a1 = Math.max(1, a);
  return a1 === z ? `week ${z} of ${weeks}` : `weeks ${a1}–${z} of ${weeks}`;
};

/**
 * The block under the week (docs/system.md §2 Plan): one `Group`, a row with the block's name, its length and where this
 * page falls in it, the week-boxes arc at the right, and one row, "Change or build a plan ›", the library's door. With no
 * plan: the ghost of an arc and the one verb.
 */
export const BlockCardView = ({ data, getLog, page }: { data: BlockCardData; getLog: () => Log; page?: { from: string; to: string } }) => {
  const sheet = useSheet();
  const { t, b, arc, weeks, st } = data;
  const library = () => openLibrary(sheet, getLog());
  if (!data.boot) return null;
  if (!b)
    return (
      <div className="pl-block-empty sec-primary">
        <EmptyState ghost={<Arc weeks={GHOST_ARC} today="g0" tall />} verb={{ label: 'Pick a plan', onPress: library, primary: true }}>
          A plan lays out the weeks to a goal: building, a down week every fourth, a taper to race day.
        </EmptyState>
      </div>
    );
  const where = whereFor(data, page);
  const log = () => getLog();
  const openDetail = () => sheet.open({ eyebrow: `${st} · ${fmtDate('md', b.start)} – ${fmtDate('md', b.end)}`, title: b.name, body: <PlanDetail b={b} log={log()} /> });
  return (
    <section className="pl-block sec-primary" aria-label={`Your plan: ${b.name}, ${weeks} weeks, ${where}`}>
      <Group>
        <Row title={b.name} sub={`${weeks} ${weeks === 1 ? 'week' : 'weeks'} · ${where}`} right={<Arc weeks={arc} today={t} />} onClick={openDetail} label={`${b.name}. ${weeks} weeks, ${where}. Open`} />
        <Row title="Change or build a plan" right={<ChevronRight size={18} className="lrow-chev" aria-hidden="true" />} onClick={library} />
      </Group>
    </section>
  );
};
export const BlockCard = ({ log }: { log: Log }) => <BlockCardView data={blockCardOf(log)} getLog={() => log} />;

export interface PlanBlockProps {
  data: BlockCardData;
  getLog: () => Log;
}
/**
 * The block card's data for Plan's pages: one log over the block's months (the arc reads every week of it), computed once
 * per data change and handed to every week and month page, so the pager's six pages render one card's data, not six logs.
 */
export const usePlanBlock = (): PlanBlockProps => {
  const base = useLog([]);
  const b = heroBlock(base.boot?.blocks ?? [], base.today);
  const months = useMemo(() => (b ? monthsBetween(b.start, b.end).slice(0, 8) : []), [b?.start, b?.end]); // eslint-disable-line react-hooks/exhaustive-deps
  const log = useLog(months);
  const ref = useRef(log);
  ref.current = log;
  const data = useMemo(() => blockCardOf(log), [log.snap, log.boot, log.today]); // eslint-disable-line react-hooks/exhaustive-deps
  return useMemo(() => ({ data, getLog: () => ref.current }), [data]);
};

// ---------- the builder's door, and a plan's detail ----------
type SheetApi = ReturnType<typeof useSheet>;
/** Opens the builder (the same spec as `useOpenBuilder`). Kept for the callers that hold a log already. */
export const openTemplate = (sheet: SheetApi, log: Log, push = false, prefill?: BuilderPrefill) => {
  const spec = builderSpec(log, prefill);
  if (push) sheet.push(spec);
  else sheet.open(spec);
};

/**
 * A plan's name in a list. A rebuild ends the old block and starts one with the same name; the ended one says so with its
 * last day ("Half marathon · ended Oct 18"), so the two are never two identical rows.
 */
export const planName = (b: PlanBlock, all: PlanBlock[], t: string) => (all.some((x) => x.id !== b.id && x.name === b.name && x.start > b.end) ? `${b.name} · ${b.end < t ? 'ended' : 'ends'} ${fmtDate('md', b.end)}` : b.name);

/** One plan: its arc, what it is, Edit block, the way to its week, and Delete (with Undo, like everything else). */
export const PlanDetail = ({ b, log }: { b: PlanBlock; log: Log }) => {
  const sheet = useSheet();
  const nav = useNav();
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
    nav.go(`/plan/week/${mondayOf(b.start <= t && t <= b.end ? t : b.start)}`);
  };
  // the server deletes at once (a reload inside the Undo window shows it gone); Undo restores it once the delete has landed
  const del = () => {
    sheet.close();
    haptics.delete();
    const gone = remove.mutateAsync(b);
    gone.catch((e: unknown) => {
      toast(e instanceof ApiError && e.status !== 404 ? `Couldn’t delete the plan. ${e.message}` : 'Couldn’t delete the plan. It’s still on your calendar.');
    });
    toast('Plan deleted', {
      label: 'Undo',
      fn: () =>
        void gone.then(
          () =>
            restore.mutateAsync(b).then(
              () => undefined,
              () => toast('Couldn’t bring the plan back. Try again from the plan library.'),
            ),
          () => undefined,
        ),
    });
  };
  const editable = b.end > t;
  return (
    <div className="pl-detail">
      <Arc weeks={arc} today={t} tall />
      <p className="t-sub ink2">
        {planWeeks(b)} {planWeeks(b) === 1 ? 'week' : 'weeks'} · {b.sessionCount ?? 0} sessions{due ? ` · ${done} of ${due} kept so far` : ''}
      </p>
      {b.summary ? <p className="t-body">{b.summary}</p> : null}
      <Group>
        {editable ? <Row title="Edit block" sub="Run days and weekly target, for the weeks ahead" right={<ChevronRight size={18} className="lrow-chev" aria-hidden="true" />} onClick={() => sheet.push({ title: 'Edit block', eyebrow: b.name, detent: 'large', body: <EditBlock b={b} log={log} /> })} /> : null}
        <Row title={b.start <= t && t <= b.end ? 'This week in Plan' : 'Its first week in Plan'} right={<ChevronRight size={18} className="lrow-chev" aria-hidden="true" />} onClick={go} />
      </Group>
      <div className="sheet-foot">
        <Button variant="quiet" className="danger-text" onClick={del}>
          Delete plan
        </Button>
        <span />
      </div>
    </div>
  );
};

/**
 * Edit a block: its run days, weekly target and weeks left. The weeks ahead are rebuilt from tomorrow through the existing
 * template path (`POST /plans/template` with replace): what is done stays, the old block ends today, and Undo puts it all
 * back. The name and the goal come from the block (a rename needs a server route the API does not have).
 */
const EditBlock = ({ b, log }: { b: PlanBlock; log: Log }) => {
  const t = log.today;
  const s0 = startOf(log);
  const goal = goalOfBlock(b);
  const startDate = shiftDays(t, 1);
  const firstMon = mondayOf(startDate) === startDate ? startDate : shiftDays(mondayOf(startDate), 7);
  const left = Math.max(2, Math.floor(daysBetween(firstMon, b.end) / 7) + 1);
  const [runDays, setRunDays] = useState<Weekday[]>(s0.runDays);
  const [longDay, setLongDay] = useState<Weekday>(s0.longDay);
  const [miles, setMiles] = useState(s0.weeklyMiles);
  const [weeks, setWeeks] = useState(Math.min(30, left));
  const { apply, pending } = useApplyTemplate();
  const input = useMemo(() => ({ goal, weeks, startDate, runDays, longRunDay: fixLongRun(runDays, longDay), weeklyMiles: miles, raceDate: goal === 'base' ? null : shiftDays(firstMon, weeks * 7 - 1) }), [goal, weeks, startDate, runDays, longDay, miles, firstMon]);
  const built = useMemo(() => build(input), [input]);
  const tpl = built.tpl;
  const { existing, from, counting } = useReplaceCount(log, tpl);
  return (
    <div className="tp">
      {tpl ? <p className="caps">{templateCaps(tpl)}</p> : null}
      <div className="ed-group">
        <span className="ed-label">Run days</span>
        <DayLetters runDays={runDays} longRunDay={fixLongRun(runDays, longDay)} onChange={(d, l) => (setRunDays(d), setLongDay(l))} />
      </div>
      <div className="tp-steps">
        <div className="ed-group">
          <span className="ed-label">Weeks left</span>
          <Stepper label="Weeks left" value={weeks} onChange={setWeeks} step={1} min={2} max={30} format={(v) => `${v}`} parse={(s) => (Number(s) > 0 ? Math.round(Number(s)) : null)} inputProps={{ inputMode: 'numeric' }} />
        </div>
        <div className="ed-group">
          <span className="ed-label">Weekly target</span>
          <Stepper label="Weekly miles" value={miles} onChange={setMiles} step={1} min={3} max={150} format={(v) => `${v}`} parse={(s) => (Number(s) > 0 ? Math.round(Number(s)) : null)} inputProps={{ inputMode: 'numeric' }} />
        </div>
      </div>
      <p className="fine">From {fmtDate('short', startDate)}: the weeks ahead are written again, the runs you have done stay, and Undo puts the old weeks back.</p>
      {built.error ? <p className="t-sub ink2">{built.error}</p> : null}
      {tpl ? <WeekByWeek tpl={tpl} /> : null}
      <div className="sheet-foot tp-foot">
        <p className="tp-note">{tpl ? (existing ? 'Anything you’ve done stays, and Undo puts it all back.' : `Starts ${fmtDate('short', tpl.start)}.`) : ''}</p>
        <Button variant="primary" block className="tp-verb" disabled={!tpl || counting || pending} onClick={() => tpl && apply(input, existing > 0)}>
          {pending ? 'Writing it' : counting ? 'Checking your calendar…' : existing ? builderVerb(existing, from) : 'Rebuild the weeks ahead'}
        </Button>
      </div>
    </div>
  );
};
