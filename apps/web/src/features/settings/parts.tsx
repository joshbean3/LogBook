import { ChevronRight } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { springs } from '@/lib/motion';

/**
 * A settings row on black, in an edge-to-edge list: the title, an optional quiet sub, the value at the right, and a
 * chevron when it goes somewhere. The whole row is the target (a link, a button, or a label around a switch).
 */
export const SRow = ({
  title,
  sub,
  value,
  to,
  onPress,
  chevron,
  tone,
  label,
  right,
  className = '',
}: {
  title: ReactNode;
  sub?: ReactNode;
  value?: ReactNode;
  to?: string;
  onPress?: () => void;
  chevron?: boolean;
  tone?: 'bad' | 'accent';
  label?: string;
  right?: ReactNode;
  className?: string;
}) => {
  const inner = (
    <>
      <span className="s-row-main">
        <span className={`s-row-title ${tone ?? ''}`}>{title}</span>
        {sub ? <span className="s-row-sub">{sub}</span> : null}
      </span>
      {value != null ? <span className="s-row-value">{value}</span> : null}
      {right}
      {chevron ?? (to || onPress) ? <ChevronRight size={18} className="s-row-chev" aria-hidden="true" /> : null}
    </>
  );
  const cls = `s-row ${sub ? 'two' : ''} ${to || onPress ? 'tap' : ''} ${className}`;
  if (to)
    return (
      <Link to={to} className={cls} aria-label={label}>
        {inner}
      </Link>
    );
  if (onPress)
    return (
      <button type="button" className={cls} onClick={onPress} aria-label={label}>
        {inner}
      </button>
    );
  return <div className={cls}>{inner}</div>;
};

/** An on/off switch: the knob springs across, the track lights blue. The row around it is its label. */
export const Switch = ({ on, onChange, label }: { on: boolean; onChange: (on: boolean) => void; label: string }) => {
  const reduce = useReducedMotion();
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} className={`s-switch ${on ? 'on' : ''}`} onClick={() => onChange(!on)}>
      <motion.span className="s-knob" animate={{ x: on ? 20 : 0 }} transition={reduce ? { duration: 0 } : springs.settle} />
    </button>
  );
};

/** The account's initial for the avatar: the name's first letter (contract 6), else the email's. */
export const initialOf = (u: { name?: string | null; email?: string } | undefined) => ((u?.name ?? '').trim() || (u?.email ?? '')).charAt(0).toUpperCase() || undefined;
