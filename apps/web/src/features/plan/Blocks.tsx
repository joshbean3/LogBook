import { mondayOf, monthsBetween, shiftDays, weekTotals, fmtDate, type PlanBlock } from '@logbook/shared';
import { CalendarRange, ChevronRight, MessageCircle, Plus } from 'lucide-react';
import { useMemo, useRef } from 'react';
import { Pressable } from '@/ui/Pressable';
import { useSheet } from '@/ui/Sheet';
import { useLog, type Log } from '../log/useLog';
import { builderSpec } from './Builder';
import { type BuilderPrefill } from './builderModel';
import { PlanBuilder } from './PlanBuilder';
import { weekMiles } from '../sessions/miles';
import { phasesOf, type PhaseWeek } from './phases';
import { openPlanSummary } from './PlanSummary';
import { planWeeks, weekOf } from './topWords';
import { livePlans } from './planList';
import './plan.css';
import { dayRange } from '@/ui/charts/range';

export const stateOf = (b: PlanBlock, t: string) => (t < b.start ? 'Upcoming' : t > b.end ? 'Finished' : 'Active');
/**
 * The plan to show: the one running today, else the next one to start, else the last one. A block that a newer one has
 * replaced is never it: Rebuild (or a new block over the old one) ends the old block the day before the new one starts, so
 * its leftover days ("Oct 15 – Oct 18") still cover today, but the plan is the new block now.
 */
export const heroBlock = (all: PlanBlock[], t: string): PlanBlock | null => {
  const blocks = livePlans(all);
  const replaced = (b: PlanBlock) => blocks.some((n) => n.id !== b.id && n.createdAt > b.createdAt && n.start > b.end && n.end >= t);
  const live = blocks.filter((b) => b.end >= t && !replaced(b));
  return (
    live.find((b) => b.start <= t) ??
    [...live].sort((a, b) => (a.start < b.start ? -1 : 1))[0] ??
    [...blocks].sort((a, b) => (a.end < b.end ? 1 : -1))[0] ??
    null
  );
};

/**
 * Planned and run miles per week of a block, for its arc. Miles run count a run marked Done without Strava at its planned
 * miles, as the week line, Progress and Share count them (miles.ts).
 */
export const arcOf = (log: Log, b: PlanBlock) => {
  const out: Array<{ mon: string; planned: number; ran: number }> = [];
  for (let mon = mondayOf(b.start); mon <= b.end; mon = shiftDays(mon, 7)) {
    out.push({ mon, planned: weekTotals(log.snap, mon).planned, ran: mon <= log.today ? weekMiles(log.snap, mon, log.today).miles : 0 });
  }
  return out;
};

/** The race day of a block: the day in its last week that holds a session typed or named Race (the template's race day). */
const raceDayOf = (log: Log, b: PlanBlock): string | null => {
  for (let d = mondayOf(b.end); d <= shiftDays(mondayOf(b.end), 6); d = shiftDays(d, 1))
    if (log.snap.sessionsOn(d).some((s) => /^race\b/i.test(s.type ?? '') || /^race\b/i.test(s.title ?? ''))) return d;
  return null;
};
/** Each week's training phase (phases.ts), by its Monday. */
export const phasesFor = (log: Log, b: PlanBlock, arc: Array<{ mon: string; planned: number }>): Record<string, PhaseWeek> => {
  const p = phasesOf(
    arc.map((w) => w.planned),
    { race: raceDayOf(log, b) != null, base: /^base\b/i.test(b.name) },
  );
  return Object.fromEntries(arc.map((w, i) => [w.mon, p[i]!]));
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
  /** Each week's training phase by its Monday (empty with no block). */
  phases: Record<string, PhaseWeek>;
}
export const blockCardOf = (log: Log): BlockCardData => {
  const t = log.today;
  const b = heroBlock(log.boot?.blocks ?? [], t);
  const weeks = b ? planWeeks(b) : 0;
  const st = b ? stateOf(b, t) : 'Active';
  const arc = b ? arcOf(log, b) : [];
  return { t, boot: !!log.boot, b, st, weeks, wk: b && st === 'Active' ? weekOf(b, t) : 0, arc, peak: Math.max(0, ...arc.map((w) => w.planned)), phases: b ? phasesFor(log, b, arc) : {} };
};

export interface PlanBlockProps {
  data: BlockCardData;
  getLog: () => Log;
}
/**
 * The block card's data for Plan's pages (docs/feel.md §7.2: the week body is the week line, the seven rows and the block
 * card): one log over the block's months (the arc reads every week of it), computed once per data change and handed to
 * every week and month page, so the pager's six pages render one card's data, not six logs.
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

// ---------- the builder's door, and the plans list ----------
type SheetApi = ReturnType<typeof useSheet>;
/** Opens the builder (spec §7.4; the same spec as `useOpenBuilder`). Kept for the callers that hold a log already. */
export const openTemplate = (sheet: SheetApi, log: Log, push = false, prefill?: BuilderPrefill) => {
  const spec = builderSpec(log, prefill);
  if (push) sheet.push(spec);
  else sheet.open(spec);
};

/**
 * A plan's name in the list. A rebuild ends the old block and starts one with the same name; the ended one says so with
 * its last day ("Half marathon · ended Oct 18"), so the two are never two identical rows.
 */
export const planName = (b: PlanBlock, all: PlanBlock[], t: string) => (all.some((x) => x.id !== b.id && x.name === b.name && x.start > b.end) ? `${b.name} · ${b.end < t ? 'ended' : 'ends'} ${fmtDate('md', b.end)}` : b.name);

/**
 * Your plans, newest first, as one inset group (docs/shape-system.md §3): an icon tile, the name 17/22 over its dates and
 * length, its state, a chevron; a row opens the plan. With the AI on, "Write my next block" is a second group under the
 * list. New block is the round + in the Plans page's bar.
 */
export const PlansPanel = ({ log, inSheet }: { log: Log; inSheet?: boolean }) => {
  const sheet = useSheet();
  const t = log.today;
  const blocks = livePlans(log.boot?.blocks ?? []).sort((a, b) => (a.start < b.start ? 1 : -1));
  return (
    <div className="pl-plans">
      {blocks.length ? (
        <div className="group pl-plan-list">
          {blocks.map((b) => {
            const st = stateOf(b, t);
            const name = planName(b, blocks, t);
            const n = planWeeks(b);
            return (
              <Pressable key={b.id} press="surface" className="pl-plan-row" label={`${name}. ${fmtDate('md', b.start)} to ${fmtDate('md', b.end)}, ${n} ${n === 1 ? 'week' : 'weeks'}. ${st}`} onPress={() => openPlanDetail(sheet, b, log, inSheet)}>
                <span className={`icon-tile pl-plan-ic ${st === 'Active' ? 'is-on' : ''}`} aria-hidden="true">
                  <CalendarRange size={18} />
                </span>
                <span className="pl-plan-main">
                  <span className="pl-plan-name">{name}</span>
                  <span className="pl-plan-sub">
                    {dayRange(b.start, b.end)}
                    {/\bweeks?\b/i.test(name) ? '' : ` · ${n} ${n === 1 ? 'week' : 'weeks'}`}
                  </span>
                </span>
                <span className={`pl-plan-st ${st === 'Active' ? 'on' : ''}`}>{st}</span>
                <ChevronRight size={18} className="pl-plan-chev" aria-hidden="true" />
              </Pressable>
            );
          })}
        </div>
      ) : (
        <div className="card pl-plans-empty">
          <span className="pl-plans-empty-t">No plans yet</span>
          <span className="pl-plans-empty-s">A plan takes a minute: pick a goal, your run days and your weekly miles. Tap + to start one.</span>
        </div>
      )}
      {log.features.claude ? (
        <div className="group">
          <Pressable className="pl-plan-row pl-ai-row" press="surface" onPress={() => (inSheet ? sheet.push : sheet.open)({ title: 'Write my next plan', detent: 'large', body: <PlanBuilder log={log} /> })}>
            <span className="icon-tile pl-ai-ic" aria-hidden="true">
              <MessageCircle size={18} />
            </span>
            <span className="pl-plan-main">
              <span className="pl-plan-name">Write my next plan</span>
              <span className="pl-plan-sub">From a file, pasted text, or a sentence, with your recent weeks</span>
            </span>
            <ChevronRight size={18} className="pl-plan-chev" aria-hidden="true" />
          </Pressable>
        </div>
      ) : null}
    </div>
  );
};

/** Opens one plan's summary (from the plans list and the plan card): PlanSummary.tsx. */
export const openPlanDetail = (sheet: SheetApi, b: PlanBlock, log: Log, fromList = false) => openPlanSummary(sheet, b, log.boot?.blocks ?? [], log.today, fromList);

/** The plans list as a sheet's body: its own log, so a plan made or deleted while it is open shows at once. */
const PlansSheet = () => {
  const log = useLog([]);
  return log.boot ? <PlansPanel log={log} inSheet /> : null;
};
const NewPlanButton = () => {
  const sheet = useSheet();
  const log = useLog([]);
  return (
    <button type="button" className="icon-btn pl-new-block" aria-label="New plan" title="New plan" onClick={() => openTemplate(sheet, log, true)}>
      <Plus size={22} strokeWidth={2.2} aria-hidden="true" />
    </button>
  );
};
/**
 * All plans, opened from Plan (or from a plan's summary) as a sheet over the tab it was asked on: closing it lands back
 * where it was opened. A row pushes that plan's summary inside the same sheet. Settings keeps its own page.
 */
export const openPlans = (sheet: SheetApi, push = false) => (push ? sheet.push : sheet.open)({ title: 'Plans', detent: 'large', action: <NewPlanButton />, body: <PlansSheet /> });
