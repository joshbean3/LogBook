import { monthOf, shiftDays, type Habit } from '@logbook/shared';
import { ChevronRight } from 'lucide-react';
import type * as React from 'react';
import { useMemo } from 'react';
import { useNav } from '@/app/NavController';
import { Pressable } from '@/ui/Pressable';
import { Row } from '@/ui/primitives';
import { useSheet } from '@/ui/Sheet';
import { SkeletonRows } from '@/ui/Skeleton';
import { useLog, type Log } from '../log/useLog';
import { HabitSheet } from './HabitSheet';
import { useHabitShown } from './OrbRow';
import { habitWindow, streakLine, streakParts, WINDOW_DAYS, type HabitWindow } from './stats';
import './habits.css';

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
  const sheet = useSheet();
  // the habit's own page pushes inside this sheet (a back chevron returns to the list)
  const open = (x: Habit) => sheet.push({ eyebrow: 'Habit', title: x.name, body: <HabitSheet id={x.id} /> });
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
 * Every habit's last 30 days, opened from "History" beside Today's habits: one row per habit with its streak and a 30-cell
 * grid; a row pushes that habit's page (fix a day, notes, rename, archive). Manage habits (reorder, archive) closes the
 * sheet and opens the Settings page.
 */
export const HabitsHistory = (): React.JSX.Element => {
  const nav = useNav();
  const sheet = useSheet();
  const base = useLog([]);
  const today = base.today;
  const from = shiftDays(today, -(WINDOW_DAYS - 1));
  const months = useMemo(() => [monthOf(from), monthOf(today)], [from, today]);
  const log = useLog(months);
  const loaded = !!log.boot && log.loaded(today) && log.loaded(from);
  if (!loaded) return <SkeletonRows rows={4} label="Loading habits" />;
  return (
    <div className="hv-history">
      {log.habits.length ? (
        <div className="list-edge hv-list">
          {log.habits.map((h) => (
            <StreakRow key={h.id} h={h} log={log} />
          ))}
        </div>
      ) : (
        <p className="empty">No habits yet. Add one with the + at the end of the row on Today.</p>
      )}
      <div className="list-edge hv-manage-list">
        <Row
          className="hv-manage"
          title="Manage habits"
          sub="Rename, reorder, archive"
          right={<ChevronRight size={16} aria-hidden="true" className="lrow-chev" />}
          onClick={() => {
            sheet.close();
            nav.go('/settings/habits');
          }}
          label="Manage habits: rename, reorder, archive. Open"
        />
      </div>
    </div>
  );
};

/** Open the history sheet. */
export const useOpenHabitsHistory = () => {
  const sheet = useSheet();
  return () => sheet.open({ eyebrow: `Last ${WINDOW_DAYS} days`, title: 'Habits', detent: 'large', body: <HabitsHistory /> });
};
