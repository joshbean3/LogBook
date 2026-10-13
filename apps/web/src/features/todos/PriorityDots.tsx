import type { TodoPriority } from '@logbook/shared';

export const PRIORITY_WORD: Record<TodoPriority, string> = { 0: 'No priority', 1: 'Medium priority', 2: 'High priority' };

/** How much it matters, as white dots: one for medium, two for high. Never a colour. */
export const PriorityDots = ({ level, className = '' }: { level: TodoPriority; className?: string }) =>
  level ? (
    <span className={`prio ${className}`} role="img" aria-label={PRIORITY_WORD[level]}>
      {Array.from({ length: level }, (_, i) => (
        <i key={i} aria-hidden="true" />
      ))}
    </span>
  ) : null;
