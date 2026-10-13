import { Check, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { haptic } from '@/lib/haptics';
import { spring } from '@/lib/motion';

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'default' | 'primary' | 'soft' | 'ghost' | 'quiet' | 'danger'; size?: 'md' | 'sm'; block?: boolean };
export const Button = ({ variant = 'default', size = 'md', block, className = '', type = 'button', ...rest }: BtnProps) => (
  <button type={type} className={`btn ${variant !== 'default' ? variant : ''} ${size === 'sm' ? 'sm' : ''} ${block ? 'block' : ''} ${className}`} {...rest} />
);

export const IconButton = ({ label, className = '', size, children, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string; size?: 'sm' }) => (
  <button type="button" className={`icon-btn ${size === 'sm' ? 'sm' : ''} ${className}`} aria-label={label} title={label} {...rest}>
    {children}
  </button>
);

export const ChipButton = ({ quiet, on, className = '', ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { quiet?: boolean; on?: boolean }) => (
  <button type="button" className={`chip-btn ${quiet ? 'quiet' : ''} ${on ? 'on' : ''} ${className}`} aria-pressed={on === undefined ? undefined : on} {...rest} />
);

export const Chip = ({ kind, children, className = '' }: { kind?: string; children: ReactNode; className?: string }) => (children ? <span className={`chip ${kind ?? ''} ${className}`}>{children}</span> : null);

export const Field = ({ label, hint, children, htmlFor }: { label: string; hint?: ReactNode; children: ReactNode; htmlFor?: string }) => (
  <label className="field" htmlFor={htmlFor}>
    <span className="field-label">{label}</span>
    {children}
    {hint ? <span className="field-hint">{hint}</span> : null}
  </label>
);

/** Section eyebrow with an optional right-side action. 32px above, 8px below. */
export const SectionHead = ({ title, meta, action, first }: { title: ReactNode; meta?: ReactNode; action?: ReactNode; first?: boolean }) => (
  <div className={`sec-head ${first ? '' : 'section'}`}>
    <span className="t-label">{title}</span>
    {meta ? <span className="t-cap muted">{meta}</span> : null}
    {action}
  </div>
);

/** A grouped list: one surface, rows divided by hairlines. */
export const Group = ({ children, className = '' }: { children: ReactNode; className?: string }) => <div className={`group ${className}`}>{children}</div>;

export const Card = ({ className = '', flat, children, ...rest }: React.HTMLAttributes<HTMLElement> & { flat?: boolean }) => (
  <section className={`card ${flat ? 'flat' : ''} ${className}`} {...rest}>
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

/** Keeps the section's shape and offers the one action that changes the state. */
export const EmptyState = ({ children, action }: { children: ReactNode; action?: ReactNode }) => (
  <div className="empty-state">
    <p>{children}</p>
    {action}
  </div>
);
export const Empty = ({ children }: { children: ReactNode }) => <EmptyState>{children}</EmptyState>;

/** The check that says "did it": 44px hit target, circle for habits/sessions, square for to-dos. */
/** The mark: the fill runs 160ms, then the check draws itself in 160ms. One haptic. Nothing else moves. */
export const Mark = ({ status, onClick, disabled, label, title, square }: { status: 'done' | 'floor' | 'missed' | 'open' | 'upcoming' | 'rest' | 'skipped'; onClick?: () => void; disabled?: boolean; label: string; title?: string; square?: boolean }) => {
  const reduce = useReducedMotion();
  const prev = useRef(status);
  useEffect(() => {
    if ((status === 'done' || status === 'floor') && prev.current !== status) haptic(status === 'done' ? 'success' : 'tick');
    prev.current = status;
  }, [status]);
  const on = status === 'done' || status === 'floor';
  const size = square ? 14 : 16;
  return (
    <motion.button type="button" className="mark-hit" role="checkbox" aria-checked={on} aria-label={label} title={title} disabled={disabled} onClick={onClick} whileTap={disabled || reduce ? undefined : { scale: 0.9 }} transition={spring}>
      <span className={`mark m-${status} ${square ? 'square' : ''}`}>
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ display: 'block' }}>
          <motion.path d="M20 6 9 17l-5-5" initial={false} animate={{ pathLength: on ? 1 : 0, opacity: on ? 1 : 0 }} transition={reduce ? { duration: 0 } : on ? { pathLength: { duration: 0.16, delay: 0.16, ease: 'easeOut' }, opacity: { duration: 0.01, delay: 0.16 } } : { duration: 0.1 }} />
        </svg>
      </span>
    </motion.button>
  );
};

/** A progress ring that fills from zero when it appears. */
export const Ring = ({ value, size = 44, stroke = 4, color = 'var(--ok)', children, label }: { value: number; size?: number; stroke?: number; color?: string; children?: ReactNode; label?: string }) => {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value || 0));
  return (
    <span style={{ position: 'relative', width: size, height: size, display: 'inline-grid', placeItems: 'center', flex: 'none' }} role={label ? 'img' : undefined} aria-label={label}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ position: 'absolute', inset: 0 }} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeOpacity={0.14} strokeWidth={stroke} />
        <motion.circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - v) }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </svg>
      <span style={{ position: 'relative', display: 'grid', justifyItems: 'center', lineHeight: 1 }}>{children}</span>
    </span>
  );
};

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

/** A unit the way VoiceOver should say it: "mi" is miles, "/mi" is per mile, "bpm" is beats per minute. */
export const unitWords = (u: string) =>
  u
    .replace(/\/mi\b/g, ' per mile')
    .replace(/\bmi\b/g, 'miles')
    .replace(/\bmin\b/g, 'minutes')
    .replace(/\bft\b/g, 'feet')
    .replace(/\bbpm\b/g, 'beats per minute')
    .replace(/\bwk\b/g, 'weeks')
    .replace(/\bspm\b/g, 'steps per minute')
    .replace(/%/g, ' percent')
    .replace(/\s+/g, ' ')
    .trim();
/** "Distance 6.0 miles": one line for a stamped stat, read as a whole. */
export const readStat = (label: string, value: ReactNode, unit?: ReactNode, note?: ReactNode) => {
  const v = typeof value === 'string' || typeof value === 'number' ? String(value) : null;
  if (v == null) return null;
  const u = typeof unit === 'string' || typeof unit === 'number' ? unitWords(String(unit)) : '';
  const n = typeof note === 'string' || typeof note === 'number' ? unitWords(String(note)) : '';
  return `${label} ${v}${u ? ` ${u}` : ''}${n ? `, ${n}` : ''}`;
};

/** One unframed stat: label above, number with unit, optional delta or sparkline below. VoiceOver reads it as one line ("Week 6.0 of 26 miles"); pass `read` when the value is a node. */
export const Stat = ({ label, value, unit, tone, delta, small, read, children }: { label: string; value: ReactNode; unit?: ReactNode; tone?: 'ok' | 'bad' | 'accent' | ''; delta?: { text: string; dir?: 'up' | 'down' | 'flat' }; small?: boolean; read?: string; children?: ReactNode }) => {
  const line = read ?? readStat(label, value, unit, delta?.text);
  return (
    <div className="stat" role={line ? 'img' : undefined} aria-label={line ?? undefined}>
      <span className="t-label muted" aria-hidden={line ? true : undefined}>
        {label}
      </span>
      <span className={`stat-val ${small ? 'sm' : ''} ${tone ?? ''}`} aria-hidden={line ? true : undefined}>
        {value}
        {unit ? <small>{unit}</small> : null}
      </span>
      {delta ? (
        <span className={`stat-delta ${delta.dir ?? ''}`} aria-hidden={line ? true : undefined}>
          {delta.text}
        </span>
      ) : null}
      {children}
    </div>
  );
};
/** A stamped stat on a hero or a sheet head: caps label over the number, the unit small. Reads as "Distance 6.0 miles". */
export const AuraStat = ({ label, value, unit, note, className = '' }: { label: string; value: ReactNode; unit?: ReactNode; note?: ReactNode; className?: string }) => {
  const line = readStat(label, value, unit, note);
  return (
    <span className={`aura-stat ${className}`} role={line ? 'img' : undefined} aria-label={line ?? undefined}>
      <span className="caps" aria-hidden={line ? true : undefined}>
        {label}
      </span>
      <span className="stamp aura-num" aria-hidden={line ? true : undefined}>
        {value}
        {unit ? <small>{unit}</small> : null}
      </span>
      {note ? (
        <span className="aura-note" aria-hidden={line ? true : undefined}>
          {note}
        </span>
      ) : null}
    </span>
  );
};
/** Three stats in a row, divided by hairlines. */
export const StatStrip = ({ children, className = '' }: { children: ReactNode; className?: string }) => <div className={`strip ${className}`}>{children}</div>;

export const DateNav = ({ onPrev, onNext, prevLabel, nextLabel, children }: { onPrev: () => void; onNext: () => void; prevLabel: string; nextLabel: string; children?: ReactNode }) => (
  <div className="row" style={{ gap: 0 }}>
    <IconButton label={prevLabel} onClick={onPrev}>
      <ChevronLeft size={22} />
    </IconButton>
    <IconButton label={nextLabel} onClick={onNext}>
      <ChevronRight size={22} />
    </IconButton>
    {children}
  </div>
);

export const PageHeader = ({ title, sub, actions, children }: { title: ReactNode; sub?: ReactNode; actions?: ReactNode; children?: ReactNode }) => (
  <header className="ph">
    <div className="ph-top">
      <div className="ph-text">
        <h1 className="ph-title">{title}</h1>
        {sub ? <span className="ph-sub">{sub}</span> : null}
      </div>
      {actions ? <div className="ph-actions">{actions}</div> : null}
    </div>
    {children ? <div className="ph-tools">{children}</div> : null}
  </header>
);

export const CloseButton = ({ onClick }: { onClick: () => void }) => (
  <IconButton label="Close" onClick={onClick}>
    <X size={20} />
  </IconButton>
);

/** True when a tap landed on a control of its own inside a row (a star, a delete, an input), so the row's action stays out of the way. */
export const onOwnControl = (e: { target: EventTarget | null; currentTarget: EventTarget | null }) => {
  const t = e.target as HTMLElement | null;
  if (!t || t === e.currentTarget) return false;
  const own = t.closest('button, a[href], input, select, textarea, [role="button"], [role="checkbox"], [role="radio"], [role="switch"]');
  return !!own && own !== e.currentTarget;
};

/**
 * A 44px list row. With `onClick` the whole row is the button (role, keyboard, press state); with `href` it is a link;
 * with `as="label"` a tap anywhere focuses the control it holds. Controls inside `right` keep their own tap: the row's action
 * does not fire for a tap that landed on one of them.
 */
export const Row = ({ left, title, sub, right, onClick, href, two, className = '', as = 'div', label, ...rest }: { left?: ReactNode; title: ReactNode; sub?: ReactNode; right?: ReactNode; onClick?: () => void; href?: string; two?: boolean; className?: string; as?: 'div' | 'li' | 'label'; label?: string } & Omit<React.HTMLAttributes<HTMLElement>, 'title' | 'onClick' | 'className'>) => {
  const Tag = (href ? 'a' : as) as 'div';
  const Inner = as === 'label' ? 'span' : 'div';
  const tappable = !!onClick || !!href;
  const press = onClick
    ? (e: React.MouseEvent) => {
        if (onOwnControl(e)) return;
        onClick();
      }
    : undefined;
  const key = onClick
    ? (e: React.KeyboardEvent) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }
    : undefined;
  const linkProps = href ? { href } : {};
  return (
    <Tag className={`lrow ${two || sub ? 'two' : ''} ${tappable ? 'tappable' : ''} ${className}`} onClick={press} role={onClick && !href ? 'button' : undefined} tabIndex={onClick && !href ? 0 : undefined} onKeyDown={key} aria-label={label} {...linkProps} {...rest}>
      {left}
      <Inner className="lrow-main">
        <Inner className="lrow-title">{title}</Inner>
        {sub ? <Inner className="lrow-sub">{sub}</Inner> : null}
      </Inner>
      {right ? <Inner className="lrow-right">{right}</Inner> : null}
    </Tag>
  );
};

/** The Logbook mark: the ring is the day, the check is the record, the gap is what is still open. */
export const LogoMark = ({ size = 24, color = 'currentColor' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M 19.8 7.5 A 9 9 0 1 1 12 3" />
    <polyline points="7.5,12 10,14.5 15.5,9" />
  </svg>
);

/** The one 7-day picker. Selected = filled ink pill, today = accent outline. `extra(d)` renders inside the pill under the number (tone dots). */
export const DayStrip = ({ days, selected, today, onPick, labelOf, statusOf, extra, className = '', ariaLabel = 'Pick a day' }: { days: string[]; selected: string; today: string; onPick: (d: string) => void; labelOf: (d: string) => string; statusOf?: (d: string) => string | undefined; extra?: (d: string) => ReactNode; className?: string; ariaLabel?: string }) => (
  <div className={`dstrip ${className}`} role="group" aria-label={ariaLabel}>
    {days.map((d) => {
      const st = statusOf?.(d);
      return (
        <button key={d} type="button" className={`dcell ${st ? `ds-${st}` : ''} ${d === selected ? 'is-sel' : ''} ${d === today ? 'is-today' : ''}`} aria-pressed={d === selected} aria-current={d === today ? 'date' : undefined} aria-label={labelOf(d)} onClick={() => onPick(d)}>
          <span className="dcell-dow">{DOW_LETTER[new Date(`${d}T12:00:00`).getDay()]}</span>
          <span className="dcell-pill">
            <span className="dcell-num">{Number(d.slice(8))}</span>
            {extra?.(d)}
          </span>
        </button>
      );
    })}
  </div>
);
const DOW_LETTER = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
