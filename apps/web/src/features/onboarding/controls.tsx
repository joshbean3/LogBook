import { buildMorning, fmtDate, morningDayFor, tone as toneOf, WEEKDAYS, type Goal, type ISODate, type MorningSettings, type Weekday } from '@logbook/shared';
import { Check, Minus, Plus } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { haptics } from '@/lib/haptics';
import { springs } from '@/lib/motion';
import { Pressable } from '@/ui/Pressable';
import { DAY_LETTER, DAY_NAME, fixLongRun, GOALS, hm, hmFull, MIN_GAP, morningFrom, raceSundays, snap5, sortDays, STARTER_HABITS, TRACK_FROM, TRACK_TO, weeksUntil } from './model';

/**
 * The first-run controls, answered by touching the thing: goal chips, a race-day wheel, weekday letters, a miles dial, a
 * morning with two draggable markers, habit chips. Settings → Training uses the same ones, so the answers are edited the way
 * they were given. Every drag has a keyboard path (arrow keys) and every hold a visible button.
 */

// ---------- goal ----------
export const GoalChips = ({ value, onChange, id = 'ob-goal' }: { value: Goal | null; onChange: (g: Goal) => void; id?: string }) => {
  const reduce = useReducedMotion();
  const refs = useRef<Array<HTMLElement | null>>([]);
  const pick = (g: Goal) => {
    if (g === value) return;
    haptics.select();
    onChange(g);
  };
  const onKey = (e: React.KeyboardEvent, i: number) => {
    const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const n = (i + d + GOALS.length) % GOALS.length;
    pick(GOALS[n]!.id);
    refs.current[n]?.focus();
  };
  return (
    <div className="ob-goals" role="radiogroup" aria-label="What are you training for?">
      {GOALS.map((g, i) => {
        const on = value === g.id;
        return (
          <Pressable
            key={g.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            role="radio"
            aria-checked={on}
            tabIndex={on || (value == null && i === 0) ? 0 : -1}
            className={`ob-goal ${g.id === 'base' ? 'wide' : ''} ${on ? 'on' : ''}`}
            onPress={() => pick(g.id)}
            onKeyDown={(e: React.KeyboardEvent) => onKey(e, i)}
          >
            {on ? <motion.span layoutId={`${id}-thumb`} className="ob-goal-thumb" transition={reduce ? { duration: 0 } : springs.settle} aria-hidden="true" /> : null}
            <span className="ob-goal-text">{g.label}</span>
          </Pressable>
        );
      })}
    </div>
  );
};

// ---------- race day ----------
const ITEM = 76;
const GAP = 8;
/**
 * A horizontal wheel of Sundays: scroll or fling it, the day under the centre ring is the race, with a select tick per day
 * crossed. Tap a day to bring it to the centre; Left and Right do the same from the keyboard. The first stop is "No date".
 */
export const RaceStrip = ({ start, value, onChange }: { start: ISODate; value: ISODate | null; onChange: (d: ISODate | null) => void }) => {
  const reduce = useReducedMotion();
  const items: Array<ISODate | null> = [null, ...raceSundays(start)];
  const idxOf = (v: ISODate | null) => Math.max(0, items.indexOf(v));
  const ref = useRef<HTMLDivElement>(null);
  const cur = useRef(idxOf(value));
  const ready = useRef(false);
  const raf = useRef(0);
  const cb = useRef(onChange);
  cb.current = onChange;
  const listId = useId();

  const scrollToIdx = useCallback(
    (i: number, smooth: boolean) => {
      const el = ref.current;
      if (!el) return;
      el.scrollTo({ left: i * (ITEM + GAP), behavior: smooth && !reduce ? 'smooth' : 'auto' });
    },
    [reduce],
  );
  useLayoutEffect(() => {
    scrollToIdx(cur.current, false);
    const t = setTimeout(() => (ready.current = true), 120);
    return () => clearTimeout(t);
  }, [scrollToIdx]);
  // a change from outside (a new goal brings its own default day): glide there without ticking
  useEffect(() => {
    const i = idxOf(value);
    if (i !== cur.current) {
      cur.current = i;
      scrollToIdx(i, true);
    }
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  const onScroll = () => {
    if (raf.current) return;
    raf.current = requestAnimationFrame(() => {
      raf.current = 0;
      const el = ref.current;
      if (!el || !ready.current) return;
      const i = Math.min(items.length - 1, Math.max(0, Math.round(el.scrollLeft / (ITEM + GAP))));
      if (i !== cur.current) {
        cur.current = i;
        haptics.select();
        cb.current(items[i] ?? null);
      }
    });
  };
  const onKey = (e: React.KeyboardEvent) => {
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const i = Math.min(items.length - 1, Math.max(0, cur.current + d));
    scrollToIdx(i, true);
  };
  const sel = items[idxOf(value)];
  return (
    <div className="ob-race">
      <div className="ob-race-ring" aria-hidden="true" />
      <div
        ref={ref}
        className="ob-race-strip"
        role="listbox"
        tabIndex={0}
        aria-label="Race day"
        aria-activedescendant={`${listId}-${idxOf(value)}`}
        onScroll={onScroll}
        onKeyDown={onKey}
      >
        {items.map((d, i) => {
          const on = d === sel;
          return (
            <button
              type="button"
              key={d ?? 'none'}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={on}
              tabIndex={-1}
              className={`ob-race-day ${on ? 'on' : ''} ${d ? '' : 'none'}`}
              aria-label={d ? `${fmtDate('long', d)}, ${weeksUntil(start, d)} weeks away` : 'No race date yet'}
              onClick={() => scrollToIdx(i, true)}
            >
              {d ? (
                <>
                  <span className="caps">{fmtDate('monthShort', d)}</span>
                  <span className="stamp ob-race-num">{Number(d.slice(8))}</span>
                  <span className="ob-race-wk">{weeksUntil(start, d)} wk</span>
                </>
              ) : (
                <>
                  <span className="caps">No</span>
                  <span className="ob-race-none">date</span>
                  <span className="ob-race-wk">yet</span>
                </>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

// ---------- run days ----------
/**
 * Seven letters. Tap a letter to make it a run day (or a rest day); hold one to make it the long run. "Long run on Sunday"
 * under them is the button that does the same without the hold (each tap moves it to the next run day).
 */
export const DayLetters = ({ runDays, longRunDay, onChange }: { runDays: Weekday[]; longRunDay: Weekday; onChange: (runDays: Weekday[], longRunDay: Weekday) => void }) => {
  const reduce = useReducedMotion();
  const [nudge, setNudge] = useState<Weekday | null>(null);
  const toggle = (d: Weekday) => {
    const on = runDays.includes(d);
    if (on && runDays.length === 1) {
      // one run day is the least a plan can hold
      haptics.error();
      setNudge(d);
      setTimeout(() => setNudge(null), 320);
      return;
    }
    haptics.select();
    const next = sortDays(on ? runDays.filter((x) => x !== d) : [...runDays, d]);
    onChange(next, fixLongRun(next, longRunDay));
  };
  const makeLong = (d: Weekday) => {
    if (d === longRunDay) return;
    haptics.select();
    onChange(sortDays(runDays.includes(d) ? runDays : [...runDays, d]), d);
  };
  const cycle = () => {
    const s = sortDays(runDays);
    const next = s[(s.indexOf(longRunDay) + 1) % s.length]!;
    makeLong(next);
  };
  return (
    <div className="ob-days-wrap">
      <div className="ob-days" role="group" aria-label="Run days">
        {WEEKDAYS.map((d) => {
          const on = runDays.includes(d);
          const long = d === longRunDay && on;
          return (
            <Pressable
              key={d}
              className={`ob-day ${on ? 'on' : ''} ${long ? 'long' : ''}`}
              aria-pressed={on}
              label={`${DAY_NAME[d]}, ${long ? 'long run' : on ? 'run day' : 'rest day'}`}
              onPress={() => toggle(d)}
              onLongPress={() => makeLong(d)}
              animate={nudge === d && !reduce ? { x: [0, -5, 5, -3, 0], transition: { duration: 0.3 } } : { x: 0 }}
            >
              <span className="ob-day-disc">{DAY_LETTER[d]}</span>
              <span className="ob-day-cap" aria-hidden="true">
                {long ? 'Long' : ''}
              </span>
            </Pressable>
          );
        })}
      </div>
      <p className="ob-long">
        <span>Long run on</span>
        <button type="button" className="ob-long-btn" onClick={cycle} aria-label={`Long run on ${DAY_NAME[longRunDay]}. Move it to the next run day`}>
          {DAY_NAME[longRunDay]}
        </button>
        <span className="ob-long-hint">or hold a day</span>
      </p>
    </div>
  );
};

// ---------- miles (and pace) ----------
export interface DialProps {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  /** The stamped number. */
  format?: (v: number) => string;
  unit: string;
  /** VoiceOver: "18 miles a week". */
  valueText?: (v: number) => string;
  label: string;
  /** Pixels of drag per step. */
  scrubPx?: number;
}
/**
 * One big stamped number between two round buttons. Drag across the number to scrub (a tick per step), hold a button to
 * run, or use the arrow keys on the number (Page keys take five steps).
 */
export const Dial = ({ value, onChange, min, max, step = 1, format = String, unit, valueText, label, scrubPx = 14 }: DialProps) => {
  const v = useRef(value);
  v.current = value;
  const cb = useRef(onChange);
  cb.current = onChange;
  const set = (n: number) => {
    const c = Math.min(max, Math.max(min, Math.round(n / step) * step));
    if (c !== v.current) {
      v.current = c;
      haptics.select();
      cb.current(c);
    }
  };
  // hold a button: a step after a beat, then one every 110ms
  const rep = useRef<{ t: ReturnType<typeof setTimeout> | 0; i: ReturnType<typeof setInterval> | 0; ran: boolean }>({ t: 0, i: 0, ran: false });
  const stop = () => {
    if (rep.current.t) clearTimeout(rep.current.t);
    if (rep.current.i) clearInterval(rep.current.i);
    rep.current.t = 0;
    rep.current.i = 0;
  };
  useEffect(() => stop, []);
  const startRepeat = (d: number) => {
    stop();
    rep.current.ran = false;
    rep.current.t = setTimeout(() => {
      rep.current.ran = true;
      set(v.current + d);
      rep.current.i = setInterval(() => set(v.current + d), 110);
    }, 420);
  };
  /** The tap after a hold that already ran is not one more step. */
  const tap = (d: number) => {
    if (rep.current.ran) {
      rep.current.ran = false;
      return;
    }
    set(v.current + d);
  };
  const scrub = useRef<{ id: number; x: number; base: number } | null>(null);
  return (
    <div className="ob-miles">
      <Pressable className="ob-miles-btn" label={`${label}: less`} disabled={value <= min} onPress={() => tap(-step)} onPointerDown={() => startRepeat(-step)} onPointerUp={stop} onPointerLeave={stop} onPointerCancel={stop}>
        <Minus size={22} aria-hidden="true" />
      </Pressable>
      <div
        className="ob-miles-num"
        role="spinbutton"
        tabIndex={0}
        aria-label={label}
        aria-valuenow={value}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuetext={valueText ? valueText(value) : `${format(value)} ${unit}`}
        onKeyDown={(e) => {
          const d = e.key === 'ArrowUp' || e.key === 'ArrowRight' ? 1 : e.key === 'ArrowDown' || e.key === 'ArrowLeft' ? -1 : e.key === 'PageUp' ? 5 : e.key === 'PageDown' ? -5 : 0;
          if (!d) return;
          e.preventDefault();
          set(value + d * step);
        }}
        onPointerDown={(e) => {
          scrub.current = { id: e.pointerId, x: e.clientX, base: value };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          const s = scrub.current;
          if (!s || s.id !== e.pointerId) return;
          set(s.base + Math.round((e.clientX - s.x) / scrubPx) * step);
        }}
        onPointerUp={() => (scrub.current = null)}
        onPointerCancel={() => (scrub.current = null)}
      >
        <span className="stamp ob-miles-val">{format(value)}</span>
        <span className="ob-miles-unit">{unit}</span>
      </div>
      <Pressable className="ob-miles-btn" label={`${label}: more`} disabled={value >= max} onPress={() => tap(step)} onPointerDown={() => startRepeat(step)} onPointerUp={stop} onPointerLeave={stop} onPointerCancel={stop}>
        <Plus size={22} aria-hidden="true" />
      </Pressable>
    </div>
  );
};
/** The weekly miles: a sensible default by goal, then the athlete's own number. */
export const MilesDial = ({ value, onChange, min, max, label = 'Miles a week' }: { value: number; onChange: (v: number) => void; min: number; max: number; label?: string }) => (
  <Dial value={value} onChange={onChange} min={min} max={max} unit="mi a week" valueText={(n) => `${n} miles a week`} label={label} />
);

// ---------- the morning ----------
const pct = (m: number) => ((m - TRACK_FROM) / (TRACK_TO - TRACK_FROM)) * 100;
/**
 * Two markers on a 4:00–11:00 line: drag Wake and Leave in 5-minute steps (a select tick per step), or tap the line to bring
 * the nearer one there. Between them the morning draws itself live from the same timeline Morning uses: the run in its
 * colour, then the shower and getting ready. Each marker is a slider for the keyboard (arrows 5 min, Page keys 30).
 */
export const MorningTrack = ({ wake, leave, onChange, run = { type: 'Easy', miles: 4 }, settings }: { wake: number; leave: number; onChange: (wake: number, leave: number) => void; run?: { type: string; miles: number }; settings?: MorningSettings | null }) => {
  const track = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: number; which: 'wake' | 'leave' } | null>(null);
  const [active, setActive] = useState<'wake' | 'leave' | null>(null);
  const vals = useRef({ wake, leave });
  vals.current = { wake, leave };
  const cb = useRef(onChange);
  cb.current = onChange;

  const st = morningFrom(wake, leave, settings);
  const tl = buildMorning(
    morningDayFor([{ id: 'p', date: '2000-01-01', position: 0, kind: 'run', type: run.type, title: null, details: null, miles: run.miles, minutes: null, blockId: null, movedFrom: null, mark: null }], null, st),
    st,
  );
  const runTone = toneOf({ kind: 'run', type: run.type });

  const setVal = (which: 'wake' | 'leave', m: number) => {
    const { wake: w, leave: l } = vals.current;
    let nw = w;
    let nl = l;
    if (which === 'wake') nw = Math.min(Math.max(snap5(m), TRACK_FROM), l - MIN_GAP);
    else nl = Math.max(Math.min(snap5(m), TRACK_TO), w + MIN_GAP);
    if (nw === w && nl === l) return;
    vals.current = { wake: nw, leave: nl };
    haptics.select();
    cb.current(nw, nl);
  };
  const minutesAt = (clientX: number) => {
    const r = track.current!.getBoundingClientRect();
    return TRACK_FROM + ((clientX - r.left) / r.width) * (TRACK_TO - TRACK_FROM);
  };
  const onDown = (e: React.PointerEvent) => {
    if (!track.current || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const m = minutesAt(e.clientX);
    const target = (e.target as HTMLElement).closest('[data-marker]')?.getAttribute('data-marker') as 'wake' | 'leave' | null;
    const which = target ?? (Math.abs(m - vals.current.wake) <= Math.abs(m - vals.current.leave) ? 'wake' : 'leave');
    drag.current = { id: e.pointerId, which };
    setActive(which);
    e.currentTarget.setPointerCapture(e.pointerId);
    if (!target) setVal(which, m);
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    setVal(d.which, minutesAt(e.clientX));
  };
  const onUp = () => {
    drag.current = null;
    setActive(null);
  };
  const onKey = (which: 'wake' | 'leave') => (e: React.KeyboardEvent) => {
    const step = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 5 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -5 : e.key === 'PageUp' ? 30 : e.key === 'PageDown' ? -30 : 0;
    if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      setVal(which, e.key === 'Home' ? TRACK_FROM : TRACK_TO);
      return;
    }
    if (!step) return;
    e.preventDefault();
    setVal(which, vals.current[which] + step);
  };
  const hours = [5, 6, 7, 8, 9, 10];
  const segs = tl.blocks.filter((b) => b.key !== 'wake' && b.key !== 'free' && b.start < tl.leave);
  return (
    <div className="ob-track-wrap">
      <div className="ob-track-labels" aria-hidden="true">
        <span className={`ob-track-label ${active === 'wake' ? 'on' : ''}`} style={{ left: `clamp(0px, calc(${pct(wake)}% - 32px), calc(100% - 64px))` }}>
          <span className="caps">Wake</span>
          <span className="stamp">{hm(wake)}</span>
        </span>
      </div>
      <div ref={track} className="ob-track" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
        <div className="ob-track-line" />
        {segs.map((b, i) => (
          <span
            key={i}
            className={`ob-seg ${b.key === 'run' ? `run t-${runTone}` : b.key === 'buffer' ? 'buffer' : 'after'}`}
            style={{ left: `${pct(b.start)}%`, width: `${Math.max(0.6, pct(Math.min(b.end, tl.leave)) - pct(b.start))}%` }}
          />
        ))}
        {(['wake', 'leave'] as const).map((which) => {
          const m = which === 'wake' ? wake : leave;
          return (
            <span
              key={which}
              data-marker={which}
              className={`ob-marker ${which} ${active === which ? 'on' : ''}`}
              style={{ left: `${pct(m)}%` }}
              role="slider"
              tabIndex={0}
              aria-label={which === 'wake' ? 'Wake up' : 'Leave for work'}
              aria-valuemin={which === 'wake' ? TRACK_FROM : wake + MIN_GAP}
              aria-valuemax={which === 'wake' ? leave - MIN_GAP : TRACK_TO}
              aria-valuenow={m}
              aria-valuetext={hmFull(m)}
              onKeyDown={onKey(which)}
            />
          );
        })}
      </div>
      <div className="ob-track-labels below" aria-hidden="true">
        <span className={`ob-track-label ${active === 'leave' ? 'on' : ''}`} style={{ left: `clamp(0px, calc(${pct(leave)}% - 32px), calc(100% - 64px))` }}>
          <span className="caps">Leave</span>
          <span className="stamp">{hm(leave)}</span>
        </span>
      </div>
      <div className="ob-hours" aria-hidden="true">
        {hours.map((h) => (
          <span key={h} style={{ left: `${pct(h * 60)}%` }}>
            {h}
          </span>
        ))}
      </div>
    </div>
  );
};

// ---------- habits ----------
/** Starter habits as chips, plus your own. Above them, the orbs they become on Today, popping in as you pick them. */
export const HabitPicker = ({ selected, custom, onChange }: { selected: string[]; custom: string[]; onChange: (selected: string[], custom: string[]) => void }) => {
  const reduce = useReducedMotion();
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState('');
  const all = [...STARTER_HABITS, ...custom];
  const toggle = (h: string) => {
    haptics.select();
    onChange(selected.includes(h) ? selected.filter((x) => x !== h) : [...selected, h], custom);
  };
  const add = () => {
    const name = text.trim().replace(/\s+/g, ' ').slice(0, 80);
    setText('');
    if (!name) return setAdding(false);
    const dupe = all.find((x) => x.toLowerCase() === name.toLowerCase());
    haptics.select();
    if (dupe) onChange(selected.includes(dupe) ? selected : [...selected, dupe], custom);
    else onChange([...selected, name], [...custom, name]);
  };
  const full = selected.length >= 12;
  return (
    <div className="ob-habits">
      <div className="ob-orbs" aria-hidden="true">
        <AnimatePresence initial={false}>
          {selected.length ? (
            selected.slice(0, 6).map((h) => (
              <motion.span key={h} className="ob-orb" layout={!reduce} initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6 }} transition={reduce ? { duration: 0.15 } : springs.settle}>
                <span className="ob-orb-ring">
                  <span className="ob-orb-initial">{h.charAt(0).toUpperCase()}</span>
                </span>
                <span className="ob-orb-name">{h}</span>
              </motion.span>
            ))
          ) : (
            <motion.span key="ghost" className="ob-orbs-ghost" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {[0, 1, 2].map((i) => (
                <span key={i} className="ob-orb-ring ghost" />
              ))}
            </motion.span>
          )}
        </AnimatePresence>
        {selected.length > 6 ? <span className="ob-orb-more">+{selected.length - 6}</span> : null}
      </div>
      <div className="ob-chips" role="group" aria-label="Starter habits">
        {all.map((h) => {
          const on = selected.includes(h);
          return (
            <Pressable key={h} className={`ob-chip ${on ? 'on' : ''}`} aria-pressed={on} disabled={!on && full} onPress={() => toggle(h)}>
              {on ? <Check size={16} strokeWidth={2.6} aria-hidden="true" /> : null}
              {h}
            </Pressable>
          );
        })}
        {adding ? (
          <form
            className="ob-chip-form"
            onSubmit={(e) => {
              e.preventDefault();
              add();
            }}
          >
            <input className="ob-chip-in" autoFocus value={text} maxLength={80} placeholder="Your own" aria-label="Your own habit" enterKeyHint="done" onChange={(e) => setText(e.target.value)} onBlur={add} />
          </form>
        ) : (
          <Pressable className="ob-chip add" disabled={full} onPress={() => setAdding(true)}>
            <Plus size={16} strokeWidth={2.4} aria-hidden="true" />
            Your own
          </Pressable>
        )}
      </div>
    </div>
  );
};
