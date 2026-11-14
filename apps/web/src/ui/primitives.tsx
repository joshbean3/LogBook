import { Check, ChevronDown, ChevronLeft, ChevronRight, Plus, X } from 'lucide-react';
import { animate, motion, useMotionValue, useReducedMotion } from 'motion/react';
import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { fireHaptic, haptics, type HapticEvent } from '@/lib/haptics';
import { springs } from '@/lib/motion';
import { ghostOf, type GhostKind } from './Ghost';
import { usePress } from './usePress';

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'default' | 'primary' | 'soft' | 'ghost' | 'quiet' | 'danger'; size?: 'md' | 'sm'; block?: boolean };
export const Button = ({ variant = 'default', size = 'md', block, className = '', type = 'button', ...rest }: BtnProps) => (
  <button type={type} className={`btn ${variant !== 'default' ? variant : ''} ${size === 'sm' ? 'sm' : ''} ${block ? 'block' : ''} ${className}`} {...rest} />
);

export const IconButton = ({ label, className = '', size, children, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string; size?: 'sm' }) => (
  <button type="button" className={`icon-btn ${size === 'sm' ? 'sm' : ''} ${className}`} aria-label={label} title={label} {...rest}>
    {children}
  </button>
);

/** A chip that toggles: aria-pressed from `on`, unless it plays another role (a radio says aria-checked itself, a11y-15). */
export const ChipButton = ({ quiet, on, className = '', ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { quiet?: boolean; on?: boolean }) => (
  <button type="button" className={`chip-btn ${quiet ? 'quiet' : ''} ${on ? 'on' : ''} ${className}`} aria-pressed={on === undefined || rest.role ? undefined : on} {...rest} />
);

export const Chip = ({ kind, children, className = '' }: { kind?: string; children: ReactNode; className?: string }) => (children ? <span className={`chip ${kind ?? ''} ${className}`}>{children}</span> : null);

export const Field = ({ label, hint, children, htmlFor }: { label: string; hint?: ReactNode; children: ReactNode; htmlFor?: string }) => (
  <label className="field" htmlFor={htmlFor}>
    <span className="field-label">{label}</span>
    {children}
    {hint ? <span className="field-hint">{hint}</span> : null}
  </label>
);

/**
 * A section that names itself in sentence case (Inter 17/600, `.section-title`), with an optional quiet meta (a count) and
 * one action at the right. `level` sets the space above it: 48px for a primary section, 24px for a secondary one.
 * Use it instead of a caps eyebrow unless the section is a metric label. Superseded by the layout kit's PageSection
 * (ui/layout.tsx), which every tab uses; kept for the UI gallery.
 */
export const Section = ({ title, meta, action, level = 'primary', children, className = '' }: { title: ReactNode; meta?: ReactNode; action?: ReactNode; level?: 'primary' | 'secondary' | 'none'; children?: ReactNode; className?: string }) => {
  const id = useId();
  return (
    <section className={`${level === 'none' ? '' : `sec-${level}`} ${className}`} aria-labelledby={id}>
      <div className="section-head">
        <h2 className="section-title" id={id}>
          {title}
        </h2>
        {meta != null ? <span className="section-meta">{meta}</span> : null}
        {action}
      </div>
      {children}
    </section>
  );
};

/** v1 section eyebrow (caps) with an optional right-side action. 32px above, 8px below. Prefer `Section` for new work. */
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


export interface EmptyStateProps {
  /** The one sentence: what this will hold, said forward ("Your runs land here."). */
  children?: ReactNode;
  /** The same sentence as a prop, if you prefer. */
  text?: ReactNode;
  /** v1: any node at the right (a button). Prefer `verb`. */
  action?: ReactNode;
  /** The one verb that fills the state: a button under the sentence. */
  /** `primary` is kept for the call sites; the guide (6.11) draws an empty state's button as a secondary, so it is ignored. */
  verb?: { label: string; onPress: () => void; haptic?: HapticEvent; primary?: boolean };
  /**
   * The shape of the filled state, drawn at 30% and untouchable. Shapes only (critic B1): a `GhostBars`, `GhostLines` or
   * `GhostRows`, or the shorthand `'bars' | 'rows' | 'lines'`. Never sample content: no numbers, words, dates or domains
   * (dev builds warn when a ghost has any text in it).
   */
  ghost?: ReactNode | GhostKind;
  /** One-tap starters ("Sleep 7 h", "Stretch"): each is a chip that calls `onStarter` and then shows as added. */
  starters?: string[];
  onStarter?: (starter: string) => void | Promise<unknown>;
  /** The chips' group name for VoiceOver. Default "Starters". */
  startersLabel?: string;
  className?: string;
}

/**
 * Empty state v2: one sentence, one verb, an optional ghost preview of the filled state (30%, aria-hidden, inert) and
 * optional starter chips that add with one tap. With only `children` and `action` it renders the v1 compact row, so old
 * call sites keep their look. Never a grey sentence alone where a verb or a starter could fill the state.
 */
export const EmptyState = ({ children, text, action, verb, ghost: ghostIn, starters, onStarter, startersLabel = 'Starters', className = '' }: EmptyStateProps) => {
  const [added, setAdded] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const sentence = text ?? children;
  const ghost = typeof ghostIn === 'string' && (ghostIn === 'bars' || ghostIn === 'rows' || ghostIn === 'lines') ? ghostOf(ghostIn) : (ghostIn as ReactNode);
  const ghostRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // a ghost is shapes, never content: made-up words, numbers or dates read as someone else's data (critic B1)
    const words = ghostRef.current?.textContent?.trim();
    if (import.meta.env.DEV && words) console.warn(`EmptyState: the ghost shows text ("${words.slice(0, 40)}"). Use GhostBars, GhostLines or GhostRows (docs/foundation.md).`);
  });
  if (!verb && !ghost && !starters?.length)
    return (
      <div className={`empty-state ${className}`}>
        <p>{sentence}</p>
        {action}
      </div>
    );
  const add = async (st: string) => {
    if (!onStarter || added.includes(st) || busy) return;
    setBusy(st);
    try {
      // the starter's row answering is the confirmation: no haptic (§11.4 has none for adding one)
      await onStarter(st);
      setAdded((a) => [...a, st]);
    } finally {
      setBusy(null);
    }
  };
  return (
    <div className={`empty-v2 ${className}`}>
      {ghost ? (
        <div ref={ghostRef} className="empty-ghost" aria-hidden="true" inert>
          {ghost}
        </div>
      ) : null}
      <div className="empty-copy">
        <p className="empty-line">{sentence}</p>
        {starters?.length ? (
          <div className="empty-starters" role="group" aria-label={startersLabel}>
            {starters.map((st) => {
              const on = added.includes(st);
              return (
                <ChipButton key={st} on={on} disabled={on || busy === st} onClick={() => void add(st)} aria-label={on ? `${st}, added` : `Add ${st}`}>
                  {on ? <Check size={14} strokeWidth={2.6} aria-hidden="true" /> : <Plus size={14} strokeWidth={2.6} aria-hidden="true" />}
                  {st}
                </ChipButton>
              );
            })}
          </div>
        ) : null}
        {verb ? (
          // an empty state's one button is a secondary (guide 6.11): the screen keeps its one Sky primary elsewhere, and a
          // caller's `primary` no longer turns it Sky
          <Button
            variant="soft"
            onClick={() => {
              fireHaptic(verb.haptic);
              verb.onPress();
            }}
          >
            {verb.label}
          </Button>
        ) : (
          action
        )}
      </div>
    </div>
  );
};
export const Empty = ({ children }: { children: ReactNode }) => <EmptyState>{children}</EmptyState>;

/** The check that says "did it": 44px hit target, circle for habits/sessions, square for to-dos. */
/** The mark: the fill runs 160ms, then the check draws itself in 160ms. One haptic. Nothing else moves. */
/** `haptic`: the event fired when the mark turns on; none by default (a mark's `toggle` is its caller's, on the visual peak through `hapticAtPeak`, §11.4). */
export const Mark = ({ status, onClick, disabled, label, title, square, haptic }: { status: 'done' | 'floor' | 'missed' | 'open' | 'upcoming' | 'rest' | 'skipped'; onClick?: () => void; disabled?: boolean; label: string; title?: string; square?: boolean; haptic?: HapticEvent | false }) => {
  const reduce = useReducedMotion();
  const prev = useRef(status);
  useEffect(() => {
    if ((status === 'done' || status === 'floor') && prev.current !== status) fireHaptic(haptic);
    prev.current = status;
  }, [status]); // eslint-disable-line react-hooks/exhaustive-deps
  const on = status === 'done' || status === 'floor';
  const size = square ? 14 : 16;
  // the one press (§11.1): data-pressed on pointerdown, the CSS 0.97 (it was a 0.9 motion tap)
  const press = usePress({ disabled });
  return (
    <button type="button" className="mark-hit" data-press="scale" role="checkbox" aria-checked={on} aria-label={label} title={title} disabled={disabled} onClick={onClick} {...press.handlers}>
      <span className={`mark m-${status} ${square ? 'square' : ''}`}>
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ display: 'block' }}>
          <motion.path d="M20 6 9 17l-5-5" initial={false} animate={{ pathLength: on ? 1 : 0, opacity: on ? 1 : 0 }} transition={reduce ? { duration: 0 } : on ? { pathLength: { duration: 0.16, delay: 0.16, ease: 'easeOut' }, opacity: { duration: 0.01, delay: 0.16 } } : { duration: 0.1 }} />
        </svg>
      </span>
    </button>
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

/** A segmented control's tone: the Sky thumb (guide 6.3), or the quiet Paper thumb with a 1 px edge (the iOS system look). */
export type SegTone = 'sky' | 'quiet';
/**
 * The tone of the four wayfinding and setting controls (Today's time of day, Plan's Week / Month, Progress's Running /
 * Strength, Journal's Week / Month). Sky, as the guide says, until the owner answers the build plan's question Q1; then
 * this one line flips them all. The range control stays Sky either way, and where two controls share a card or a screen
 * the one that is not the range control passes `tone="quiet"` now (guide 6.3 amendment).
 */
export const SEG_TONE_WAYFINDING: SegTone = 'sky';

/**
 * Two to five segments with one thumb that slides to the chosen one on `springs.settle` (a transform; no shared-layout
 * flight, no haptic: §11.4, contracts §C.6). Labels Inter 15; 44 tall in a card or on the page. In the bar's trailing slot
 * pass `className="in-bar"` (36 tall, each half a 44 px hit). `tone="quiet"` draws the Paper thumb (layout standard 6.7).
 */
export function Segmented<T extends string>({ options, value, onChange, label, className = '', disabled, tone = 'sky' }: { options: Array<[T, ReactNode]>; value: T; onChange: (v: T) => void; label: string; className?: string; disabled?: boolean; tone?: SegTone }) {
  const root = useRef<HTMLDivElement>(null);
  const thumb = useRef<HTMLSpanElement>(null);
  const x = useMotionValue(0);
  const placed = useRef(false);
  const reduce = useReducedMotion();
  useLayoutEffect(() => {
    const el = root.current;
    const th = thumb.current;
    if (!el || !th) return;
    let anim: { stop: () => void } | undefined;
    const place = (animateIt: boolean) => {
      const on = el.querySelector<HTMLElement>('.seg-btn[aria-checked="true"]');
      if (!on) return;
      th.style.width = `${on.offsetWidth}px`;
      anim?.stop();
      if (animateIt && placed.current && !reduce) anim = animate(x, on.offsetLeft, springs.settle);
      else x.jump(on.offsetLeft);
      placed.current = true;
    };
    place(true);
    // a resize re-places the thumb at once (the observer's first call, on observe, is not a resize)
    let w = el.offsetWidth;
    const ro = new ResizeObserver(() => {
      if (el.offsetWidth === w) return;
      w = el.offsetWidth;
      place(false);
    });
    ro.observe(el);
    return () => {
      anim?.stop();
      ro.disconnect();
    };
  }, [value, reduce, x]);
  return (
    <div ref={root} className={`seg ${tone === 'quiet' ? 'is-quiet' : ''} ${className}`.replace(/\s+/g, ' ').trim()} role="radiogroup" aria-label={label}>
      <motion.span ref={thumb} className="seg-thumb" style={{ x }} aria-hidden="true" />
      {options.map(([k, text]) => (
        <button
          key={k}
          type="button"
          role="radio"
          aria-checked={value === k}
          className="seg-btn"
          disabled={disabled}
          onClick={() => {
            // no haptic on a segmented change (§11.4, contracts §C.6)
            if (value !== k) onChange(k);
          }}
        >
          <span className="seg-label">{text}</span>
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
      haptics.select();
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

/**
 * The status pill (Today, guide 6.13 and 6.14, layout standard 6.7): glass, 32 tall with a 44 hit, Inter 15 500 Night Ink,
 * one line that never wraps. `dot` is the 6 px state dot (Deep Sky while training, Pencil while paused), `chevron` the 16
 * px glyph after the words ('down' opens a sheet here, 'right' goes somewhere). `voiceLabel` is what VoiceOver says: the
 * whole state, including what the words leave out (the plan's name, an end date the row had no room for). A pill that
 * does something in place (the Orbs page's Tilt, Stir and Float) leads with a 15 px `glyph`; one that stays on says so
 * with `pressed` (`aria-pressed`): on, it fills Haze, takes a Deep Sky edge and its glyph is Deep Sky.
 */
export const StatusPill = ({ label, dot, glyph, chevron, onPress, pressed, voiceLabel, className = '' }: { label: ReactNode; dot?: 'sky' | 'pencil'; glyph?: ReactNode; chevron?: 'down' | 'right'; onPress?: () => void; pressed?: boolean; voiceLabel?: string; className?: string }) => {
  const press = usePress({ disabled: !onPress });
  const inner = (
    <>
      {dot ? <span className={`status-pill-dot ${dot === 'pencil' ? 'is-pencil' : ''}`.trim()} aria-hidden="true" /> : null}
      {glyph ? (
        <span className="status-pill-glyph" aria-hidden="true">
          {glyph}
        </span>
      ) : null}
      <span className="status-pill-label">{label}</span>
      {chevron === 'down' ? <ChevronDown size={16} aria-hidden="true" /> : chevron === 'right' ? <ChevronRight size={16} aria-hidden="true" /> : null}
    </>
  );
  if (!onPress)
    return (
      <span className={`status-pill ${className}`.trim()} role={voiceLabel ? 'img' : undefined} aria-label={voiceLabel}>
        {inner}
      </span>
    );
  return (
    <button type="button" className={`status-pill ${className}`.trim()} onClick={onPress} aria-label={voiceLabel} aria-pressed={pressed} {...press.handlers}>
      {inner}
    </button>
  );
};

/** A direction glyph for a tile's context: a small triangle, so the direction never rests on color alone. */
const Triangle = ({ dir }: { dir: 'up' | 'down' }) => (
  <svg width={10} height={10} viewBox="0 0 10 10" aria-hidden="true">
    <path d={dir === 'up' ? 'M5 1.5 9 8.5H1z' : 'M5 8.5 1 1.5h8z'} fill="currentColor" />
  </svg>
);

/** A sparkline's path in a 100 x 32 box: min to max fills the height, 2 px in from each edge so the line is never cut. */
export const sparkPath = (points: number[]): string => {
  const lo = Math.min(...points);
  const hi = Math.max(...points);
  const span = hi - lo || 1;
  const step = 100 / (points.length - 1);
  return points.map((v, i) => `${i ? 'L' : 'M'}${(i * step).toFixed(2)} ${(30 - ((v - lo) / span) * 28).toFixed(2)}`).join(' ');
};

export interface StatTileProps {
  /** The 18 px glyph before the label (Deep Sky). */
  icon?: ReactNode;
  /** The label: what the number is ("Resting heart rate"). */
  label: string;
  /** The value, in even figures; a `NoData` when there is none. */
  value: ReactNode;
  /** The unit after the value ("bpm", "%"), Inter 500 15 Dusk. */
  unit?: ReactNode;
  /** The context under the value: its window or what it is compared with ("30 days", "vs your normal"). */
  context?: ReactNode;
  /** A direction for the context's triangle. */
  dir?: 'up' | 'down';
  /** A reading worth a look: the context in Night Ink 600 with its triangle (never Deep Sky). */
  hi?: boolean;
  /** The sparkline's points, oldest first. Drawn only from 7 points up. */
  spark?: number[];
  /** The whole tile is the target and opens its detail; it then shows the 18 px chevron. */
  onPress?: () => void;
  /** VoiceOver's one line for the tile, when the value is a node; else it is read from the label, value, unit and context. */
  read?: string;
  className?: string;
}

/**
 * A stat tile (layout standard 6.3): a label row (glyph and label, a chevron when it opens something), the value 8 below
 * at --fs-value 26/32 with its unit 4 after, then one context line, then an optional 32 px sparkline. Trends and Health use
 * this one tile; lay tiles in a `TileGrid` (one column above 150 percent text).
 */
export const StatTile = ({ icon, label, value, unit, context, dir, hi, spark, onPress, read, className = '' }: StatTileProps) => {
  const line = read ?? readStat(label, value, unit, context);
  const press = usePress({ disabled: !onPress });
  const body = (
    <>
      <span className="tile-head" aria-hidden={line ? true : undefined}>
        <span className="tile-label">
          {icon}
          {label}
        </span>
        {onPress ? <ChevronRight size={18} className="tile-chev" aria-hidden="true" /> : null}
      </span>
      <span className="tile-value" aria-hidden={line ? true : undefined}>
        {value}
        {unit ? <small>{unit}</small> : null}
      </span>
      {context ? (
        <span className={`tile-context ${hi ? 'is-hi' : ''}`.trim()} aria-hidden={line ? true : undefined}>
          {dir ? <Triangle dir={dir} /> : null}
          {context}
        </span>
      ) : null}
      {spark && spark.length >= 7 ? (
        <svg className="tile-spark" viewBox="0 0 100 32" preserveAspectRatio="none" aria-hidden="true">
          <path d={sparkPath(spark)} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        </svg>
      ) : null}
    </>
  );
  if (onPress)
    return (
      <button type="button" className={`tile ${className}`.trim()} onClick={onPress} aria-label={line ?? undefined} {...press.handlers}>
        {body}
      </button>
    );
  return (
    <div className={`tile ${className}`.trim()} role={line ? 'img' : undefined} aria-label={line ?? undefined}>
      {body}
    </div>
  );
};

/**
 * A section with nothing yet (layout standard 6.5): one 64 row in the section's group, a 32 px Haze icon tile, the title
 * (Inter 600 17, "No trends yet"), one Dusk line that may take two lines, and an optional trailing quiet link. Never a
 * second button for an action the screen already offers. For a whole screen or its hero, use `EmptyState`. `bare` drops
 * the group so the row can sit inside a card that is already there.
 */
export const SectionEmpty = ({ icon, title, line, action, bare, className = '' }: { icon: ReactNode; title: ReactNode; line?: ReactNode; action?: { label: string; onPress: () => void; voiceLabel?: string }; bare?: boolean; className?: string }) => {
  const row = (
    <div className={`lrow two section-empty ${bare ? className : ''}`.replace(/\s+/g, ' ').trim()}>
      <span className="icon-tile" aria-hidden="true">
        {icon}
      </span>
      <div className="lrow-main">
        <div className="lrow-title">{title}</div>
        {line ? <div className="lrow-sub">{line}</div> : null}
      </div>
      {action ? (
        <div className="lrow-right">
          <Button variant="quiet" size="sm" onClick={action.onPress} aria-label={action.voiceLabel}>
            {action.label}
          </Button>
        </div>
      ) : null}
    </div>
  );
  return bare ? row : <div className={`group ${className}`.trim()}>{row}</div>;
};

/** No data yet, said in a word (layout standard 4.6): "None yet" in Dusk at the size of where it sits. Never a bare dash. */
export const NoData = ({ children = 'None yet', className = '' }: { children?: ReactNode; className?: string }) => <span className={`no-data ${className}`.trim()}>{children}</span>;

/**
 * Two chevrons that page (a week, a month; layout standard 6.6). In a section header or a card: two bare 44 icon buttons
 * with Deep Sky 18 px chevrons, hit boxes touching. `inBar` (a pushed bar): two 40 px round Paper buttons, 12 apart.
 */
export const PagerButtons = ({ onPrev, onNext, prevLabel, nextLabel, prevDisabled, nextDisabled, inBar, className = '' }: { onPrev: () => void; onNext: () => void; prevLabel: string; nextLabel: string; prevDisabled?: boolean; nextDisabled?: boolean; inBar?: boolean; className?: string }) => (
  <span className={`pager-btns ${inBar ? 'in-bar' : ''} ${className}`.replace(/\s+/g, ' ').trim()}>
    <button type="button" aria-label={prevLabel} title={prevLabel} disabled={prevDisabled} onClick={onPrev}>
      <ChevronLeft size={18} aria-hidden="true" />
    </button>
    <button type="button" aria-label={nextLabel} title={nextLabel} disabled={nextDisabled} onClick={onNext}>
      <ChevronRight size={18} aria-hidden="true" />
    </button>
  </span>
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
 * The one list row (layout standard 6.2): 56 tall, 64 with a subtitle. With `onClick` the whole row is the button (role,
 * keyboard, press state); with `href` it is a link; with `as="label"` a tap anywhere focuses the control it holds. Controls
 * inside `right` keep their own tap: the row's action does not fire for a tap that landed on one of them.
 *
 * `left` is a 32 px icon tile (`.icon-tile`) or a `DateGutter`; `right` is one value (`<span className="lrow-value">`), a
 * tag or a quiet link, then the chevron. The title's weight is set by its group (styles/shape.css); `head` keeps it 600
 * for a session name; `wrap` lets the subtitle take two lines where the subtitle is the content.
 */
export const Row = ({ left, title, sub, right, onClick, href, two, head, wrap, className = '', as = 'div', label, ...rest }: { left?: ReactNode; title: ReactNode; sub?: ReactNode; right?: ReactNode; onClick?: () => void; href?: string; two?: boolean; head?: boolean; wrap?: boolean; className?: string; as?: 'div' | 'li' | 'label'; label?: string } & Omit<React.HTMLAttributes<HTMLElement>, 'title' | 'onClick' | 'className'>) => {
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
    <Tag className={`lrow ${two || sub ? 'two' : ''} ${head ? 'is-head' : ''} ${wrap ? 'wrap' : ''} ${tappable ? 'tappable' : ''} ${className}`.replace(/\s+/g, ' ').trim()} onClick={press} role={onClick && !href ? 'button' : undefined} tabIndex={onClick && !href ? 0 : undefined} onKeyDown={key} aria-label={label} {...linkProps} {...rest}>
      {left}
      <Inner className="lrow-main">
        <Inner className="lrow-title">{title}</Inner>
        {sub ? <Inner className="lrow-sub">{sub}</Inner> : null}
      </Inner>
      {right ? <Inner className="lrow-right">{right}</Inner> : null}
    </Tag>
  );
};

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

/**
 * The date column of a date-gutter row (layout standard 6.2): 40 px wide, the day numeral (Inter 600 17, even figures) over
 * the weekday in sentence case (Inter 500 13 Dusk, 4 below). Today's numeral is ringed (guide 6.13). Put it as a row's
 * `left`, or first in a `.date-row`; content starts 12 after it. It is a picture of the date: the row says the date in its
 * own label, so the column is hidden from VoiceOver. It carries no handlers, so a dragged row can hold it.
 */
export const DateGutter = ({ date, today, className = '' }: { date: string; today?: boolean; className?: string }) => {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const dow = DOW[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return (
    <span className={`date-gutter ${today ? 'is-today' : ''} ${className}`.replace(/\s+/g, ' ').trim()} aria-hidden="true">
      <span className="date-gutter-num">{d}</span>
      <span className="date-gutter-dow">{dow}</span>
    </span>
  );
};

/* The logo lives in ui/Brand.tsx (Wordmark, Lockup); the Orb is ui/Orb.tsx. */
