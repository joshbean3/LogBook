import { goalProgress, type Aim, type GoalLevel } from '@logbook/shared';
import { Check, PenLine, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import { useState } from 'react';
import { useOpenAssistant } from '@/features/assistant/AskBar';
import { haptics } from '@/lib/haptics';
import { springs, useReduced } from '@/lib/motion';
import { useToday } from '@/lib/useToday';
import { Button } from '@/ui/primitives';
import { LEVEL, suggestRequest, timeUsed } from './model';
import { useReviewAccess } from './refine';
import { KPin } from './Kit';
import './goals.css';

/* The goal sheet's pieces that the sheets themselves use: the half-arc gauge and the two ways to set a goal. */

const GW = 220;
const GR = 92;
const GC = Math.PI * GR;
const arcPath = `M ${GW / 2 - GR} ${GR + 14} A ${GR} ${GR} 0 0 1 ${GW / 2 + GR} ${GR + 14}`;

/**
 * The goal's half-arc gauge (its sheet): the arc fills with the steps done, a tick marks how much of the period is used.
 * An arc short of its tick is behind the clock and turns orange. A goal with no steps fills once it is done.
 */
export const HalfGauge = ({ goal, now }: { goal: Aim; now: number }) => {
  const reduce = useReduced();
  const used = timeUsed(goal.level, goal.period, now);
  const p = goalProgress(goal);
  const n = goal.steps.length;
  const k = goal.steps.filter((x) => x.done).length;
  const behind = goal.status === 'open' && p + 0.1 < used.elapsed;
  const a = Math.PI * (1 - used.elapsed);
  const cx = GW / 2 + Math.cos(a) * GR;
  const cy = GR + 14 - Math.sin(a) * GR;
  const nx = Math.cos(a);
  const ny = -Math.sin(a);
  const word = goal.status === 'done' ? 'Kept' : goal.status === 'partly' ? 'Partly' : goal.status === 'missed' ? 'Missed' : n ? null : 'Open';
  const big = word ?? `${k} of ${n}`;
  const sub = goal.status !== 'open' ? (n ? `${k} of ${n} steps done` : 'Answered') : n ? 'steps done' : 'No steps yet';
  return (
    <div className={`g-gauge ${behind ? 'is-behind' : ''} is-${goal.status}`} role="img" aria-label={`${big}${n && goal.status === 'open' ? ' steps done' : ''}. ${used.words}.${behind ? ' Behind the clock.' : ''}`}>
      <svg viewBox={`0 0 ${GW} ${GR + 28}`} className="g-gauge-svg" aria-hidden="true">
        <path d={arcPath} className="g-gauge-track" />
        <motion.path d={arcPath} className="g-gauge-arc" strokeDasharray={GC} initial={false} animate={{ strokeDashoffset: GC * (1 - Math.max(0.001, p)) }} transition={reduce ? { duration: 0 } : springs.settle} />
        <line x1={cx - nx * 15} y1={cy - ny * 15} x2={cx + nx * 15} y2={cy + ny * 15} className="g-gauge-tick" />
      </svg>
      <div className="g-gauge-mid">
        <span className="stamp tnum g-gauge-big">
          {word ?? (
            <>
              {k}
              <small> of {n}</small>
            </>
          )}
        </span>
        <span className="g-gauge-sub">{sub}</span>
      </div>
      <p className="g-gauge-time">
        <i aria-hidden="true" /> {used.words}
        {behind ? <span className="g-gauge-behind"> · behind the clock</span> : null}
      </p>
    </div>
  );
};

type Way = 'mine' | 'suggest';

/**
 * Creating a goal: two choice cards, "Set it myself" (the editor, pushed in the sheet) or "Suggest from my last 90 days"
 * (the assistant, with the request written for it to send or change). The confirm names what happens next.
 */
export const NewGoalChoice = ({ level, period, onMine }: { level: GoalLevel; period: string; onMine: () => void }) => {
  const today = useToday();
  const ask = useOpenAssistant();
  const [way, setWay] = useState<Way>('mine');
  const access = useReviewAccess();
  const go = () => {
    haptics.select();
    if (way === 'mine') return onMine();
    // the assistant's sheet takes this one's place, its field holding the request to send or change
    ask(today, suggestRequest(level, period, today));
  };
  const cards: Array<{ id: Way; icon: React.ReactNode; title: string; sub: string }> = [
    { id: 'mine', icon: <PenLine size={20} aria-hidden="true" />, title: 'Set it myself', sub: access === 'on' ? 'Write it your way. Claude reviews the wording.' : 'Write it your way. It saves as written.' },
    { id: 'suggest', icon: <Sparkles size={20} aria-hidden="true" />, title: 'Suggest from my last 90 days', sub: 'The assistant reads your training, habits and goals, then proposes one.' },
  ];
  return (
    <div className="gsheet k-sheet">
      <div className="g-choices" role="radiogroup" aria-label="How to set it">
        {cards.map((c) => (
          <button key={c.id} type="button" role="radio" aria-checked={way === c.id} className={`g-choice ${way === c.id ? 'is-on' : ''}`} onClick={() => (setWay(c.id), haptics.select())}>
            <span className="g-choice-ic">{c.icon}</span>
            <span className="g-choice-main">
              <span className="g-choice-title">{c.title}</span>
              <span className="g-choice-sub">{c.sub}</span>
            </span>
            <span className="g-choice-check" aria-hidden="true">
              {way === c.id ? <Check size={14} strokeWidth={3} /> : null}
            </span>
          </button>
        ))}
      </div>
      <p className="k-foot gs-hint">Like: {LEVEL[level].example}</p>
      <KPin>
        <Button variant="primary" block onClick={go}>
          {way === 'mine' ? 'Write it' : 'Ask the assistant'}
        </Button>
      </KPin>
    </div>
  );
};
