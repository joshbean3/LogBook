import { ChevronDown } from 'lucide-react';
import { useLayoutEffect, useRef, useState } from 'react';
import { haptics } from '@/lib/haptics';
import { Segmented } from '@/ui/primitives';
import './charts.css';

/**
 * A chart's range: the app's segmented control (guide 6.3: Cloud track, Sky thumb, Inter 15, 44 tall), one segment per
 * span, placed under the plot it changes (layout standard 6.4). Every segment keeps a 44 pt target: where the row is wider
 * than the card (seven segments on a 320 pt phone) it scrolls sideways, the chosen one is scrolled into view, and the edge
 * with more beyond it fades out, so the hidden segments read as there. VoiceOver
 * reads each segment in words ("3 months"). Above 150 percent text the one-word labels cannot fit, so the row becomes a menu
 * button: the range in words with a chevron, opening the system's picker. A change ticks once (`select`).
 */
export function RangeControl<K extends string>({ value, options, words, onChange, label = 'Range', className = '' }: { value: K; options: readonly K[]; words: Record<K, string>; onChange: (k: K) => void; label?: string; className?: string }) {
  const scroller = useRef<HTMLDivElement>(null);
  // which edges have segments beyond them: 'start', 'end', 'both', or none when the row fits
  const [more, setMore] = useState<'start' | 'end' | 'both' | undefined>(undefined);
  const edges = () => {
    const el = scroller.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    const s = max > 1 && el.scrollLeft > 1;
    const e = max > 1 && el.scrollLeft < max - 1;
    setMore(s && e ? 'both' : s ? 'start' : e ? 'end' : undefined);
  };
  const change = (k: K) => {
    if (k === value) return;
    haptics.select();
    onChange(k);
  };
  // the chosen segment in view (the row scrolls only where it is wider than the card)
  useLayoutEffect(() => {
    const el = scroller.current;
    const on = el?.querySelector<HTMLElement>('.seg-btn[aria-checked="true"]');
    if (el && on && el.scrollWidth > el.clientWidth + 1) {
      const left = on.offsetLeft - (el.clientWidth - on.offsetWidth) / 2;
      el.scrollLeft = Math.max(0, Math.min(el.scrollWidth - el.clientWidth, left));
    }
    edges();
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps
  // a rotation or a text size change can make the row fit, or stop fitting
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => edges());
    ro.observe(el);
    return () => ro.disconnect();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className={`rc ${className}`.trim()}>
      <div className="rc-scroll" ref={scroller} data-more={more} onScroll={edges}>
        <Segmented
          className="rc-seg"
          label={label}
          value={value}
          onChange={change}
          options={options.map((k) => [
            k,
            <>
              <span aria-hidden="true">{k}</span>
              <span className="sr-only">{words[k]}</span>
            </>,
          ])}
        />
      </div>
      <label className="rc-menu">
        <span className="rc-menu-words" aria-hidden="true">
          {words[value]}
        </span>
        <ChevronDown size={18} aria-hidden="true" />
        <select aria-label={label} value={value} onChange={(e) => change(e.target.value as K)}>
          {options.map((k) => (
            <option key={k} value={k}>
              {words[k]}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
