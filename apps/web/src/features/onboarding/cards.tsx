import { Check } from 'lucide-react';
import type * as React from 'react';
import './cards.css';

/**
 * Logbook's own cards, drawn small and still, for the welcome pager and the feature intros (inspiration §6 Onboarding:
 * "pages built from real Logbook cards", not illustrations). They use the app's real faces: caps labels, stamped numbers,
 * the serif for words, habits as lights, the session tones. Sample content, never the person's data; each card is one
 * picture to a screen reader (`role="img"` with a plain label).
 */

/** Tomorrow's morning, as Today's hero draws it: the session, the alarm, and the four stops to the door. */
export const MorningCard = (): React.JSX.Element => (
  <div className="lc lc-morning" role="img" aria-label="Tomorrow: an easy 4 miles. Alarm 6:30, run 6:45, back 7:31, out the door 8:30.">
    <span className="lc-halo" aria-hidden="true" />
    <span className="caps lc-eyebrow">Tomorrow · Out 8:30</span>
    <span className="stamp lc-big">EASY 4</span>
    <span className="display lc-line">Alarm at 6:30</span>
    <span className="lc-track" aria-hidden="true">
      {[
        ['Alarm', '6:30'],
        ['Run', '6:45'],
        ['Back', '7:31'],
        ['Leave', '8:30'],
      ].map(([k, v], i) => (
        <span key={k} className={`lc-stop ${i === 0 ? 'now' : ''}`}>
          <i />
          <span className="caps">{k}</span>
          <span className="stamp lc-stop-v">{v}</span>
        </span>
      ))}
    </span>
  </div>
);

const HABITS: Array<[string, boolean]> = [
  ['Meditate', true],
  ['Read', true],
  ['Stretch', false],
  ['Water', false],
];
const WEEK = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
/** The habits row: lights you tap, two lit, and the week's strip filling under them. */
export const HabitsCard = (): React.JSX.Element => (
  <div className="lc lc-habits" role="img" aria-label="Habits as lights: Meditate and Read are done today. Four of seven days kept this week.">
    <span className="caps lc-eyebrow">Habits · 2 of 4 today</span>
    <span className="lc-orbs" aria-hidden="true">
      {HABITS.map(([name, on]) => (
        <span key={name} className={`lc-orb ${on ? 'on' : ''}`}>
          <span className="lc-orb-ring">{on ? <Check size={22} strokeWidth={2.6} /> : <span className="lc-orb-i">{name.slice(0, 1)}</span>}</span>
          <span className="lc-orb-name">{name}</span>
        </span>
      ))}
    </span>
    <span className="lc-strip" aria-hidden="true">
      {WEEK.map((d, i) => (
        <span key={i} className={`lc-day ${i < 4 ? 'kept' : ''} ${i === 4 ? 'today' : ''}`}>
          <span className="caps">{d}</span>
          <i />
        </span>
      ))}
    </span>
  </div>
);

const SESSIONS: Array<{ d: string; n: number; label: string | null; tone?: string; miles?: number }> = [
  { d: 'Mon', n: 9, label: null },
  { d: 'Tue', n: 10, label: 'EASY 4', tone: 'easy', miles: 4 },
  { d: 'Wed', n: 11, label: 'LIFT', tone: 'lift' },
  { d: 'Thu', n: 12, label: 'TEMPO 5', tone: 'hard', miles: 5 },
  { d: 'Fri', n: 13, label: null },
  { d: 'Sat', n: 14, label: 'EASY 3', tone: 'easy', miles: 3 },
  { d: 'Sun', n: 15, label: 'LONG 8', tone: 'long', miles: 8 },
];
/** The plan's week: one row a day, the session stamped with its tone, a bar for its miles. */
export const WeekCard = ({ compact = false }: { compact?: boolean }): React.JSX.Element => (
  <div className={`lc lc-week ${compact ? 'compact' : ''}`} role="img" aria-label="A plan week: easy 4 Tuesday, a lift Wednesday, tempo 5 Thursday, easy 3 Saturday, long 8 Sunday. 20 miles.">
    <span className="lc-week-head">
      <span className="caps lc-eyebrow">Week 1 of 12 · Build</span>
      <span className="lc-week-total">
        <span className="stamp">20</span> mi
      </span>
    </span>
    <span className="lc-rows" aria-hidden="true">
      {SESSIONS.map((s) => (
        <span key={s.d} className={`lc-row ${s.label ? `t-${s.tone}` : 'rest'}`}>
          <span className="caps lc-row-d">{s.d}</span>
          <span className="lc-row-n">{s.n}</span>
          <span className="lc-row-tone" />
          <span className="lc-row-name">{s.label ? <span className="stamp">{s.label}</span> : <span className="lc-rest">Rest</span>}</span>
          {s.miles ? (
            <span className="lc-row-bar">
              <i style={{ transform: `scaleX(${s.miles / 8})` }} />
            </span>
          ) : null}
        </span>
      ))}
    </span>
  </div>
);

/** What I learned: today's line in the serif, and the month it goes into. */
export const LearnedCard = (): React.JSX.Element => (
  <div className="lc lc-learned" role="img" aria-label="What I learned today: strides are pickups, not sprints. November: 12 things.">
    <span className="lc-halo" aria-hidden="true" />
    <span className="caps lc-eyebrow">Today</span>
    <span className="display lc-quote">Strides are pickups, not sprints.</span>
    <span className="lc-month" aria-hidden="true">
      <span className="lc-month-name">November</span>
      <span className="lc-month-meta">
        <span className="stamp">12</span> things · <span className="stamp">9</span> days
      </span>
    </span>
  </div>
);

/** The journal's "Remember when": one of your own entries coming back, in your words. */
export const JournalCard = (): React.JSX.Element => (
  <div className="lc lc-journal" role="img" aria-label="Remember when: a year ago today you ran your first 10 miles and wrote, legs fine, head tired.">
    <span className="lc-halo amber" aria-hidden="true" />
    <span className="caps lc-eyebrow">Remember when · A year ago</span>
    <span className="display lc-quote">You ran your first 10 miles and wrote: “Legs fine, head tired.”</span>
  </div>
);
