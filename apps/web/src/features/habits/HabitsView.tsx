import { monthOf, shiftDays, type Habit } from '@logbook/shared';
import { ChevronRight } from 'lucide-react';
import type * as React from 'react';
import { memo, useMemo } from 'react';
import { useNav } from '@/app/NavController';
import { dayCaption, NavBar } from '@/ui/NavBar';
import { Pressable } from '@/ui/Pressable';
import { Row } from '@/ui/primitives';
import { SkeletonRows } from '@/ui/Skeleton';
import { MorningRow } from '../day/MorningRow';
import { useLog, type Log } from '../log/useLog';
import { useOpenHabit } from './HabitSheet';
import { HabitsMeta, OrbRow, useHabitShown } from './OrbRow';
import { habitWindow, streakLine, streakParts, WINDOW_DAYS, type HabitWindow } from './stats';
import './habits.css';

/** Today's morning, pushed over this tab (no date in the URL: MorningView falls back to today). */
const MORNING = '/habits/morning';
const OrbRowM = memo(OrbRow);

/** The last 30 days as a 10 × 3 grid of cells, oldest at the top left, today at the bottom right (outlined). */
const MiniGrid = ({ w }: { w: HabitWindow }) => (
  <span className="hv-grid" aria-hidden="true">
    {w.cells.map((c) => (
      <i key={c.date} className={`hv-cell ${c.on ? 'on' : ''} ${c.today ? 'is-today' : ''} ${c.before ? 'before' : ''}`} />
    ))}
  </span>
);

/** One habit in the Streaks list: its initial, its name, the streak line, the mini grid; a tap opens the habit sheet. */
const StreakRow = ({ h, log }: { h: Habit; log: Log }) => {
  const open = useOpenHabit();
  // today as the orbs show it: a tap moves the streak and the grid's last cell on its own frame, ahead of the write
  const todayOn = useHabitShown(log.today, h.id, log.snap.isHabitDone(log.today, h.id));
  const w = habitWindow((d) => (d === log.today ? todayOn : log.snap.isHabitDone(d, h.id)), log.today, h.createdOn);
  const line = streakLine(w);
  const parts = streakParts(w);
  return (
    <Pressable className="hv-row" press="surface" onPress={() => open(h)} label={`${h.name}. ${line}. Open`}>
      <span className="hv-orb" aria-hidden="true">
        {h.name.charAt(0).toUpperCase()}
      </span>
      <span className="hv-main">
        <span className="hv-name">{h.name}</span>
        {/* below 360 wide the count drops whole (the grid still shows it) rather than being cut mid-word */}
        <span className="hv-sub tnum">
          {parts.streak}
          {parts.count ? <span className="hv-count"> · {parts.count}</span> : null}
        </span>
      </span>
      <MiniGrid w={w} />
    </Pressable>
  );
};

/**
 * Habits (the tab root): today's orbs (the same row Today carried: a tap lights one, a hold opens Note · Details · Archive,
 * a move after the hold reorders, "+" adds), the This morning row (pushes today's morning over this tab), then Streaks: one
 * edge-to-edge row per habit with its last 30 days, opening the habit sheet. Archived habits are not listed; Manage habits
 * (rename, reorder, archive) is the Settings page, reached as a jump.
 */
export default function HabitsView(): React.JSX.Element {
  const nav = useNav();
  const base = useLog([]);
  const today = base.today;
  const from = shiftDays(today, -(WINDOW_DAYS - 1));
  const months = useMemo(() => [monthOf(from), monthOf(today)], [from, today]);
  const log = useLog(months);
  const loaded = !!log.boot && log.loaded(today) && log.loaded(from);
  const habits = log.habits;
  return (
    <div className="page hv-page">
      <NavBar caps={{ cur: dayCaption(today, today) }} title={{ cur: 'Habits' }} gap={24} />
      {!loaded ? (
        <SkeletonRows rows={4} label="Loading habits" />
      ) : (
        <>
          <section className="hv-today" aria-label="Today">
            <div className="sec-head hv-head">
              <h2 className="sec-title">Today</h2>
              <HabitsMeta date={today} log={log} />
            </div>
            <OrbRowM date={today} log={log} />
          </section>
          <section className="hv-morning" aria-label="Morning">
            <div className="sec-head hv-head">
              <h2 className="sec-title">Morning</h2>
            </div>
            <MorningRow date={today} log={log} to={MORNING} />
          </section>
          {habits.length ? (
            <section className="hv-streaks" aria-label="Streaks">
              <div className="sec-head hv-head">
                <h2 className="sec-title">Streaks</h2>
                <span className="sec-meta">Last {WINDOW_DAYS} days</span>
              </div>
              <div className="list-edge hv-list">
                {habits.map((h) => (
                  <StreakRow key={h.id} h={h} log={log} />
                ))}
              </div>
            </section>
          ) : null}
          <div className="list-edge hv-manage-list">
            <Row className="hv-manage" title="Manage habits" sub="Rename, reorder, archive" right={<ChevronRight size={16} aria-hidden="true" className="lrow-chev" />} onClick={() => nav.go('/settings/habits')} label="Manage habits: rename, reorder, archive. Open" />
          </div>
        </>
      )}
    </div>
  );
}
