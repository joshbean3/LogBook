import type { TodoPriority } from '@logbook/shared';

/** P1 matters most. Stored as 3 (P1), 2 (P2), 1 (P3), 0 (none), so a higher number sorts first. */
export const PRIORITY_WORD: Record<TodoPriority, string> = { 0: 'No priority', 1: 'Priority 3', 2: 'Priority 2', 3: 'Priority 1' };
export const PRIORITY_SHORT: Record<TodoPriority, string> = { 0: 'None', 1: 'P3', 2: 'P2', 3: 'P1' };

/** How much it matters, as a quiet 6 px dot in its level's colour (`--prio-*`): P1 red, P2 orange, P3 blue; nothing for none. `decorative` when the word is beside it. */
export const PriorityFlag = ({ level, className = '', decorative }: { level: TodoPriority; className?: string; decorative?: boolean; size?: number }) =>
  level ? <span className={`prio prio-${level} ${className}`} role={decorative ? undefined : 'img'} aria-hidden={decorative ? true : undefined} aria-label={decorative ? undefined : PRIORITY_WORD[level]} /> : null;

/** The old name, kept for the rows that import it. */
export const PriorityDots = PriorityFlag;
