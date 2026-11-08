import type { ReactNode } from 'react';
import { Pressable } from '../Pressable';
import { arcPath, clamp01 } from './scale';
import './charts.css';

/**
 * One ring: a Columbia track and a navy arc for the share done. `value` null draws the empty track with "–" in the middle
 * (a ring never pretends to a zero it does not know). `lit` turns the arc orange: the one ring that is the highlight.
 */
export const Ring = ({ value, size = 64, stroke = 7, lit, children }: { value: number | null; size?: number; stroke?: number; lit?: boolean; children?: ReactNode }) => {
  const v = clamp01(value);
  const c = size / 2;
  const r = c - stroke / 2 - 1;
  return (
    <span className="ck-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={c} cy={c} r={r} className="ck-ring-track" strokeWidth={stroke} />
        {v != null && v > 0 ? (
          v >= 0.9999 ? (
            <circle cx={c} cy={c} r={r} className={`ck-ring-arc ${lit ? 'lit' : ''}`} strokeWidth={stroke} />
          ) : (
            <path d={arcPath(c, c, r, -90, -90 + v * 360)} className={`ck-ring-arc ${lit ? 'lit' : ''}`} strokeWidth={stroke} />
          )
        ) : null}
      </svg>
      <span className="ck-ring-mid stamp">{children ?? (v == null ? '–' : null)}</span>
    </span>
  );
};

export interface RingItem {
  key: string;
  label: string;
  value: number | null;
  /** What sits in the middle ("82", "7h"); "–" when the value is null. */
  center?: ReactNode;
  onPress?: () => void;
  lit?: boolean;
}

/** Up to three rings in a row, each with its label under it; a tap opens its metric page. */
export const Rings = ({ items, size = 72 }: { items: RingItem[]; size?: number }) => (
  <div className="ck-rings" role="list">
    {items.map((it) => {
      const ring = (
        <>
          <Ring value={it.value} size={size} lit={it.lit}>
            {it.value == null ? '–' : it.center}
          </Ring>
          <span className="ck-rings-label caps">{it.label}</span>
        </>
      );
      return it.onPress ? (
        <Pressable key={it.key} className="ck-rings-item" press="scale" onPress={it.onPress} label={`${it.label}: ${it.value == null ? 'no data yet' : `${Math.round((it.value ?? 0) * 100)}%`}. Open`}>
          {ring}
        </Pressable>
      ) : (
        <span key={it.key} className="ck-rings-item" role="listitem" aria-label={`${it.label}: ${it.value == null ? 'no data yet' : `${Math.round((it.value ?? 0) * 100)}%`}`}>
          {ring}
        </span>
      );
    })}
  </div>
);
