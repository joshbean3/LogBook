import { Check, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { haptic } from '@/lib/haptics';
import { spring } from '@/lib/motion';

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'default' | 'primary' | 'soft' | 'ghost' | 'danger'; size?: 'md' | 'sm'; block?: boolean };
export const Button = ({ variant = 'default', size = 'md', block, className = '', type = 'button', ...rest }: BtnProps) => (
  <button type={type} className={`btn ${variant !== 'default' ? variant : ''} ${size === 'sm' ? 'sm' : ''} ${block ? 'block' : ''} ${className}`} {...rest} />
);

export const IconButton = ({ label, className = '', size, raised, children, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string; size?: 'sm'; raised?: boolean }) => (
  <button type="button" className={`icon-btn ${size === 'sm' ? 'sm' : ''} ${raised ? 'raised' : ''} ${className}`} aria-label={label} title={label} {...rest}>
    {children}
  </button>
);

export const ChipButton = ({ quiet, on, className = '', ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { quiet?: boolean; on?: boolean }) => (
  <button type="button" className={`chip-btn ${quiet ? 'quiet' : ''} ${on ? 'on' : ''} ${className}`} aria-pressed={on === undefined ? undefined : on} {...rest} />
);

export const Chip = ({ kind, children }: { kind?: string; children: ReactNode }) => (children ? <span className={`chip ${kind ?? ''}`}>{children}</span> : null);

export const Field = ({ label, hint, children, htmlFor }: { label: string; hint?: ReactNode; children: ReactNode; htmlFor?: string }) => (
  <label className="field" htmlFor={htmlFor}>
    <span className="field-label">{label}</span>
    {children}
    {hint ? <span className="field-hint">{hint}</span> : null}
  </label>
);

export const Card = ({ className = '', flat, tight, children, ...rest }: React.HTMLAttributes<HTMLElement> & { flat?: boolean; tight?: boolean }) => (
  <section className={`card ${flat ? 'flat' : ''} ${tight ? 'tight' : ''} ${className}`} {...rest}>
    {children}
  </section>
);
export const CardHead = ({ title, meta, children }: { title: ReactNode; meta?: ReactNode; children?: ReactNode }) => (
  <div className="card-head">
    <h2 className="card-title">{title}</h2>
    {meta ? <span className="card-meta">{meta}</span> : null}
    {children}
  </div>
);

export const Note = ({ kind = 'info', children }: { kind?: 'info' | 'warn' | 'bad' | 'ok'; children: ReactNode }) => <p className={`note-line ${kind}`}>{children}</p>;

export const Spinner = () => <span className="spinner" aria-hidden="true" />;
export const Loading = ({ text = 'Loading…' }: { text?: string }) => (
  <div className="loading" role="status">
    <Spinner />
    <span>{text}</span>
  </div>
);

/** The checkbox that says "I did it". Springs when it lands, with a soft ring. */
export const Mark = ({ status, onClick, disabled, label, title, small }: { status: 'done' | 'floor' | 'missed' | 'open' | 'upcoming' | 'rest' | 'skipped'; onClick?: () => void; disabled?: boolean; label: string; title?: string; small?: boolean }) => {
  const reduce = useReducedMotion();
  const [ring, setRing] = useState(0);
  const prev = useRef(status);
  useEffect(() => {
    if ((status === 'done' || status === 'floor') && prev.current !== status) {
      setRing((n) => n + 1);
      haptic(status === 'done' ? 'success' : 'tick');
    }
    prev.current = status;
  }, [status]);
  const on = status === 'done' || status === 'floor';
  return (
    <motion.button
      type="button"
      className={`mark m-${status} ${small ? 'sm' : ''}`}
      role="checkbox"
      aria-checked={on}
      aria-label={label}
      title={title}
      disabled={disabled}
      onClick={onClick}
      whileTap={disabled || reduce ? undefined : { scale: 0.88 }}
      animate={on && !reduce ? { scale: [1, 1.12, 1] } : { scale: 1 }}
      transition={spring}
    >
      <AnimatePresence>
        {ring > 0 && !reduce ? <motion.span key={ring} className="mark-ring" initial={{ opacity: 0.6, scale: 1 }} animate={{ opacity: 0, scale: 1.9 }} transition={{ duration: 0.55, ease: 'easeOut' }} onAnimationComplete={() => setRing(0)} /> : null}
      </AnimatePresence>
      <motion.span initial={false} animate={{ scale: on ? 1 : 0.4, opacity: on ? 1 : 0 }} transition={spring} style={{ display: 'grid' }}>
        <Check size={small ? 14 : 17} strokeWidth={2.6} />
      </motion.span>
    </motion.button>
  );
};

/** A progress ring that draws itself. */
export const Ring = ({ value, size = 44, stroke = 4, color = 'var(--ok)', children, label }: { value: number; size?: number; stroke?: number; color?: string; children?: ReactNode; label?: string }) => {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value || 0));
  return (
    <span style={{ position: 'relative', width: size, height: size, display: 'inline-grid', placeItems: 'center', flex: 'none' }} role={label ? 'img' : undefined} aria-label={label}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ position: 'absolute', inset: 0 }} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={stroke} />
        <motion.circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - v) }} transition={{ type: 'spring', stiffness: 80, damping: 20 }} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </svg>
      <span style={{ position: 'relative', fontSize: size * 0.3, fontWeight: 600, lineHeight: 1 }}>{children}</span>
    </span>
  );
};

/** Pill-style segmented control; the thumb glides between options. */
export function Segmented<T extends string>({ options, value, onChange, label, className = '', disabled }: { options: Array<[T, ReactNode]>; value: T; onChange: (v: T) => void; label: string; className?: string; disabled?: boolean }) {
  const id = useId();
  return (
    <div className={`seg ${className}`} role="radiogroup" aria-label={label}>
      {options.map(([k, text]) => (
        <button key={k} type="button" role="radio" aria-checked={value === k} className="seg-btn" disabled={disabled} onClick={() => value !== k && onChange(k)}>
          {value === k ? <motion.span layoutId={`thumb-${id}`} className="seg-thumb" transition={spring} /> : null}
          <span style={{ position: 'relative', zIndex: 1 }}>{text}</span>
        </button>
      ))}
    </div>
  );
}

export const Stepper = ({ value, onChange, step, min, max, format, parse, label, disabled, inputProps }: { value: number; onChange: (v: number) => void; step: number; min: number; max: number; format: (v: number) => string; parse: (s: string) => number | null; label: string; disabled?: boolean; inputProps?: React.InputHTMLAttributes<HTMLInputElement> }) => {
  const [text, setText] = useState(format(value));
  useEffect(() => setText(format(value)), [value, format]);
  const commit = () => {
    const v = parse(text);
    if (v != null && v >= min && v <= max && v !== value) onChange(v);
    else setText(format(value));
  };
  const bump = (d: number) => {
    const v = Math.min(max, Math.max(min, Math.round((value + d) / step) * step));
    if (v !== value) {
      haptic();
      onChange(v);
    }
  };
  return (
    <div className="stepper">
      <button type="button" className="step" aria-label={`${label}: less`} disabled={disabled || value <= min} onClick={() => bump(-step)}>
        −
      </button>
      <input className="in" aria-label={label} value={text} onChange={(e) => setText(e.target.value)} onBlur={commit} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} disabled={disabled} {...inputProps} />
      <button type="button" className="step" aria-label={`${label}: more`} disabled={disabled || value >= max} onClick={() => bump(step)}>
        +
      </button>
    </div>
  );
};

export const Kpi = ({ label, value, unit, tone, wide, children }: { label: string; value: ReactNode; unit?: ReactNode; tone?: 'done' | 'missed' | 'open' | ''; wide?: boolean; children?: ReactNode }) => (
  <div className={`kpi ${wide ? 'wide' : ''}`}>
    <span className="kpi-label">{label}</span>
    <span className={`kpi-val ${tone ? `c-${tone}` : ''}`}>
      {value}
      {unit ? <small>{unit}</small> : null}
    </span>
    {children}
  </div>
);

export const DateNav = ({ onPrev, onNext, prevLabel, nextLabel, children }: { onPrev: () => void; onNext: () => void; prevLabel: string; nextLabel: string; children?: ReactNode }) => (
  <div className="row" style={{ gap: 2 }}>
    <IconButton label={prevLabel} onClick={onPrev}>
      <ChevronLeft size={20} />
    </IconButton>
    <IconButton label={nextLabel} onClick={onNext}>
      <ChevronRight size={20} />
    </IconButton>
    {children}
  </div>
);

export const PageHeader = ({ eyebrow, title, sub, actions, children }: { eyebrow?: ReactNode; title: ReactNode; sub?: ReactNode; actions?: ReactNode; children?: ReactNode }) => (
  <header className="ph">
    <div className="ph-top">
      <div style={{ display: 'grid', gap: 2, minWidth: 0, flex: 1 }}>
        {eyebrow ? <span className="ph-eyebrow">{eyebrow}</span> : null}
        <h1 className="ph-title">{title}</h1>
        {sub ? <span className="ph-sub">{sub}</span> : null}
      </div>
      {actions ? <div className="ph-actions">{actions}</div> : null}
    </div>
    {children}
  </header>
);

export const Empty = ({ children }: { children: ReactNode }) => <p className="empty">{children}</p>;

export const CloseButton = ({ onClick }: { onClick: () => void }) => (
  <IconButton label="Close" onClick={onClick}>
    <X size={18} />
  </IconButton>
);
