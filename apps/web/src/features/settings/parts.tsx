import { ChevronRight, type LucideIcon } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import type * as React from 'react';
import { type ReactNode } from 'react';
import { springs } from '@/lib/motion';
import { Footnote, PageSection, Row } from '@/ui';
import { rowName } from './format';
import './switch.css';

/** The chevron of a row that pushes (or opens) something. */
export const Chev = (): React.JSX.Element => <ChevronRight size={18} className="s-chev" aria-hidden="true" />;

/**
 * A row's soft icon tile (inspiration §3 "Settings rows": pastel tiles, grey subtitles): a Columbia wash square with the
 * icon in the second ink. Colour stays out of it; a tile says what the row is, never how it is doing.
 */
export const Tile = ({ icon: Icon, tone }: { icon: LucideIcon; tone?: 'muted' }): React.JSX.Element => (
  <span className={`icon-tile s-tile ${tone ? `is-${tone}` : ''}`} aria-hidden="true">
    <Icon size={18} strokeWidth={2} />
  </span>
);

/**
 * A settings section (shape system §6, reference 658-672): the kit's small serif header (22/28), then its content in one
 * white container, then an optional grey footnote under it (`foot`). Every section page is built from these.
 */
const SSec = ({ title, meta, foot, className, children }: { title: string; meta?: ReactNode; foot?: ReactNode; className: string; children: ReactNode }): React.JSX.Element => (
  <PageSection size="sm" title={title} meta={meta} className={`s-sec ${className}`.trim()}>
    {children}
    {foot ? <Footnote>{foot}</Footnote> : null}
  </PageSection>
);

/** One inset group of rows under its title: 56 tall rows (64 with a second line), icon tiles, hairlines from the words. */
export const SGroup = ({ title, meta, foot, children, className = '' }: { title: string; meta?: ReactNode; foot?: ReactNode; children: ReactNode; className?: string }): React.JSX.Element => (
  <SSec title={title} meta={meta} foot={foot} className={className}>
    <div className="group s-group">{children}</div>
  </SSec>
);

/** One white card under its title, for a control that is not a list (a stepper, the run days, the race-day strip). */
export const SCard = ({ title, meta, foot, children, className = '' }: { title: string; meta?: ReactNode; foot?: ReactNode; children: ReactNode; className?: string }): React.JSX.Element => (
  <SSec title={title} meta={meta} foot={foot} className={className}>
    <div className="card s-card">{children}</div>
  </SSec>
);

/** A full-width white action pill with centred words (Sign out, Disconnect); `danger` for the one that loses something. */
export const ActionPill = ({ children, onPress, danger, disabled, className = '', label }: { children: ReactNode; onPress: () => void; danger?: boolean; disabled?: boolean; className?: string; label?: string }): React.JSX.Element => (
  <button type="button" className={`pill-row s-pill ${danger ? 'is-danger' : ''} ${className}`} onClick={onPress} disabled={disabled} aria-label={label}>
    {children}
  </button>
);

/**
 * A row that goes somewhere (a push, a sheet, a hand-off to another app): the value on the right, then the chevron. The whole row is
 * the target; its press is the row surface (`--surface-2`, the one press of §11.1, set by the press delegate on `.lrow.tappable`).
 */
export const GoRow = ({ title, sub, value, onPress, href, label, tone, icon, className = '' }: { title: ReactNode; sub?: ReactNode; value?: ReactNode; onPress?: () => void; /** A link the system opens itself (a `mailto:`): the row is then an anchor. */ href?: string; label?: string; tone?: 'bad'; icon?: LucideIcon; className?: string }): React.JSX.Element => (
  <Row
    className={`s-go ${tone ? `tone-${tone}` : ''} ${icon ? 'has-tile' : ''} ${className}`}
    left={icon ? <Tile icon={icon} /> : undefined}
    title={title}
    sub={sub}
    onClick={href ? undefined : onPress}
    href={href}
    label={rowName(title, label)}
    right={
      <>
        {value != null ? <span className="s-value">{value}</span> : null}
        <Chev />
      </>
    }
  />
);

/** An on/off switch: the knob springs across on `settle` (a transform), the track lights blue. 51 × 44, the whole height the target. */
export const Switch = ({ on, onChange, label, disabled }: { on: boolean; onChange: (on: boolean) => void; label: string; disabled?: boolean }): React.JSX.Element => {
  const reduce = useReducedMotion();
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} className={`s-switch ${on ? 'on' : ''}`} disabled={disabled} onClick={() => onChange(!on)}>
      <motion.span className="s-knob" initial={false} animate={{ x: on ? 20 : 0 }} transition={reduce ? { duration: 0 } : springs.settle} />
    </button>
  );
};
