import { Activity, ArrowDown, ArrowUp, Check, Heart, Moon, Sun, Watch, type LucideIcon } from 'lucide-react';
import { useId } from 'react';
import type * as React from 'react';
import type { SleepSegment, SleepStage } from '@/lib/health';
import './health.css';

/**
 * Logbook's health pieces, drawn the way Bevel draws its own (docs/health/apple-health.md §4) in Columbia, white and
 * orange: a beveled dial (a raised white rim, a gradient arc, a recessed face), the slim range capsule pressed into a
 * tile, a status word with its icon, the hypnogram on a night-navy card, stage tiles with their share as a small ring,
 * frosted glass tiles, and the illustrated hero for connecting Apple Health.
 */

// ---------- the beveled dial, in one of three colors ----------
export type DialTone = 'warm' | 'cool' | 'night';
const DIAL_STOPS: Record<DialTone, [string, string]> = {
  warm: ['#ffd2ad', '#f2600c'],
  cool: ['#cfe6f3', '#3a7fb9'],
  night: ['#d7e7f4', '#1b3d63'],
};
export const BevelDial = ({ value, tone, label, size = 108 }: { value: number | null; tone: DialTone; label?: string; size?: number }) => {
  const gid = useId().replace(/:/g, '');
  const r = 46;
  const c = 2 * Math.PI * r;
  const v = value == null ? 0 : Math.max(0, Math.min(100, value)) / 100;
  const [a, b] = DIAL_STOPS[tone];
  return (
    <span className={`hd-dial is-${tone} ${value == null ? 'is-empty' : ''}`} style={{ '--sz': `${size}px` } as React.CSSProperties} role="img" aria-label={`${label ?? tone}: ${value == null ? 'no data yet' : `${Math.round(value)}%`}`}>
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={a} />
            <stop offset="1" stopColor={b} />
          </linearGradient>
        </defs>
        <circle className="hd-track" cx="60" cy="60" r={r} />
        {value != null && v > 0 ? <circle className="hd-arc" cx="60" cy="60" r={r} stroke={`url(#${gid})`} strokeDasharray={c} strokeDashoffset={c * (1 - v)} transform="rotate(-90 60 60)" /> : null}
      </svg>
      <span className="hd-face" aria-hidden="true">
        <b className="hd-num">
          {value == null ? '–' : Math.round(value)}
          <small>%</small>
        </b>
      </span>
    </span>
  );
};

// ---------- the range capsule: your normal band, today's mark ----------
/** `pos` and `band` are 0..1 up the capsule. No band yet: a dotted capsule (still learning your normal). */
export const RangeCapsule = ({ pos, band, worry }: { pos: number | null; band?: [number, number] | null; worry?: boolean }) => {
  const at = (x: number) => `${(1 - Math.max(0, Math.min(1, x))) * 100}%`;
  return (
    <span className={`hd-cap ${band ? '' : 'is-learning'} ${worry ? 'is-worry' : ''}`} aria-hidden="true">
      {band ? <i className="hd-cap-band" style={{ top: at(band[1]), bottom: `${Math.max(0, Math.min(1, band[0])) * 100}%` }} /> : null}
      {pos != null ? <b className="hd-cap-dot" style={{ top: at(pos) }} /> : null}
    </span>
  );
};

// ---------- the status word ----------
export type Status = 'normal' | 'higher' | 'lower' | 'worry-up' | 'worry-down' | 'learning' | 'none';
const STATUS: Record<Status, { word: string; Icon: LucideIcon | null }> = {
  normal: { word: 'Normal', Icon: Check },
  higher: { word: 'Higher', Icon: ArrowUp },
  lower: { word: 'Lower', Icon: ArrowDown },
  'worry-up': { word: 'Higher', Icon: ArrowUp },
  'worry-down': { word: 'Lower', Icon: ArrowDown },
  learning: { word: 'Learning', Icon: null },
  none: { word: 'No data yet', Icon: null },
};
export const StatusWord = ({ status, word }: { status: Status; word?: string }) => {
  const s = STATUS[status];
  return (
    <span className={`hd-status is-${status}`}>
      <i aria-hidden="true">{s.Icon ? <s.Icon size={11} strokeWidth={3} /> : null}</i>
      {word ?? s.word}
    </span>
  );
};

// ---------- a number tile (Bevel 301) ----------
/** `plain`: the number and when it was read, with no word or capsule comparing it to a usual range. */
export const MonitorTile = ({ icon: Icon, label, value, unit, status = 'none', foot, pos, band, worry, plain }: { icon: LucideIcon; label: string; value: string | null; unit?: string; status?: Status; foot?: string; pos?: number | null; band?: [number, number] | null; worry?: boolean; plain?: boolean }) => (
  <div className="hd-tile">
    <div className="hd-tile-main">
      <span className="hd-tile-label">
        <Icon size={15} strokeWidth={2.2} aria-hidden="true" />
        {label}
      </span>
      <span className={`hd-tile-value ${value == null ? 'is-none' : ''}`}>
        {value ?? '–'}
        {value != null && unit ? <small> {unit}</small> : null}
      </span>
      {plain && value != null ? null : <StatusWord status={value == null ? 'none' : status} />}
      {foot ? <span className="hd-tile-foot">{foot}</span> : null}
    </div>
    {plain ? null : <RangeCapsule pos={value == null ? null : (pos ?? 0.5)} band={band} worry={worry} />}
  </div>
);

// ---------- the hypnogram ----------
const LEVEL: Record<SleepStage, number> = { awake: 0, rem: 1, core: 2, asleep: 2, deep: 3, in_bed: -1, unknown: -1 };
const STAGE_COLOR: Record<string, string> = { awake: '#ff8a3d', rem: '#d8ecf8', core: '#8dbbe2', asleep: '#8dbbe2', deep: '#4f7fd6' };
/**
 * The night as stepped bars, one row per stage (Awake on top, Deep at the bottom), on a night-navy card. Thin risers join
 * a stage to the next, so it reads as one line through the night.
 */
export const Hypnogram = ({ segments, start, end }: { segments: SleepSegment[]; start: string; end: string }) => {
  const t0 = Date.parse(start);
  const t1 = Math.max(Date.parse(end), t0 + 60_000);
  const W = 320;
  const ROW = 30;
  const BAR = 16;
  const x = (iso: string) => ((Date.parse(iso) - t0) / (t1 - t0)) * W;
  const shown = segments.filter((s) => LEVEL[s.stage] >= 0).sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
  const yOf = (s: SleepSegment) => LEVEL[s.stage] * ROW + (ROW - BAR) / 2;
  return (
    <svg className="hd-hyp" viewBox={`0 0 ${W} ${ROW * 4}`} preserveAspectRatio="none" role="img" aria-label="Sleep stages through the night">
      {[0, 1, 2, 3].map((i) => (
        <line key={i} className="hd-hyp-grid" x1="0" x2={W} y1={i * ROW + ROW / 2} y2={i * ROW + ROW / 2} />
      ))}
      {shown.map((s, i) => {
        const prev = shown[i - 1];
        const x0 = x(s.start);
        const riser = prev && LEVEL[prev.stage] !== LEVEL[s.stage] ? <line className="hd-hyp-riser" x1={x0} x2={x0} y1={yOf(prev) + BAR / 2} y2={yOf(s) + BAR / 2} /> : null;
        return (
          <g key={`${s.start}-${i}`}>
            {riser}
            <rect x={x0} y={yOf(s)} width={Math.max(1.5, x(s.end) - x0)} height={BAR} rx="3" fill={STAGE_COLOR[s.stage]} className={`hd-hyp-bar is-${s.stage}`} />
          </g>
        );
      })}
    </svg>
  );
};

/** A stage's share of the night: its time, its percent, and a small ring. */
export const StageTile = ({ stage, label, sec, total }: { stage: string; label: string; sec: number; total: number }) => {
  const share = total > 0 ? sec / total : 0;
  const r = 13;
  const c = 2 * Math.PI * r;
  const m = Math.round(sec / 60);
  return (
    <div className={`hd-stage is-${stage}`}>
      <span className="hd-stage-label">{label}</span>
      <span className="hd-stage-time tnum">
        {Math.floor(m / 60)}:{String(m % 60).padStart(2, '0')}
      </span>
      <span className="hd-stage-pct tnum">{Math.round(share * 100)}%</span>
      <svg className="hd-stage-ring" viewBox="0 0 34 34" aria-hidden="true">
        <circle cx="17" cy="17" r={r} className="hd-stage-track" />
        <circle cx="17" cy="17" r={r} className="hd-stage-arc" stroke={STAGE_COLOR[stage]} strokeDasharray={c} strokeDashoffset={c * (1 - share)} transform="rotate(-90 17 17)" />
      </svg>
    </div>
  );
};

/** A time chip under the hypnogram: the moon at the start, the sun at the end. */
export const TimeChip = ({ at, end }: { at: string; end?: boolean }) => (
  <span className="hd-chip">
    {end ? <Sun size={12} strokeWidth={2.4} aria-hidden="true" /> : <Moon size={12} strokeWidth={2.4} aria-hidden="true" />}
    {new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(new Date(at))}
  </span>
);

/** "Tracked with Sam's Apple Watch". */
export const SourceLine = ({ source }: { source: string }) => (
  <span className="hd-source">
    <Watch size={14} strokeWidth={2.2} aria-hidden="true" />
    Tracked with {source}
  </span>
);

// ---------- glass ----------
export const GlassTile = ({ icon: Icon, tone = 'navy', size = 52, className = '' }: { icon: LucideIcon; tone?: 'navy' | 'orange' | 'columbia'; size?: number; className?: string }) => (
  <span className={`hd-glass is-${tone} ${className}`} style={{ '--gs': `${size}px` } as React.CSSProperties} aria-hidden="true">
    <Icon size={Math.round(size * 0.44)} strokeWidth={2.1} />
  </span>
);

// ---------- the heroes ----------
/**
 * Connecting Apple Health: a beveled dial with tick marks and one orange arc with a lit end (one arc, never nested rings:
 * those read as Apple's Activity rings, gap-rev-28), glass tiles for the night and the two heart numbers floating around
 * it, over a faint grid.
 */
export const HealthHero = () => {
  const gid = useId().replace(/:/g, '');
  const arc = (r: number, from: number, to: number) => {
    const p = (deg: number) => [60 + r * Math.cos(((deg - 90) * Math.PI) / 180), 60 + r * Math.sin(((deg - 90) * Math.PI) / 180)];
    const [x0, y0] = p(from);
    const [x1, y1] = p(to);
    return { d: `M ${x0} ${y0} A ${r} ${r} 0 ${to - from > 180 ? 1 : 0} 1 ${x1} ${y1}`, end: [x1, y1] as const };
  };
  const rings = [{ r: 46, from: 210, to: 480, stroke: `url(#${gid}-o)`, dot: '#f2600c' }];
  return (
    <div className="hd-hero" aria-hidden="true">
      <div className="hd-hero-dial">
        <svg viewBox="0 0 120 120">
          <defs>
            <linearGradient id={`${gid}-o`} x1="0" x2="1">
              <stop offset="0" stopColor="#ffd2ad" />
              <stop offset="1" stopColor="#f2600c" />
            </linearGradient>
          </defs>
          {Array.from({ length: 60 }, (_, i) => {
            const a = (i * 6 * Math.PI) / 180;
            const long = i % 5 === 0;
            return <line key={i} className={`hd-tick ${long ? 'is-long' : ''}`} x1={60 + 57 * Math.sin(a)} y1={60 - 57 * Math.cos(a)} x2={60 + (long ? 53 : 55) * Math.sin(a)} y2={60 - (long ? 53 : 55) * Math.cos(a)} />;
          })}
          {rings.map((g) => {
            const { d, end } = arc(g.r, g.from, g.to);
            return (
              <g key={g.r}>
                <circle cx="60" cy="60" r={g.r} className="hd-hero-track" />
                <path d={d} stroke={g.stroke} className="hd-hero-arc" />
                <circle cx={end[0]} cy={end[1]} r="3.2" className="hd-hero-end" stroke={g.dot} />
              </g>
            );
          })}
        </svg>
        <span className="hd-hero-face">
          <Heart size={26} strokeWidth={2} />
        </span>
      </div>
      <GlassTile icon={Moon} tone="navy" size={46} className="hd-float is-a" />
      <GlassTile icon={Activity} tone="orange" size={42} className="hd-float is-b" />
      <GlassTile icon={Heart} tone="columbia" size={40} className="hd-float is-c" />
    </div>
  );
};
