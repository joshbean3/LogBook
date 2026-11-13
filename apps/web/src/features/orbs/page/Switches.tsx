import { ruleLine, type ChallengeSize } from '@logbook/shared';
import { BookOpenText, CalendarCheck, Check, Eye, Flag } from 'lucide-react';
import type * as React from 'react';
import { GoRow, Switch, Tile } from '@/features/settings/parts';
import { useFitness } from '@/lib/prefs';
import { Row } from '@/ui/primitives';
import { TodayIcon } from '@/ui/icons';
import { useSheet } from '@/ui/Sheet';
import { setSwitches, useChallengeCadence, useChallengeSize, useOrbsOn, useShowOrbs, useWeekTarget } from '../store';
import { HowBody } from './HowBody';
import '@/features/settings/settings.css';
import './orbs.css';

/*
 * The switches (spec section 7), one list with two ways in: the last group of the Orbs page and the "Orbs" group in
 * Settings. Every change goes through `setSwitches`, which writes this device's own key at once and the store with it.
 *
 *   Orbs                          off hides everything everywhere and pauses the count; nothing is asked, nothing is lost
 *   Show Orbs when you earn them  off, nothing pops and the count still grows
 *   Your week                     5, 4 or 3 days; the line under each is the engine's own rule line for it
 *   Challenges                    Off, One a week, Two a week, and their size: Gentle, Steady, Bold
 *   How Orbs work                 the page (from the Orbs page) or the same words in a sheet (from Settings)
 */

export const WEEK_WORD: Record<3 | 4 | 5, string> = { 5: '5 days', 4: '4 days', 3: '3 days' };
export const CADENCE_WORD: Record<0 | 1 | 2, string> = { 0: 'Off', 1: 'One a week', 2: 'Two a week' };
export const SIZE_WORD: Record<ChallengeSize, string> = { gentle: 'Gentle', steady: 'Steady', bold: 'Bold' };
/** What each size is made from: the person's own last four weeks (spec section 8). */
export const SIZE_LINE: Record<ChallengeSize, string> = {
  gentle: 'The least you did in your last four weeks',
  steady: 'What you met in three of your last four weeks',
  bold: 'What you met in two of your last four weeks',
};

/** One list of choices, one chosen: rows with a check on the chosen one (a shape, not a color alone). */
function Choices<T extends string | number>({ label, value, options, onChange }: { label: string; value: T; options: ReadonlyArray<{ value: T; title: string; sub?: string }>; onChange: (v: T) => void }): React.JSX.Element {
  return (
    <div className="group s-group orp-choices" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <Row
          key={String(o.value)}
          className="s-wrap"
          title={o.title}
          sub={o.sub}
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          right={o.value === value ? <Check size={18} className="orp-chosen" aria-hidden="true" /> : <span className="orp-unchosen" aria-hidden="true" />}
        />
      ))}
    </div>
  );
}

/** The sheet behind "Your week": 5, 4 or 3 days, each with the rule it makes. */
export const WeekChoice = (): React.JSX.Element => {
  const target = useWeekTarget();
  return (
    <div className="orp-choice-sheet">
      <Choices<3 | 4 | 5> label="Your week" value={target} onChange={(weekTarget) => setSwitches({ weekTarget })} options={([5, 4, 3] as const).map((n) => ({ value: n, title: WEEK_WORD[n], sub: ruleLine(n) }))} />
      <p className="lb-foot">A week counts with that many days. A change starts with this week.</p>
    </div>
  );
};

/** The sheet behind "Challenges": how often they are offered, and their size while they are. */
export const ChallengeChoice = (): React.JSX.Element => {
  const cadence = useChallengeCadence();
  const size = useChallengeSize();
  return (
    <div className="orp-choice-sheet">
      <Choices<0 | 1 | 2> label="How often" value={cadence} onChange={(c) => setSwitches({ cadence: c })} options={([0, 1, 2] as const).map((n) => ({ value: n, title: CADENCE_WORD[n] }))} />
      {cadence ? (
        <>
          <h3 className="orp-choice-head">Size</h3>
          <Choices<ChallengeSize> label="Size" value={size} onChange={(s) => setSwitches({ size: s })} options={(['gentle', 'steady', 'bold'] as const).map((s) => ({ value: s, title: SIZE_WORD[s], sub: SIZE_LINE[s] }))} />
        </>
      ) : null}
      <p className="lb-foot">A challenge is offered, never assigned. Skipping one costs nothing.</p>
    </div>
  );
};

export interface OrbsSwitchRowsProps {
  /** Where the rows are: the Orbs page (How Orbs work is its pushed page, first) or Settings (the same words in a sheet, last). */
  place: 'page' | 'settings';
  /** The page's own way to open "How Orbs work". */
  onHow?: () => void;
  /** The Orbs page hears the switch first: it leaves before the store changes, so nothing blinks out under the finger. */
  onOrbs?: (on: boolean) => void;
  /** The Orbs page shows its switch off while it leaves. */
  orbsShown?: boolean;
}

/**
 * The rows. With Orbs off only the switch itself and "How Orbs work" remain (the other rows change nothing while it is
 * off), as Fitness leaves only its own switch.
 */
export const OrbsSwitchRows = ({ place, onHow, onOrbs, orbsShown }: OrbsSwitchRowsProps): React.JSX.Element => {
  const on = useOrbsOn();
  const show = useShowOrbs();
  const target = useWeekTarget();
  const cadence = useChallengeCadence();
  const size = useChallengeSize();
  const fitness = useFitness();
  const sheet = useSheet();
  const how = <GoRow icon={BookOpenText} title="How Orbs work" sub="What earns them, and the count" onPress={onHow ?? (() => sheet.open({ title: 'How Orbs work', detent: 'large', body: <HowBody fitness={fitness} target={target} /> }))} />;
  return (
    <>
      {place === 'page' ? how : null}
      <Row className="s-wrap has-tile" left={<Tile icon={TodayIcon} />} title="Orbs" sub="Small lights for what you finish" right={<Switch on={orbsShown ?? on} label="Orbs" onChange={onOrbs ?? ((v) => setSwitches({ on: v }))} />} />
      {on ? (
        <>
          <Row className="s-wrap has-tile" left={<Tile icon={Eye} />} title="Show Orbs when you earn them" sub="Off, the count still grows" right={<Switch on={show} label="Show Orbs when you earn them" onChange={(v) => setSwitches({ show: v })} />} />
          <GoRow className="s-wrap" icon={CalendarCheck} title="Your week" sub={ruleLine(target)} value={WEEK_WORD[target]} label={`Your week: ${WEEK_WORD[target]}. ${ruleLine(target)}`} onPress={() => sheet.open({ title: 'Your week', body: <WeekChoice /> })} />
          <GoRow
            icon={Flag}
            title="Challenges"
            sub={cadence ? `Size: ${SIZE_WORD[size]}` : 'None are offered'}
            value={CADENCE_WORD[cadence]}
            label={`Challenges: ${CADENCE_WORD[cadence]}${cadence ? `, ${SIZE_WORD[size]}` : ''}`}
            onPress={() => sheet.open({ title: 'Challenges', body: <ChallengeChoice /> })}
          />
        </>
      ) : null}
      {place === 'settings' ? how : null}
    </>
  );
};
