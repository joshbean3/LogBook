import type * as React from 'react';
import { setTodaySection, TODAY_SECTIONS, usePrefs, type TodaySection } from '@/lib/prefs';
import { Row } from '@/ui';
import { GoalsIcon, HabitIcon, LearnedIcon } from '@/ui/icons';
import { Footnote } from '@/ui/layout';
import { useSheet } from '@/ui/Sheet';
import { Switch, Tile, type RowIcon } from './parts';
import './settings.css';

/** The glyph of each Today section. */
const ICON: Record<TodaySection, RowIcon> = { habits: HabitIcon, day: GoalsIcon, learned: LearnedIcon };

/** One line under the list: the training card is not a row here, it follows the Fitness switch. Nothing with Fitness off. */
export const todayShowsFoot = (fitness: boolean): string | undefined => (fitness ? 'The training card shows while Fitness is on.' : undefined);

/**
 * "Today shows": a switch for each section of Today (lib/prefs.ts), and nothing to reorder. One list with two ways in:
 * the group on Settings, and the sheet behind "Edit Today" at the bottom of Today (a show and hide choice belongs on the
 * screen it changes; the Fitness switch itself is general and stays in Settings).
 */
export const TodayShowsRows = (): React.JSX.Element => {
  const prefs = usePrefs();
  return (
    <>
      {TODAY_SECTIONS.map((t) => (
        <Row key={t.id} className="s-wrap has-tile" left={<Tile icon={ICON[t.id]} />} title={t.title} sub={t.sub} right={<Switch on={prefs.today[t.id]} label={`${t.title} on Today`} onChange={(v) => setTodaySection(t.id, v)} />} />
      ))}
    </>
  );
};

const TodayShowsSheet = (): React.JSX.Element => {
  const foot = todayShowsFoot(usePrefs().fitness);
  return (
    <div className="s-today-sheet">
      <div className="group s-group">
        <TodayShowsRows />
      </div>
      {foot ? <Footnote>{foot}</Footnote> : null}
    </div>
  );
};

/** Opens the list as a sheet: Today's "Edit Today". A switch changes the page under the sheet at once. */
export const useOpenTodayShows = (): (() => void) => {
  const sheet = useSheet();
  return () => sheet.open({ title: 'Today shows', body: <TodayShowsSheet /> });
};
