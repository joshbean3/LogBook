import { counts, daysBetween, fmtDate, mondayOf, monthsBetween, num, sessionStatus, shiftDays, weekSummary, type PlanBlock } from '@logbook/shared';
import { ChevronRight, Sparkles } from 'lucide-react';
import { useMemo, useRef } from 'react';
import { useNav } from '@/app/NavController';
import { ApiError } from '@/api/client';
import { usePlanDelete } from '@/api/queries';
import { haptics } from '@/lib/haptics';
import { Button, EmptyState } from '@/ui/primitives';
import { Pressable } from '@/ui/Pressable';
import { useSheet } from '@/ui/Sheet';
import { useToast } from '@/ui/Toast';
import { useLog, type Log } from '../log/useLog';
import { builderSpec } from './Builder';
import type { BuilderPrefill } from './builderModel';
import { PlanBuilder } from './PlanBuilder';
import './plan.css';

const tenth = (v: number) => num(Math.round(v * 10) / 10);
/**
 * A block's weeks as the builder numbers them (code review 2 #9): Monday-based, after a lead-in when it does not start on
 * a Monday (`·, W1, W2 …` in the builder's grid). `firstMon` is week 1's Monday; `weekOf(d)` is 0 in the lead-in.
 */
const firstMonOf = (b: PlanBlock) => (mondayOf(b.start) === b.start ? b.start : shiftDays(mondayOf(b.start), 7));
const planWeeks = (b: PlanBlock) => {
  const m = firstMonOf(b);
  return b.end < m ? 1 : Math.floor(daysBetween(m, b.end) / 7) + 1;
};
const weekOf = (b: PlanBlock, d: string) => {
  const m = firstMonOf(b);
  return d < m ? 0 : Math.min(planWeeks(b), Math.floor(daysBetween(m, d) / 7) + 1);
};
const stateOf = (b: PlanBlock, t: string) => (t < b.start ? 'Upcoming' : t > b.end ? 'Finished' : 'Active');
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
 * The block you are on, as one card under the week (spec §7.2: card 20/16, 128 tall): `WEEK 3 OF 11`, its name 22/28, the
 * arc of its weeks (24), and one 44 row, `New block ›`, the builder's door (a large sheet). The card itself is not a button:
 * the plans list lives in Settings › Plans. With no plan: the ghost of an arc and the one verb, New block.
 */
/**
 * The card's caption for the page it sits under (`page`: that page's first and last day): inside the block, that page's
 * place in it (`WEEK 3 OF 11`; a month, its weeks); before it, when it starts; after it, when it ended (review-feel-1 #10).
 * With no page, today's place.
 */
const whereFor = (d: BlockCardData, page?: { from: string; to: string }) => {
  const { b, st, weeks, wk } = d;
  if (!b) return '';
  const lead = `Lead-in · Week 1 starts ${fmtDate('md', firstMonOf(b))}`;
  const today = st === 'Active' ? (wk ? `Week ${wk} of ${weeks}` : lead) : st === 'Upcoming' ? `Starts ${fmtDate('md', b.start)}` : `Finished ${fmtDate('md', b.end)}`;
  if (!page) return today;
  if (page.to < b.start) return `Starts ${fmtDate('md', b.start)}`;
  if (page.from > b.end) return `${b.end < d.t ? 'Ended' : 'Ends'} ${fmtDate('md', b.end)}`;
  // a week page is one of the block's weeks (or its lead-in); a month page, the weeks it shows
  const a = weekOf(b, page.from > b.start ? page.from : b.start);
  const z = weekOf(b, page.to < b.end ? page.to : b.end);
  if (!z) return lead;
  const a1 = Math.max(1, a);
  return a1 === z ? `Week ${z} of ${weeks}` : `Weeks ${a1}–${z} of ${weeks}`;
};

export const BlockCardView = ({ data, getLog, page }: { data: BlockCardData; getLog: () => Log; page?: { from: string; to: string } }) => {
  const sheet = useSheet();
  const { t, b, arc, peak } = data;
  // the builder's door (useOpenBuilder's spec, with the card's log at the tap)
  const openNew = () => openTemplate(sheet, getLog());
  if (!data.boot) return null;
  if (!b)
    return (
      <div className="pl-block-empty sec-primary">
        <EmptyState ghost={<Arc weeks={GHOST_ARC} today="g0" tall />} verb={{ label: 'New block', onPress: openNew, primary: true }}>
          A block lays out the weeks to a goal: building, a down week every fourth, a taper to race day.
        </EmptyState>
      </div>
    );
  const where = whereFor(data, page);
  return (
    <section className="pl-block sec-primary" aria-label={`Your block: ${b.name}. ${where}. ${fmtDate('md', b.start)} to ${fmtDate('md', b.end)}${peak ? `, peaks at ${tenth(peak)} miles` : ''}`}>
      <div className="pl-block-main">
        <span className="caps pl-block-cap">{where}</span>
        <span className="pl-block-name">{b.name}</span>
        <Arc weeks={arc} today={t} />
      </div>
      <Pressable className="pl-block-new" press="surface" onPress={openNew} label="New block">
        <span>New block</span>
        <ChevronRight size={18} aria-hidden="true" />
      </Pressable>
    </section>
  );
};
export const BlockCard = ({ log }: { log: Log }) => <BlockCardView data={blockCardOf(log)} getLog={() => log} />;

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
 * Your plans, newest first, as one inset group of 60 px rows (name 17/22, dates 13/18, its state); a row opens the plan.
 * With the AI on, "Write my next block" sits under the list. New block is in the Plans page's bar.
 */
export const PlansPanel = ({ log }: { log: Log }) => {
  const sheet = useSheet();
  const t = log.today;
  const blocks = [...(log.boot?.blocks ?? [])].sort((a, b) => (a.start < b.start ? 1 : -1));
  return (
    <div className="pl-plans">
      {blocks.length ? (
        <div className="pl-group pl-plan-list">
          {blocks.map((b) => {
            const st = stateOf(b, t);
            const name = planName(b, blocks, t);
            const n = planWeeks(b);
            return (
              <Pressable
                key={b.id}
                press="surface"
                className="pl-plan-row"
                label={`${name}. ${st}. ${fmtDate('md', b.start)} to ${fmtDate('md', b.end)}, ${n} ${n === 1 ? 'week' : 'weeks'}`}
                onPress={() => sheet.open({ eyebrow: `${st} · ${fmtDate('md', b.start)} – ${fmtDate('md', b.end)}`, title: name, body: <PlanDetail b={b} log={log} /> })}
              >
                <span className="pl-plan-main">
                  <span className="pl-plan-name">{name}</span>
                  <span className="pl-sub">
                    {fmtDate('md', b.start)} – {fmtDate('md', b.end)} · {n} {n === 1 ? 'week' : 'weeks'}
                  </span>
                </span>
                <span className={`pl-plan-st ${st === 'Active' ? 'on' : ''}`}>{st}</span>
                <ChevronRight size={18} className="ink3" aria-hidden="true" />
              </Pressable>
            );
          })}
        </div>
      ) : (
        <p className="t-sub ink2 pl-plans-empty">No plans yet. A block takes a minute: pick a goal, your run days and your weekly miles.</p>
      )}
      {log.features.claude ? (
        <Pressable className="pl-ai-row" press="surface" onPress={() => sheet.open({ title: 'Write my next block', detent: 'large', body: <PlanBuilder log={log} /> })}>
          <Sparkles size={18} aria-hidden="true" />
          <span>
            <b>Write my next block</b>
            <span className="pl-sub">From a file, pasted text, or a sentence, with your recent weeks</span>
          </span>
          <ChevronRight size={18} aria-hidden="true" />
        </Pressable>
      ) : null}
    </div>
  );
};

/** One plan: its arc, what it is, the way to its week, and Delete (with Undo, like everything else). */
const PlanDetail = ({ b, log }: { b: PlanBlock; log: Log }) => {
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
            // the plan back in the list is the answer; only a failure says something (spec §8)
            restore.mutateAsync(b).then(
              () => undefined,
              () => toast('Couldn’t bring the plan back. Try again from Plans.'),
            ),
          () => undefined,
        ),
    });
  };
  return (
    <div className="pl-detail">
      <Arc weeks={arc} today={t} tall />
      <p className="t-sub ink2">
        {planWeeks(b)} {planWeeks(b) === 1 ? 'week' : 'weeks'} · {b.sessionCount ?? 0} sessions{due ? ` · ${done} of ${due} kept\u00a0so\u00a0far` : ''}
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
