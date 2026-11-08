import { label, monthOf, type Session } from '@logbook/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronRight } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { write } from '@/api/outbox';
import { keys } from '@/api/queries';
import type { MonthBundle } from '@/api/types';
import { haptics } from '@/lib/haptics';
import { Button } from '@/ui/primitives';
import { useSheet } from '@/ui/Sheet';
import { PressButton } from './PressButton';
import { ARC_START, ARC_SWEEP, EFFORT_MAX, EFFORT_MIN, effortColor, effortLine, effortOf, effortWord, valueAt } from './effortModel';
import './effort.css';

/**
 * The effort check-in (docs/inspiration.md §3 "Effort dial", §5 "After a session"): one step after a run or a lift is
 * marked done. A 240° dial of ten segments from Columbia Blue to orange, the number glowing in the middle, the word and its
 * line under it, live; Save stays grey until a number is picked, Skip leaves it empty. It is stored on the session
 * (`POST /sessions/:id/effort`), shown on the session sheet (tap to change) and in the day's timeline ("Effort 6").
 */

/** Writes a session's effort: into the cached month at once (so every page shows it), then to the server (offline-safe). */
export const useSessionEffort = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ session, effort }: { session: Session; effort: number | null }) => {
      const m = monthOf(session.date);
      qc.setQueryData<MonthBundle>(keys.month(m), (b) => (b ? { ...b, sessions: b.sessions.map((x) => (x.id === session.id ? { ...x, effort } : x)) } : b));
      await write(`/sessions/${session.id}/effort`, 'POST', { effort }, [keys.month(m), ['timeline', session.date]]);
    },
    onError: (_e, v) => void qc.invalidateQueries({ queryKey: keys.month(monthOf(v.session.date)) }),
  });
};

const CX = 120;
const CY = 112;
const R = 92;
const SEG = ARC_SWEEP / (EFFORT_MAX - EFFORT_MIN + 1);
const GAP = 3;
const pt = (deg: number, r = R) => [CX + r * Math.cos((deg * Math.PI) / 180), CY + r * Math.sin((deg * Math.PI) / 180)] as const;
const arcPath = (a0: number, a1: number) => {
  const [x0, y0] = pt(a0);
  const [x1, y1] = pt(a1);
  return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${R} ${R} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
};
const SEGMENTS = Array.from({ length: EFFORT_MAX - EFFORT_MIN + 1 }, (_, i) => {
  const a0 = ARC_START + i * SEG + GAP / 2;
  return { n: EFFORT_MIN + i, d: arcPath(a0, a0 + SEG - GAP), mid: a0 + (SEG - GAP) / 2 };
});

/** The dial alone: drag or tap along the arc, or arrow keys (a slider to assistive tech). `value` null draws it empty. */
export const EffortDial = ({ value, onChange, labelledBy }: { value: number | null; onChange: (n: number) => void; labelledBy?: string }) => {
  const svg = useRef<SVGSVGElement>(null);
  const down = useRef(false);
  const last = useRef(value);
  last.current = value;
  const pick = (e: React.PointerEvent) => {
    const el = svg.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const k = 240 / r.width;
    const n = valueAt((e.clientX - r.left) * k - CX, (e.clientY - r.top) * k - CY);
    if (n != null && n !== last.current) {
      haptics.select();
      onChange(n);
    }
  };
  const key = (e: React.KeyboardEvent) => {
    const v = value ?? 5;
    const to = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? v + (value == null ? 0 : 1) : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? v - (value == null ? 0 : 1) : e.key === 'Home' ? EFFORT_MIN : e.key === 'End' ? EFFORT_MAX : null;
    if (to == null) return;
    e.preventDefault();
    onChange(Math.min(EFFORT_MAX, Math.max(EFFORT_MIN, to)));
  };
  const color = value != null ? effortColor(value) : null;
  const knob = value != null ? pt(SEGMENTS[value - EFFORT_MIN]!.mid) : null;
  return (
    <div className="eff-dial" style={color ? ({ '--eff': color } as React.CSSProperties) : undefined} data-no-page="">
      <svg
        ref={svg}
        viewBox="0 0 240 200"
        role="slider"
        tabIndex={0}
        aria-labelledby={labelledBy}
        aria-valuemin={EFFORT_MIN}
        aria-valuemax={EFFORT_MAX}
        aria-valuenow={value ?? undefined}
        aria-valuetext={value != null ? effortLine(value) : 'Not set'}
        onKeyDown={key}
        onPointerDown={(e) => {
          // the dial owns this finger: not the sheet's drag, not the pager
          e.stopPropagation();
          down.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          pick(e);
        }}
        onPointerMove={(e) => down.current && pick(e)}
        onPointerUp={() => void (down.current = false)}
        onPointerCancel={() => void (down.current = false)}
      >
        {SEGMENTS.map((s) => (
          <path key={s.n} d={s.d} className={`eff-seg ${value != null && s.n <= value ? 'is-on' : ''}`} style={value != null && s.n <= value ? { stroke: effortColor(s.n) } : undefined} />
        ))}
        {knob ? <circle className="eff-knob" cx={knob[0]} cy={knob[1]} r={13} /> : null}
      </svg>
      <div className="eff-mid" aria-hidden="true">
        <span className="eff-glow" />
        <span className="stamp eff-num tnum">{value ?? '–'}</span>
        <span className="eff-word">{value != null ? effortWord(value) : 'Not set'}</span>
      </div>
    </div>
  );
};

/** The dial with its live line and the two verbs. Used inline in the session sheet and as the body of the check-in sheet. */
export const EffortCheck = ({ session, initial, onDone, compact }: { session: Session; initial?: number | null; onDone: (saved: number | null) => void; compact?: boolean }) => {
  const [v, setV] = useState<number | null>(initial ?? null);
  const effort = useSessionEffort();
  const id = useId();
  const box = useRef<HTMLElement>(null);
  const changed = v != null && v !== (initial ?? null);
  // in the session sheet it opens where the sheet asked it (after Done, or after Done logging): bring it into view
  useEffect(() => {
    if (compact) box.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
  }, [compact]);
  return (
    <section ref={box} className={`eff ${compact ? 'is-inline' : ''}`} aria-labelledby={id}>
      <h3 id={id} className="caps eff-q">
        {initial != null ? 'Change effort' : 'How hard was it?'}
      </h3>
      <EffortDial value={v} onChange={setV} labelledBy={id} />
      <p className="eff-line" aria-live="polite">
        {v != null ? effortLine(v) : 'Drag along the arc: 1 is easy, 10 is all out.'}
      </p>
      <div className="eff-acts">
        <Button variant="quiet" onClick={() => onDone(null)}>
          {initial != null ? 'Cancel' : 'Skip'}
        </Button>
        <Button
          variant="primary"
          className="eff-save"
          disabled={!changed}
          onClick={() => {
            if (v == null) return;
            effort.mutate({ session, effort: v });
            onDone(v);
          }}
        >
          Save
        </Button>
      </div>
    </section>
  );
};

/**
 * The session sheet's effort: once it counts, `Effort 6 · Steady` as a row that opens the dial in place to change it; with
 * none yet, `How hard was it?` as the same row. `ask` opens the dial at once (the sheet's own Done just marked it).
 */
export const EffortRow = ({ session, ask, onAsked }: { session: Session; ask: boolean; onAsked: () => void }) => {
  const [open, setOpen] = useState(false);
  const e = effortOf(session.effort);
  const showing = open || ask;
  if (showing)
    return (
      <EffortCheck
        compact
        session={session}
        initial={e}
        onDone={() => {
          setOpen(false);
          onAsked();
        }}
      />
    );
  return (
    <PressButton press="surface" className={`eff-row ${e != null ? 'has-value' : ''}`} onClick={() => setOpen(true)} aria-label={e != null ? `Effort ${effortLine(e)}. Change` : 'Add how hard it was'}>
      <span className="eff-chip stamp tnum" style={e != null ? ({ '--eff': effortColor(e) } as React.CSSProperties) : undefined} aria-hidden="true">
        {e ?? '–'}
      </span>
      <span className="eff-row-main">
        <span className="eff-row-title">{e != null ? `Effort ${e} · ${effortWord(e)}` : 'How hard was it?'}</span>
        <span className="eff-row-sub">{e != null ? 'Tap to change' : 'Add your effort, 1 to 10'}</span>
      </span>
      <ChevronRight size={18} className="ink3" aria-hidden="true" />
    </PressButton>
  );
};

/**
 * After a Done from a hold menu (no sheet up): the check-in as its own small sheet, the session's name as the eyebrow.
 * Skip and Save both close it.
 */
export const useEffortPrompt = () => {
  const sheet = useSheet();
  return (s: Session) => {
    if (s.kind !== 'run' && s.kind !== 'lift' && s.kind !== 'cross') return;
    sheet.open({ eyebrow: label(s), title: 'Effort', body: <EffortCheck session={s} initial={effortOf(s.effort)} onDone={() => sheet.close()} /> });
  };
};
