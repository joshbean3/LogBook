import type { TodoPriority } from '@logbook/shared';

export const PRIORITY_WORD: Record<TodoPriority, string> = { 0: 'No priority', 1: 'Medium priority', 2: 'High priority' };

/** How much it matters, as white dots: one for medium, two for high. Never a colour. `decorative` when the word is beside it. */
export const PriorityDots = ({ level, className = '', decorative }: { level: TodoPriority; className?: string; decorative?: boolean }) =>
  level ? (
    <span className={`prio ${className}`} role={decorative ? undefined : 'img'} aria-hidden={decorative ? true : undefined} aria-label={decorative ? undefined : PRIORITY_WORD[level]}>
      {Array.from({ length: level }, (_, i) => (
        <i key={i} aria-hidden="true" />
      ))}
    </span>
  ) : null;
