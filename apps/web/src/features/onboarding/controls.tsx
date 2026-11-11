import { buildMorning, fmtDate, morningDayFor, tone as toneOf, WEEKDAYS, type Goal, type ISODate, type MorningSettings, type Weekday } from '@logbook/shared';
import { Check, CircleSlash, Flag, Footprints, Medal, Minus, Plus, Timer, Trophy, Zap, type LucideIcon } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { haptics } from '@/lib/haptics';
import { crossfade, springs } from '@/lib/motion';
import { Pressable } from '@/ui/Pressable';
import { addHabit, DAY_LETTER, DAY_NAME, fixLongRun, GOALS, HABIT_LIMIT, HABIT_NAME_MAX, hm, hmFull, MIN_GAP, morningFrom, raceSundays, snap5, sortDays, STARTER_HABITS, TRACK_FROM, TRACK_TO, weeksUntil } from './model';

/**
 * The first-run controls, answered by touching the thing: goal chips, a race-day wheel, weekday letters, a miles dial, a
 * morning with two draggable markers, habit chips. Settings → Training uses the same ones, so the answers are edited the way
 * they were given. Every drag has a keyboard path (arrow keys) and every hold a visible button.
 */

// ---------- goal ----------
/**
 * Each goal's choice row: an icon and one plain line under the name (the race distance, then what the plan does), short
 * enough to stay one line at 390 (layout standard 6.2).
 */
export const GOAL_CARD: Record<Goal, { Icon: LucideIcon; line: string }> = {
  base: { Icon: Footprints, line: 'A steady build, no race day.' },
  '5k': { Icon: Zap, line: '3.1 miles. Speed, a short taper.' },
  '10k': { Icon: Timer, line: '6.2 miles. Speed and long runs.' },
  half: { Icon: Medal, line: '13.1 miles. Long runs, a taper.' },
  marathon: { Icon: Trophy, line: '26.2 miles. The longest build.' },
};
const goalCard = (g: Goal) => GOAL_CARD[g] ?? { Icon: Flag, line: '' };

/** The sixth choice on first run (onboarding-09): setup finishes with no running plan. */
const NO_PLAN = { id: 'none' as const, label: 'No running plan for now', Icon: CircleSlash, line: 'Habits, goals and the journal.' };
/**
 * What you are training for, as one inset group of radio rows (layout standard 2.11, 6.2; plan O5): a 32 px Haze tile,
 * the name 17/600 and one 15 Dusk line, hairlines from the words; the chosen row carries a Deep Sky check. One container,
 * not six cards. A radio group: arrows move the choice.
 */
export const GoalChips = ({ value, onChange, id = 'ob-goal', noneOn, onNone }: { value: Goal | null; onChange: (g: Goal) => void; id?: string; /** Offer "No running plan for now" (first run only): chosen when `noneOn`. */ noneOn?: boolean; onNone?: () => void }) => {
  const reduce = useReducedMotion();
  const refs = useRef<Array<HTMLElement | null>>([]);
  const choices = [...GOALS.map((g) => ({ id: g.id as Goal | 'none', label: g.label, ...goalCard(g.id) })), ...(onNone ? [NO_PLAN] : [])];
  const current: Goal | 'none' | null = noneOn ? 'none' : value;
  const pick = (g: Goal | 'none') => {
    if (g === current) return;
    haptics.select();
    if (g === 'none') onNone?.();
    else onChange(g);
  };
  const onKey = (e: React.KeyboardEvent, i: number) => {
    const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const n = (i + d + choices.length) % choices.length;
    pick(choices[n]!.id);
    refs.current[n]?.focus();
  };
  return (
    <div className="group ob-goals" role="radiogroup" aria-label="What are you training for?">
      {choices.map((g, i) => {
        const on = current === g.id;
        const { Icon, line } = g;
        return (
          <Pressable
            key={g.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            role="radio"
            aria-checked={on}
            tabIndex={on || (current == null && i === 0) ? 0 : -1}
            className={`ob-goal ${on ? 'on' : ''}`}
            onPress={() => pick(g.id)}
            onKeyDown={(e: React.KeyboardEvent) => onKey(e, i)}
          >
            <span className="icon-tile ob-goal-ic" aria-hidden="true">
              <Icon size={18} />
            </span>
            <span className="ob-goal-words">
              <span className="ob-goal-text">{g.label}</span>
              {line ? <span className="ob-goal-line">{line}</span> : null}
            </span>
            {/* the check fades onto the chosen row (opacity only, §10) */}
            <motion.span className="ob-goal-check" initial={false} animate={{ opacity: on ? 1 : 0 }} transition={reduce ? { duration: 0 } : crossfade} aria-hidden="true">
              <Check size={18} />
            </motion.span>
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
  // a glide from outside is under way: the days it passes are not choices (a finger on the strip, or 900 ms, ends it)
  const glide = useRef<{ to: number; t: number } | null>(null);
  const endGlide = () => {
    if (glide.current) clearTimeout(glide.current.t);
    glide.current = null;
  };
  useEffect(() => endGlide, []);
  // a change from outside (a new goal brings its own default day, or the race warning's one-tap later date): glide there
  // without ticking, and without picking any day on the way (the one tap lands where it says)
  useEffect(() => {
    const i = idxOf(value);
    if (i !== cur.current) {
      cur.current = i;
      endGlide();
      glide.current = { to: i, t: window.setTimeout(endGlide, 900) };
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
      if (glide.current) {
        if (i === glide.current.to && Math.abs(el.scrollLeft - i * (ITEM + GAP)) < 2) endGlide();
        return;
      }
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
        onPointerDown={endGlide}
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
              onClick={() => scrollToIdx(i, true)}
            >
              {/* the name is the spoken words; the short visual ones are hidden from it (a11y-15) */}
              <span className="sr-only">{d ? `${fmtDate('long', d)}, ${weeksUntil(start, d)} weeks away` : 'No race date yet'}</span>
              {d ? (
                <>
                  <span className="caps" aria-hidden="true">{fmtDate('monthShort', d)}</span>
                  <span className="ob-num ob-race-num" aria-hidden="true">{Number(d.slice(8))}</span>
                  <span className="ob-race-wk" aria-hidden="true">{weeksUntil(start, d)} wk</span>
                </>
              ) : (
                <>
                  <span className="caps" aria-hidden="true">No</span>
                  <span className="ob-race-none" aria-hidden="true">date</span>
                  <span className="ob-race-wk" aria-hidden="true">yet</span>
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
export const DayLetters = ({ runDays, longRunDay, onChange, hint = true }: { runDays: Weekday[]; longRunDay: Weekday; onChange: (runDays: Weekday[], longRunDay: Weekday) => void; /** The how-to line under the days (off where the screen's own subtitle says it). */ hint?: boolean }) => {
  const reduce = useReducedMotion();
  const dayEls = useRef(new Map<Weekday, HTMLElement>());
  const toggle = (d: Weekday) => {
    const on = runDays.includes(d);
    if (on && runDays.length === 1) {
      // one run day is the least a plan can hold: the letter shakes no (the `translate` property, so the press scale on
      // `transform` is untouched)
      haptics.error();
      if (!reduce) dayEls.current.get(d)?.animate({ translate: ['0px', '-5px', '5px', '-3px', '0px'] }, { duration: 300, easing: 'ease-out' });
      return;
    }
    haptics.select();
    const next = sortDays(on ? runDays.filter((x) => x !== d) : [...runDays, d]);
    onChange(next, fixLongRun(next, longRunDay));
  };
  const makeLong = (d: Weekday, held = false) => {
    if (d === longRunDay) return;
    // a hold already answered with its lift
    if (!held) haptics.select();
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
              onPress={() => toggle(d)}
              ref={(el: HTMLElement | null) => void (el ? dayEls.current.set(d, el) : dayEls.current.delete(d))}
              onHold={() => makeLong(d, true)}
            >
              <span className="sr-only">{`${DAY_NAME[d]}, ${long ? 'long run' : on ? 'run day' : 'rest day'}`}</span>
              <span className="ob-day-disc" aria-hidden="true">
                {DAY_LETTER[d]}
              </span>
              <span className="ob-day-cap" aria-hidden="true">
                {long ? 'Long' : ''}
              </span>
            </Pressable>
          );
        })}
      </div>
      {/* the long run is said once, by LONG under its day; this moves it to the next run day without a hold (plan S4) */}
      {runDays.length > 1 ? (
        <p className="ob-long">
          <Pressable className="ob-long-btn" onPress={cycle} label={`Change long run. Now ${DAY_NAME[longRunDay]}. Moves it to the next run day`}>
            Change long run
          </Pressable>
        </p>
      ) : null}
      {hint ? <p className="ob-long-hint">Tap a day to run on it. Hold a run day to make it the long run.</p> : null}
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
  /** The big number. */
  format?: (v: number) => string;
  unit: string;
  /** VoiceOver: "18 miles a week". */
  valueText?: (v: number) => string;
  label: string;
  /** Pixels of drag per step. */
  scrubPx?: number;
}
/**
 * One big number between two round buttons. Drag across the number to scrub (a tick per step), hold a button to
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
        <span className="ob-num ob-miles-val">{format(value)}</span>
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
 * color, then the shower and getting ready. Each marker is a slider for the keyboard (arrows 5 min, Page keys 30).
 */
export const MorningTrack = ({ wake, leave, onChange, run = { type: 'Easy', miles: 4 }, settings }: { wake: number; leave: number; onChange: (wake: number, leave: number) => void; run?: { type: string; miles: number }; settings?: MorningSettings | null }) => {
  const track = useRef<HTMLDivElement>(null);
  // a drag that starts on a marker moves it at once; a press on the line moves the nearer marker only when it lifts
  // within 8 px of where it went down (a tap), so a vertical drag from the line scrolls the page instead (onboarding-06)
  const drag = useRef<{ id: number; which: 'wake' | 'leave'; tap?: { x: number; y: number } } | null>(null);
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
    if (target) {
      drag.current = { id: e.pointerId, which: target };
      setActive(target);
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }
    // on the line: nothing moves yet, and the page keeps the gesture (touch-action: pan-y on the track)
    drag.current = { id: e.pointerId, which: Math.abs(m - vals.current.wake) <= Math.abs(m - vals.current.leave) ? 'wake' : 'leave', tap: { x: e.clientX, y: e.clientY } };
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    if (d.tap) {
      if (Math.hypot(e.clientX - d.tap.x, e.clientY - d.tap.y) > 8) drag.current = null;
      return;
    }
    setVal(d.which, minutesAt(e.clientX));
  };
  const onUp = (e: React.PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    setActive(null);
    if (d?.tap && e.type === 'pointerup' && d.id === e.pointerId && Math.hypot(e.clientX - d.tap.x, e.clientY - d.tap.y) <= 8) setVal(d.which, minutesAt(e.clientX));
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
          <span className="ob-num ob-track-v">{hm(wake)}</span>
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
          <span className="ob-num ob-track-v">{hm(leave)}</span>
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
  const full = selected.length >= HABIT_LIMIT;
  const toggle = (h: string) => {
    const on = selected.includes(h);
    if (!on && full) return;
    haptics.select();
    onChange(on ? selected.filter((x) => x !== h) : [...selected, h], custom);
  };
  const add = () => {
    const next = addHabit(selected, custom, text);
    setText('');
    // nothing typed, or the list is full: the field closes (at the limit the line under the chips says why)
    if (next.selected === selected || next.selected.length >= HABIT_LIMIT) setAdding(false);
    if (next.selected === selected) return;
    haptics.select();
    onChange(next.selected, next.custom);
  };
  return (
    <div className="ob-habits">
      <div className="ob-chips" role="group" aria-label="Starter habits">
        {all.map((h) => {
          const on = selected.includes(h);
          return (
            <Pressable key={h} className={`ob-chip ${on ? 'on' : ''}`} aria-pressed={on} disabled={!on && full} onPress={() => toggle(h)}>
              {on ? <Check size={16} aria-hidden="true" /> : null}
              <span className="ob-chip-label">{h}</span>
            </Pressable>
          );
        })}
        {adding && !full ? (
          <form
            className="ob-chip-form"
            onSubmit={(e) => {
              e.preventDefault();
              add();
            }}
          >
            <input className="ob-chip-in" autoFocus value={text} maxLength={HABIT_NAME_MAX} placeholder="Your own" aria-label="Your own habit" enterKeyHint="done" onChange={(e) => setText(e.target.value)} onBlur={add} />
          </form>
        ) : (
          <Pressable className="ob-chip add" disabled={full} onPress={() => setAdding(true)}>
            <Plus size={16} aria-hidden="true" />
            Your own
          </Pressable>
        )}
      </div>
      {/* the picked chips as the coins they become on Today, under the chips so none moves under the finger; nothing
          until one is picked (plan O6) */}
      <div className="ob-orbs" aria-hidden="true">
        <AnimatePresence initial={false}>
          {selected.slice(0, 6).map((h) => (
            <motion.span key={h} className="ob-orb" layout={!reduce} initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6 }} transition={reduce ? { duration: 0.15 } : springs.settle}>
              <span className="ob-orb-ring">
                <span className="ob-orb-initial">{h.charAt(0).toUpperCase()}</span>
              </span>
              <span className="ob-orb-name">{h}</span>
            </motion.span>
          ))}
        </AnimatePresence>
        {selected.length > 6 ? <span className="ob-orb-more">+{selected.length - 6}</span> : null}
      </div>
      {full ? (
        <p className="ob-hint ob-habits-limit" role="status">
          {HABIT_LIMIT} habits is the limit for now.
        </p>
      ) : null}
    </div>
  );
};
