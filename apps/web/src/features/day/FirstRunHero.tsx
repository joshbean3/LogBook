import { Activity, CalendarDays, ChevronRight, Sparkles } from 'lucide-react';
import type * as React from 'react';
import { Pressable } from '@/ui/Pressable';
import './day.css';

export type FirstRunAction = 'habits' | 'plan' | 'strava';

const ROWS: Array<{ key: FirstRunAction; title: string; icon: React.JSX.Element }> = [
  { key: 'habits', title: 'Add habits', icon: <Sparkles size={18} /> },
  { key: 'plan', title: 'Plan a week', icon: <CalendarDays size={18} /> },
  { key: 'strava', title: 'Connect Strava', icon: <Activity size={18} /> },
];

/**
 * The first-run face of Today's hero (docs/feel.md §3.2 last row, contracts §F): `SET UP YOUR DAY` and three starter rows in
 * the deck's column, 184 tall and 358 wide like every other face. It is the payoff of onboarding too (WP6's Welcome renders
 * it at the resting y of Today's hero slot), so it uses no tab-scoped hook: what each row does is the caller's `onAction`.
 * Today shows it in the hero slot on the first day (`DayPage`), wired to the habits sheet, the builder and the primer.
 */
export const FirstRunHero = ({ onAction }: { onAction: (k: FirstRunAction) => void }): React.JSX.Element => (
  <section className="aura first-run-hero halo-upcoming" aria-label="Set up your day">
    <span className="aura-glow" aria-hidden="true" />
    <span className="caps frh-eyebrow">Set up your day</span>
    <div className="frh-rows">
      {ROWS.map((r) => (
        <Pressable key={r.key} className="frh-row" press="surface" onPress={() => onAction(r.key)} label={r.title} data-action={r.key}>
          <span className="frh-ic" aria-hidden="true">
            {r.icon}
          </span>
          <span className="frh-title">{r.title}</span>
          <ChevronRight size={16} className="frh-chev" aria-hidden="true" />
        </Pressable>
      ))}
    </div>
  </section>
);

export default FirstRunHero;
