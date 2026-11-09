import { fmtDate, periodOf, periodPast, shiftPeriod, type Aim, type GoalEvent, type GoalEventKind, type GoalLevel } from '@logbook/shared';
import { Check, Percent, Target, X } from 'lucide-react';
import { useState } from 'react';
import { useGoalEvents, useGoals } from '@/api/queries';
import { useToday } from '@/lib/useToday';
import { PushedBar } from '@/ui/NavBar';
import { Pressable } from '@/ui/Pressable';
import { SectionHeader } from '@/ui/layout';
import { Segmented } from '@/ui/primitives';
import { SkeletonRows } from '@/ui/Skeleton';
import { goalOf, LEVEL, periodCaps, STATUS_WORD } from './model';
import { StatusIcon, useOpenGoal } from './GoalSheets';
import './goals.css';
import './kit.css';

type View = GoalLevel | 'log';
/** How far back each level lists its periods, even the ones with no goal set: the gaps are part of the record. */
const SPAN: Record<GoalLevel, number> = { day: 30, week: 12, month: 12, year: 3 };

const LOG_WORD: Record<GoalEventKind, string> = { set: 'Set', sharpened: 'Sharpened', kept: 'Kept your words', edited: 'Edited', done: 'Done', partly: 'Partly done', missed: 'Missed', reopened: 'Reopened', cleared: 'Cleared', step: 'Checked off a step', unstep: 'Unchecked a step' };
const localDay = (iso: string) => {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

const NOUN: Record<GoalLevel, string> = { day: 'days', week: 'weeks', month: 'months', year: 'years' };

/** The tally over the listed periods, as four tiles: the hit rate, what was set, what was kept, what was missed. */
const Tally = ({ level, rows }: { level: GoalLevel; rows: Array<{ goal: Aim | null; past: boolean }> }) => {
  const set = rows.filter((r) => r.goal).length;
  const closed = rows.filter((r) => r.goal && r.past && r.goal.status !== 'open');
  const n = (s: Aim['status']) => closed.filter((r) => r.goal!.status === s).length;
  const done = n('done');
  const rate = closed.length ? Math.round((done / closed.length) * 100) : null;
  return (
    <div className="tiles g-tally" role="group" aria-label="Tally">
      <div className="tile">
        <span className="tile-label">
          <Percent size={15} aria-hidden="true" /> Hit rate
        </span>
        <span className="tile-value tnum">{rate == null ? '–' : rate}{rate == null ? null : <small>%</small>}</span>
        <span className={`tile-status ${closed.length ? '' : 'is-none'}`}>{closed.length ? `of ${closed.length} answered` : 'No data yet'}</span>
      </div>
      <div className="tile">
        <span className="tile-label">
          <Target size={15} aria-hidden="true" /> Set
        </span>
        <span className="tile-value tnum">
          {set}
          <small>of {rows.length}</small>
        </span>
        <span className="tile-status is-none">{NOUN[level]} set</span>
      </div>
      <div className="tile">
        <span className="tile-label">
          <Check size={15} aria-hidden="true" /> Done
        </span>
        <span className="tile-value tnum">{done}</span>
        <span className={`tile-status ${done ? 'is-hi' : 'is-none'}`}>{done ? 'Kept' : 'None yet'}</span>
      </div>
      <div className="tile">
        <span className="tile-label">
          <X size={15} aria-hidden="true" /> Missed
        </span>
        <span className="tile-value tnum">{n('missed')}</span>
        <span className="tile-status is-none">{n('partly')} partly</span>
      </div>
    </div>
  );
};

const Periods = ({ level, goals, today }: { level: GoalLevel; goals: Aim[]; today: string }) => {
  const open = useOpenGoal();
  const cur = periodOf(level, today);
  const rows = Array.from({ length: SPAN[level] }, (_, i) => {
    const period = shiftPeriod(level, cur, -i);
    return { period, goal: goalOf(goals, level, period), past: periodPast(level, period, today) };
  });
  return (
    <>
      <Tally level={level} rows={rows} />
      <div className="group g-group g-hist-list k-lined">
        {rows.map(({ period, goal, past }) => {
          const caps = periodCaps(level, period, today);
          const state = goal ? (goal.status === 'open' ? (past ? 'Not reviewed' : 'Open') : STATUS_WORD[goal.status]) : 'No goal set';
          return (
            <Pressable key={period} className={`g-hrow ${goal ? `is-${goal.status}` : 'is-none'} ${goal && goal.status === 'open' && past ? 'is-owed' : ''}`} press="surface" onPress={() => open(level, period)} label={`${caps}: ${goal ? goal.text : 'no goal set'}. ${state}`}>
              <span className="g-row-main">
                <span className="caps g-row-caps">{caps}</span>
                {goal ? <span className="g-row-text">{goal.text}</span> : <span className="g-row-none">No goal set</span>}
                {goal?.reflection ? <span className="g-hrow-note">{goal.reflection}</span> : null}
              </span>
              {goal ? (
                <span className={`g-state is-${goal.status}`}>
                  {goal.status !== 'open' ? <StatusIcon status={goal.status} size={13} /> : null}
                  {state}
                </span>
              ) : (
                <span />
              )}
            </Pressable>
          );
        })}
      </div>
    </>
  );
};

/** Everything that happened, newest first, grouped by the day it happened. */
const Log = ({ today }: { today: string }) => {
  const q = useGoalEvents();
  const events = q.data?.events ?? [];
  if (q.isPending && !q.data) return <SkeletonRows rows={6} label="Loading the log" />;
  if (!events.length)
    return (
      <section className="k-card g-log-empty">
        <p className="k-row-title">No changes yet</p>
        <p className="k-foot">Set a goal and every step it takes lands here.</p>
      </section>
    );
  const byDay = new Map<string, GoalEvent[]>();
  for (const e of events) {
    const d = localDay(e.at);
    byDay.set(d, [...(byDay.get(d) ?? []), e]);
  }
  return (
    <>
      {[...byDay.entries()].map(([d, list]) => (
        <section key={d} className="g-logday" aria-label={fmtDate('long', d)}>
          <SectionHeader size="sm" title={d === today ? 'Today' : fmtDate('short', d)} meta={list.length === 1 ? '1 change' : `${list.length} changes`} />
          <ol className="group g-group g-feed k-lined">
            {list.map((e) => (
              <li key={e.id} className={`g-feed-row is-${e.kind}`}>
                <span className="g-feed-top">
                  <span className="g-feed-what">
                    {LOG_WORD[e.kind]} · {LEVEL[e.level].label.toLowerCase()} goal
                  </span>
                  <span className="g-feed-when tnum">{new Date(e.at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>
                </span>
                <span className="caps g-feed-period">{periodCaps(e.level, e.period, today)}</span>
                {e.text ? <span className="g-feed-text">{e.text}</span> : null}
              </li>
            ))}
          </ol>
        </section>
      ))}
    </>
  );
};

/** The record (pushed from Goals): by level, every period with its goal and what came of it, or the log of every change. */
export default function GoalHistory(): React.JSX.Element {
  const today = useToday();
  const goals = useGoals();
  const [view, setView] = useState<View>('day');
  return (
    <div className="page g-page g-history">
      <PushedBar title="History" />
      <Segmented<View>
        label="Show"
        className="k-seg g-seg"
        value={view}
        onChange={setView}
        options={[
          ['day', 'Days'],
          ['week', 'Weeks'],
          ['month', 'Months'],
          ['year', 'Years'],
          ['log', 'Log'],
        ]}
      />
      {view === 'log' ? <Log today={today} /> : goals.data ? <Periods level={view} goals={goals.data} today={today} /> : <SkeletonRows rows={6} label="Loading goals" />}
    </div>
  );
}
