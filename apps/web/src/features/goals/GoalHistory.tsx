import { periodOf, periodPast, shiftPeriod, type Aim, type GoalLevel } from '@logbook/shared';
import { useState } from 'react';
import { useGoals } from '@/api/queries';
import { useToday } from '@/lib/useToday';
import { PushedBar } from '@/ui/NavBar';
import { Card, Group, Row, Segmented } from '@/ui/primitives';
import { SkeletonRows } from '@/ui/Skeleton';
import { goalOf, periodCaps, STATUS_WORD } from './model';
import { useOpenGoal } from './GoalSheets';
import './goals.css';

/** How far back each level lists its periods, even the ones with no goal set: the gaps are part of the record. */
const SPAN: Record<GoalLevel, number> = { day: 30, week: 12, month: 12, year: 3 };

/** The tally over the listed periods: caps labels over stamps, in one card. */
const Tally = ({ rows }: { rows: Array<{ goal: Aim | null; past: boolean }> }) => {
  const set = rows.filter((r) => r.goal).length;
  const closed = rows.filter((r) => r.goal && r.past);
  const n = (s: Aim['status']) => closed.filter((r) => r.goal!.status === s).length;
  const done = n('done');
  const rate = closed.length ? Math.round((done / closed.length) * 100) : null;
  const cells: Array<[string, string]> = [
    ['Set', String(set)],
    ['Done', String(done)],
    ['Missed', String(n('missed'))],
    ['Hit rate', rate == null ? '–' : `${rate}%`],
  ];
  return (
    <Card className="g-tally" role="group" aria-label="Tally">
      {cells.map(([label, value]) => (
        <span key={label} className="g-tally-cell" role="img" aria-label={`${label} ${value}`}>
          <span className="caps" aria-hidden="true">
            {label}
          </span>
          <span className="stamp tnum" aria-hidden="true">
            {value}
          </span>
        </span>
      ))}
    </Card>
  );
};

/** The record (pushed from Goals): one list, a level filter, the tally on top. Every period shows, set or not. */
export default function GoalHistory(): React.JSX.Element {
  const today = useToday();
  const goals = useGoals();
  const open = useOpenGoal();
  const [level, setLevel] = useState<GoalLevel>('day');
  const list = goals.data;
  const cur = periodOf(level, today);
  const rows = Array.from({ length: SPAN[level] }, (_, i) => {
    const period = shiftPeriod(level, cur, -i);
    return { period, goal: goalOf(list, level, period), past: periodPast(level, period, today) };
  });
  return (
    <div className="page g-page g-history">
      <PushedBar title="History" />
      <Segmented<GoalLevel>
        label="Level"
        className="g-seg"
        value={level}
        onChange={setLevel}
        options={[
          ['day', 'Days'],
          ['week', 'Weeks'],
          ['month', 'Months'],
          ['year', 'Years'],
        ]}
      />
      {!list ? (
        <SkeletonRows rows={6} label="Loading goals" />
      ) : (
        <>
          <Tally rows={rows} />
          <Group className="g-hist">
            {rows.map(({ period, goal, past }) => {
              const caps = periodCaps(level, period, today);
              const state = goal ? (goal.status === 'open' ? (past ? 'Not reviewed' : 'Open') : STATUS_WORD[goal.status]) : '';
              return (
                <Row
                  key={period}
                  className={goal ? `is-${goal.status}` : 'is-none'}
                  two
                  title={goal ? <span className="serif g-hist-text">{goal.text}</span> : <span className="g-hist-none">No goal set</span>}
                  sub={
                    <>
                      <span className="caps">{caps}</span>
                      {goal?.reflection ? <span className="g-hist-note"> · {goal.reflection}</span> : null}
                    </>
                  }
                  right={state ? <span className={`g-state is-${goal!.status}`}>{state}</span> : undefined}
                  onClick={() => open(level, period)}
                  label={`${caps}: ${goal ? goal.text : 'no goal set'}. ${state || 'Set it'}`}
                />
              );
            })}
          </Group>
        </>
      )}
    </div>
  );
}
