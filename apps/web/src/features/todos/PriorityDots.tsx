import type { TodoPriority } from '@logbook/shared';
import { Flag } from 'lucide-react';

/** P1 matters most. Stored as 3 (P1), 2 (P2), 1 (P3), 0 (none), so a higher number sorts first. */
export const PRIORITY_WORD: Record<TodoPriority, string> = { 0: 'No priority', 1: 'Priority 3', 2: 'Priority 2', 3: 'Priority 1' };
export const PRIORITY_SHORT: Record<TodoPriority, string> = { 0: 'None', 1: 'P3', 2: 'P2', 3: 'P1' };

/** How much it matters, as a flag in its level's colour: P1 red, P2 orange, P3 blue; nothing for none. `decorative` when the word is beside it. */
export const PriorityFlag = ({ level, className = '', decorative, size = 14 }: { level: TodoPriority; className?: string; decorative?: boolean; size?: number }) =>
  level ? (
    <span className={`prio prio-${level} ${className}`} role={decorative ? undefined : 'img'} aria-hidden={decorative ? true : undefined} aria-label={decorative ? undefined : PRIORITY_WORD[level]}>
      <Flag size={size} strokeWidth={2.4} fill="currentColor" fillOpacity={0.9} aria-hidden="true" />
    </span>
  ) : null;

/** The old name, kept for the rows that import it. */
export const PriorityDots = PriorityFlag;
