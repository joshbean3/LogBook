import { ChevronRight } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import type * as React from 'react';
import type { ReactNode } from 'react';
import { springs } from '@/lib/motion';
import { Group, Row, Section } from '@/ui';

/** The chevron of a row that pushes (or opens) something. */
export const Chev = (): React.JSX.Element => <ChevronRight size={18} className="s-chev" aria-hidden="true" />;

/**
 * One inset group under its sentence-case title (§8: the root's `You · Training · Habits · Morning routine · Connections ·
 * App · Data · Account`, and the groups inside each section page). Rows are `Row`s: 44 tall, 60 with a second line.
 */
export const SGroup = ({ title, children, className = '' }: { title: string; children: ReactNode; className?: string }): React.JSX.Element => (
  <Section title={title} level="secondary" className={`s-sec ${className}`}>
    <Group className="s-group">{children}</Group>
  </Section>
);

/**
 * A row that goes somewhere (a push, a sheet, the Strava hand-off): the value on the right, then the chevron. The whole row is
 * the target; its press is the row surface (`--surface-2`, the one press of §11.1, set by the press delegate on `.lrow.tappable`).
 */
export const GoRow = ({ title, sub, value, onPress, label, tone, className = '' }: { title: ReactNode; sub?: ReactNode; value?: ReactNode; onPress: () => void; label?: string; tone?: 'bad'; className?: string }): React.JSX.Element => (
  <Row
    className={`s-go ${tone ? `tone-${tone}` : ''} ${className}`}
    title={title}
    sub={sub}
    onClick={onPress}
    label={label}
    right={
      <>
        {value != null ? <span className="s-value">{value}</span> : null}
        <Chev />
      </>
    }
  />
);

/** An on/off switch: the knob springs across on `settle` (a transform), the track lights blue. 51 × 44, the whole height the target. */
export const Switch = ({ on, onChange, label }: { on: boolean; onChange: (on: boolean) => void; label: string }): React.JSX.Element => {
  const reduce = useReducedMotion();
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} className={`s-switch ${on ? 'on' : ''}`} onClick={() => onChange(!on)}>
      <motion.span className="s-knob" initial={false} animate={{ x: on ? 20 : 0 }} transition={reduce ? { duration: 0 } : springs.settle} />
    </button>
  );
};
