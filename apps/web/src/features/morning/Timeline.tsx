import { buildMorning, clockOfDay, durationWords, num, clock, pad, type MorningTimeline, type TimelineBlock } from '@logbook/shared';
import { AlarmClock, Backpack, Coffee, DoorOpen, Dumbbell, Footprints, GripHorizontal, Moon, Pencil, ShowerHead, Shirt, SkipForward, SlidersHorizontal, Undo2 } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { haptics } from '@/lib/haptics';
import { springs } from '@/lib/motion';
import { useHoldDrag } from '@/lib/useDrag';
import { ContextMenu, useContextMenu, type ContextMenuItem } from '@/ui';
import { blockLabel, clamp, markTaught, short, wasTaught, type DayPatch } from './model';

/** What the page lets a block do (the long-press menu, a tap). Built by MorningView, which owns the sheets and toasts. */
export interface BlockActions {
  /** Edit this day: mode, type, miles or minutes, alarm. */
  editDay: () => void;
  /** The routine editor, optionally opened on one block. */
  editRoutine: (focus?: string) => void;
  /** "Skip Easy 5": the planned session's label, when there is one to skip. */
  skipLabel: string | null;
  skip: () => void;
  rest: () => void;
  /** "Back to Easy 5": shown on a rest morning the athlete made out of a planned session. */
  backLabel: string | null;
  backToPlan: () => void;
  /** Apply a patch to the day (a drag released, an arrow key). One write. */
  setDay: (patch: DayPatch) => void;
}

export const WAKE_MIN = 240;
export const WAKE_MAX = 720;
const WAKE_STEP = 5;
const MILES_STEP = 0.5;
const MIN_STEP = 5;
/** Room above the first block for the wake grip, which straddles its top edge. */
const TOP = 18;
const BOTTOM = 6;
/** The smallest thing a thumb should have to hit. */
const TARGET = 44;
/** A rest morning's free stretch longer than this is drawn no taller than REST_CAP, with an axis break. */
const REST_SQUEEZE_MIN = 45;
const REST_CAP = 120;

const ICON: Partial<Record<TimelineBlock['key'], typeof AlarmClock>> = { wake: AlarmClock, run: Footprints, gym: Dumbbell, shower: ShowerHead, ready: Shirt, smoothie: Coffee, prep: Backpack };
const tickLabel = (t: number) => `${Math.floor(t / 60) % 12 || 12}:${pad(t % 60)}`;
const sizeClass = (h: number) => (h < 26 ? 'xs' : h < 44 ? 'sm' : h < 66 ? 'md' : 'lg');

/**
 * The morning you can take hold of, drawn to scale: a 48px time axis and the blocks at `px` pixels a minute, positioned by
 * the clock, so free time is empty space with its length written in it.
 *
 * - The wake block carries a grip on its top edge: drag it (or hold the block and drag) in 5-minute steps, one
 *   `haptics.select()` a step; everything below recomputes live and the day is written once, on release. Arrow keys on the
 *   focused block do the same. A hold on the wake block that does not move opens its menu.
 * - The run or gym block carries a grip on its bottom edge: half-miles for a run (the pace turns them into minutes), five
 *   minutes for the gym. A role="slider" with Arrow keys.
 * - A long-press on any block opens its menu: Edit, Skip, Make this a rest day, Edit routine. A tap edits.
 * - On today, the blue now line with its pulsing dot; blocks already behind it sit back.
 *
 * `interactive=false` draws the same thing inert (the date pager's neighbours).
 */
export const Timeline = ({ T, px, isToday, now, interactive, actions, footer }: { T: MorningTimeline; px: number; isToday: boolean; now: number; interactive: boolean; actions?: BlockActions; footer?: (live: MorningTimeline) => ReactNode }) => {
  const reduce = useReducedMotion();
  const menu = useContextMenu();
  const [draft, setDraft] = useState<DayPatch | null>(null);
  // a released drag stays drawn until the day it wrote comes back, so the morning never flicks to the old times
  const [held, setHeld] = useState<DayPatch | null>(null);
  const [live, setLive] = useState<'wake' | 'size' | null>(null);
  const draftRef = useRef<DayPatch | null>(null);
  const armedRef = useRef(false);
  const wakeEl = useRef<HTMLDivElement | null>(null);
  const patch = draft ?? held;
  const TT = useMemo(() => (patch ? buildMorning({ ...T.day, ...patch }, T.settings) : T), [T, patch]);

  useEffect(() => {
    if (!held) return;
    const done = (Object.keys(held) as Array<keyof DayPatch>).every((k) => T.day[k] === held[k]);
    if (done) return setHeld(null);
    const t = setTimeout(() => setHeld(null), 2500);
    return () => clearTimeout(t);
  }, [T, held]);

  const commit = (p: DayPatch) => {
    setHeld(p);
    actions?.setDay(p);
  };
  const tick = (next: DayPatch) => {
    const cur = draftRef.current ?? {};
    const changed = (Object.keys(next) as Array<keyof DayPatch>).some((k) => cur[k] !== next[k]);
    if (!changed) return;
    haptics.select();
    // the ref leads the render, so a release right after the last step commits that step, not the one before
    draftRef.current = next;
    setDraft(next);
  };
  const finish = (apply: boolean) => {
    const d = draftRef.current;
    setLive(null);
    draftRef.current = null;
    setDraft(null);
    if (!apply || !d) return;
    const moved = (d.wake != null && d.wake !== T.day.wake) || (d.miles != null && d.miles !== T.day.miles) || (d.minutes != null && d.minutes !== T.day.minutes);
    if (moved) commit(d);
  };
  const begin = (kind: 'wake' | 'size') => {
    const start: DayPatch = kind === 'wake' ? { wake: T.day.wake } : T.day.mode === 'run' ? { miles: T.day.miles } : { minutes: T.day.minutes };
    draftRef.current = start;
    setDraft(start);
    setLive(kind);
  };

  // ---------- the wake: a grip (drags at once) and the block itself (hold, then drag) ----------
  const wakeOf = (dy: number) => clamp(T.day.wake + Math.round(dy / px / WAKE_STEP) * WAKE_STEP, WAKE_MIN, WAKE_MAX);
  const wakeGrip = useHoldDrag<HTMLSpanElement>({
    holdMs: 0,
    disabled: !interactive,
    onArm: () => {
      armedRef.current = false;
      begin('wake');
    },
    onMove: (p) => tick({ wake: wakeOf(p.dy) }),
    // the release point is the last word: a final move can be coalesced away before the up
    onDrop: (p) => {
      tick({ wake: wakeOf(p.dy) });
      finish(true);
    },
    onCancel: () => finish(false),
  });
  const wakeHold = useHoldDrag<HTMLDivElement>({
    disabled: !interactive,
    onArm: () => {
      armedRef.current = true;
      haptics.lift();
      begin('wake');
    },
    onMove: (p) => tick({ wake: wakeOf(p.dy) }),
    onDrop: (p) => {
      tick({ wake: wakeOf(p.dy) });
      haptics.drop();
      finish(true);
    },
    onCancel: (phase, reason) => {
      finish(false);
      // held and let go where it was: that is a long-press, so the block's menu (the lift haptic already played)
      if (reason === 'up' && phase === 'armed' && wakeEl.current) openMenu(wakeEl.current, TT.blocks[0]!, false);
    },
  });

  // ---------- the session's bottom edge ----------
  const run = T.day.mode === 'run';
  const sizeOf = (dy: number): DayPatch => {
    const mins = dy / px;
    return run ? { miles: clamp(Math.round((T.day.miles + (mins * 60) / T.settings.run.pace) / MILES_STEP) * MILES_STEP, 0.5, 30) } : { minutes: clamp(Math.round((T.day.minutes + mins) / MIN_STEP) * MIN_STEP, 5, 240) };
  };
  const sizeGrip = useHoldDrag<HTMLSpanElement>({
    holdMs: 0,
    disabled: !interactive,
    onArm: () => begin('size'),
    onMove: (p) => tick(sizeOf(p.dy)),
    onDrop: (p) => {
      tick(sizeOf(p.dy));
      finish(true);
    },
    onCancel: () => finish(false),
  });
  const stepKey = (e: React.KeyboardEvent, apply: (dir: 1 | -1) => void) => {
    const dir = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 0;
    if (!dir) return false;
    e.preventDefault();
    e.stopPropagation();
    haptics.select();
    apply(dir);
    return true;
  };

  // ---------- the first visit: the wake grip nudges once ----------
  const [teach, setTeach] = useState(false);
  useEffect(() => {
    if (!interactive || wasTaught()) return;
    markTaught();
    setTeach(true);
    const t = setTimeout(() => setTeach(false), 4200);
    return () => clearTimeout(t);
  }, [interactive]);
  useEffect(() => {
    if (live) setTeach(false);
  }, [live]);

  // ---------- menus ----------
  const itemsFor = (b: TimelineBlock): ContextMenuItem[] => {
    if (!actions) return [];
    const main = b.key === 'run' || b.key === 'gym';
    const day = b.key === 'wake' || main;
    const items: ContextMenuItem[] = [{ label: day ? 'Edit' : `Edit ${blockLabel(b).toLowerCase()}`, icon: <Pencil size={18} />, onSelect: day ? actions.editDay : () => actions.editRoutine(b.key === 'buffer' ? 'buffer' : b.key) }];
    // a neighbour too short to hold on its own lends its Edit to this block's menu
    for (const n of tinyNeighbours(b)) items.push({ label: `Edit ${blockLabel(n).toLowerCase()}`, icon: <Pencil size={18} />, onSelect: () => actions.editRoutine(n.key === 'buffer' ? 'buffer' : n.key) });
    if (actions.skipLabel) items.push({ label: `Skip ${actions.skipLabel}`, icon: <SkipForward size={18} />, onSelect: actions.skip });
    if (TT.day.mode !== 'rest') items.push({ label: 'Make this a rest day', icon: <Moon size={18} />, onSelect: actions.rest });
    else if (actions.backLabel) items.push({ label: `Back to ${actions.backLabel}`, icon: <Undo2 size={18} />, onSelect: actions.backToPlan });
    items.push({ label: 'Edit routine', icon: <SlidersHorizontal size={18} />, onSelect: () => actions.editRoutine() });
    return items;
  };
  const nameOf = (b: TimelineBlock) => (b.key === 'run' ? `${TT.day.type} run` : b.key === 'gym' ? TT.day.type : blockLabel(b));
  const openMenu = (el: HTMLElement, b: TimelineBlock, haptic = true) => menu.open({ items: itemsFor(b), anchor: el, label: `${nameOf(b)} actions`, haptic });
  const tap = (b: TimelineBlock) => {
    if (!actions) return;
    if (b.key === 'wake' || b.key === 'run' || b.key === 'gym') actions.editDay();
    else if (b.key !== 'free') actions.editRoutine(b.key);
  };

  // ---------- layout: by the clock ----------
  const origin = Math.min(T.settings.wake, T.day.wake);
  // A rest morning's long stretch of free time is drawn at most REST_CAP tall, with a break on the axis: the clock still
  // places every block, the empty hour just stops pushing the routine off the screen.
  const squeeze = TT.day.mode === 'rest' ? TT.blocks.filter((b) => b.key === 'free' && b.mins > REST_SQUEEZE_MIN && b.mins * px > REST_CAP).map((b) => ({ s: b.start, e: b.end, saved: b.mins * px - REST_CAP })) : [];
  const y = (t: number) => {
    let v = TOP + (t - origin) * px;
    for (const c of squeeze) {
      if (t >= c.e) v -= c.saved;
      else if (t > c.s) v -= ((t - c.s) / (c.e - c.s)) * c.saved;
    }
    return v;
  };
  const inSqueeze = (t: number) => squeeze.some((c) => t > c.s && t < c.e);
  const height = y(TT.leave) + BOTTOM;
  const wakeY = y(TT.day.wake);
  const showNow = isToday && now >= TT.day.wake && now <= TT.leave;
  const nowY = showNow ? y(now) : null;
  const ticks: number[] = [];
  for (let t = Math.ceil(origin / 30) * 30; t < TT.leave; t += 30) {
    const ty = y(t);
    if (inSqueeze(t) || Math.abs(ty - wakeY) < 24 || (nowY != null && Math.abs(ty - nowY) < 16) || height - ty < 20) continue;
    ticks.push(t);
  }

  // Short blocks (Out the door, Cool down, a 5-minute routine block) keep their true height but get a 44px target: an
  // invisible slop above and below, taken from free time or from a neighbour's spare height (never from a grip's edge).
  const geo = TT.blocks.map((b) => ({ b, h: Math.max(2, y(b.end) - y(b.start) - 2) }));
  const tiny = (j: number) => !!geo[j] && geo[j]!.b.key !== 'free' && geo[j]!.h < TARGET;
  const spare = (i: number, side: -1 | 1) => {
    const j = i + side;
    const n = geo[j];
    if (!n) return 0;
    if (n.b.key === 'free') return n.h / 2;
    if (n.h < TARGET) return 0;
    // the run/gym block's grip sits on its bottom edge, the wake's on its top: those edges are not lent
    if (side < 0 && (n.b.key === 'run' || n.b.key === 'gym')) return 0;
    // a neighbour keeps 44px itself, and splits what is left when a short block sits on its other side too
    return (n.h - TARGET) / (tiny(j + side) ? 2 : 1);
  };
  const slop = geo.map(({ h }, i) => {
    // +2: the hairline gap between blocks belongs to nobody
    const need = h < TARGET ? TARGET + 2 - h : 0;
    if (!need) return { up: 0, down: 0, h };
    const a = spare(i, -1);
    const z = spare(i, 1);
    let up = Math.min(a, need / 2);
    const down = Math.min(z, need - up);
    up = Math.min(a, need - down);
    return { up, down, h: h + up + down };
  });
  /** The neighbours of `b` that are still under 44px with their slop: their Edit joins `b`'s menu. */
  function tinyNeighbours(b: TimelineBlock): TimelineBlock[] {
    const i = TT.blocks.indexOf(b);
    return [i - 1, i + 1].filter((j) => j >= 0 && j < geo.length && geo[j]!.b.key !== 'free' && geo[j]!.b.key !== 'wake' && slop[j]!.h < TARGET).map((j) => geo[j]!.b);
  }
  const slept = TT.day.wake - origin;
  const tr = reduce ? { duration: 0 } : springs.settle;

  const blocks: ReactNode[] = TT.blocks.map((b, i) => {
    const top = y(b.start) + 1;
    const h = geo[i]!.h;
    const sl = slop[i]!;
    const past = isToday && b.end <= now && !live;
    const sz = sizeClass(h);
    const range = `${short(b.start)}–${short(b.end)}`;
    const key = `${b.key}-${b.key === 'buffer' ? i : ''}`;
    if (b.key === 'free') {
      const squeezed = squeeze.some((c) => c.s === b.start);
      const restMorning = TT.day.mode === 'rest' && (squeezed || h >= 120);
      return (
        <motion.div key={key} className={`tl-free ${restMorning ? 'is-rest' : ''} ${squeezed ? 'is-squeezed' : ''} ${past ? 'past' : ''}`} initial={false} animate={{ y: top, height: h }} transition={tr} aria-label={`${durationWords(b.mins)} free, ${clockOfDay(b.start)} to ${clockOfDay(b.end)}`} role="note">
          {restMorning ? (
            <div className="tl-rest">
              <span className="tl-rest-glow" aria-hidden="true" />
              <span className="display tl-rest-word">Rest.</span>
              <span className="tl-rest-line">
                {durationWords(b.mins)} to yourself before the routine.{!squeezed && interactive && !(isToday && now > TT.day.wake) ? ' Sleep in: drag the alarm down.' : ''}
              </span>
            </div>
          ) : h >= 16 ? (
            <span className="tl-free-label">{durationWords(b.mins)} free</span>
          ) : null}
        </motion.div>
      );
    }
    const main = b.key === 'run' || b.key === 'gym';
    const wake = b.key === 'wake';
    const Icon = b.key === 'buffer' ? (b.label.startsWith('Walk') ? Footprints : DoorOpen) : ICON[b.key];
    const lifted = wake && live === 'wake' && armedRef.current;
    const sizing = main && live === 'size';
    const stamp = main ? (b.key === 'run' ? ([num(TT.day.miles), 'mi'] as const) : ([String(TT.day.minutes), 'min'] as const)) : null;
    const name = nameOf(b);
    const planned = TT.day.own && TT.day.plan.mode === TT.day.mode ? (b.key === 'run' ? (TT.day.plan.miles !== TT.day.miles ? `plan ${num(TT.day.plan.miles)} mi` : '') : TT.day.plan.minutes && TT.day.plan.minutes !== TT.day.minutes ? `plan ${TT.day.plan.minutes} min` : '') : '';
    const sub = b.key === 'run' ? [durationWords(b.mins), `${clock(T.settings.run.pace)}/mi`, planned].filter(Boolean).join(' · ') : b.key === 'gym' ? planned : wake && TT.day.mode === 'rest' ? 'Rest morning' : '';
    const said = `${name}, ${clockOfDay(b.start)} to ${clockOfDay(b.end)}, ${durationWords(b.mins)}`;
    const cls = `tl-block k-${b.key} sz-${sz} ${main ? 'lit' : ''} ${b.tone ? `t-${b.tone}` : ''} ${past ? 'past' : ''} ${lifted ? 'is-lifted' : ''} ${sizing ? 'is-sizing' : ''} ${wake && live === 'wake' ? 'is-live' : ''}`;
    const body = (
      <>
        {main ? <span className="tl-halo" aria-hidden="true" /> : null}
        {Icon && sz !== 'xs' ? <Icon className="tl-icon" size={sz === 'sm' ? 16 : 18} aria-hidden="true" /> : null}
        <div className="tl-main">
          <span className="tl-label">{name}</span>
          {sub && sz === 'lg' ? <span className="caps tl-sub">{sub}</span> : null}
        </div>
        {stamp ? (
          <span className="tl-side">
            <span className="stamp tl-stamp">
              {stamp[0]}
              <small>{stamp[1]}</small>
            </span>
            {sz === 'lg' ? <span className="tl-range caps">{range}</span> : null}
          </span>
        ) : wake && sz !== 'xs' ? (
          <span className="tl-side">
            <span className="stamp tl-stamp tl-alarm">{short(TT.day.wake)}</span>
          </span>
        ) : (
          <span className="tl-range caps">{range}</span>
        )}
      </>
    );
    if (!interactive) {
      return (
        <motion.div key={key} className={cls} initial={false} animate={{ y: top, height: h }} transition={tr}>
          {body}
        </motion.div>
      );
    }
    if (wake) {
      return (
        <div key={key} className="cm-target">
        <motion.div
          ref={(el: HTMLDivElement | null) => {
            wakeEl.current = el;
            wakeHold.ref.current = el;
          }}
          className={cls}
          initial={false}
          animate={{ y: top, height: h, scale: lifted && !reduce ? 1.03 : 1 }}
          transition={tr}
          {...wakeHold.bind}
          onClick={() => {
            if (armedRef.current || wakeHold.consumeClick()) return void (armedRef.current = false);
            tap(b);
          }}
          tabIndex={0}
          role="slider"
          aria-label={`Wake-up time. Drag the grip, or use the arrow keys, to move it five minutes. Enter edits the day.`}
          aria-valuemin={WAKE_MIN}
          aria-valuemax={WAKE_MAX}
          aria-valuenow={TT.day.wake}
          aria-valuetext={clockOfDay(TT.day.wake)}
          onKeyDown={(e) => {
            if (stepKey(e, (dir) => commit({ wake: clamp(T.day.wake + dir * WAKE_STEP, WAKE_MIN, WAKE_MAX) }))) return;
            if (e.key === 'Enter') tap(b);
            else if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) {
              e.preventDefault();
              openMenu(e.currentTarget, b);
            }
          }}
        >
          {body}
          <motion.span
            ref={wakeGrip.ref}
            className={`tl-grip top ${teach ? 'is-teaching' : ''}`}
            aria-hidden="true"
            {...wakeGrip.bind}
            onPointerDown={(e) => {
              e.stopPropagation();
              wakeGrip.bind.onPointerDown(e);
            }}
            onClick={(e) => e.stopPropagation()}
            animate={teach && !reduce ? { y: [0, 12, 0, 8, 0] } : { y: 0 }}
            transition={teach && !reduce ? { duration: 1.4, delay: 0.5, ease: 'easeOut' } : springs.settle}
          >
            <GripHorizontal size={16} />
          </motion.span>
          {live === 'wake' ? (
            <span className="tl-bubble top" aria-hidden="true">
              <span className="stamp">{short(TT.day.wake)}</span>
              <span className="caps">{TT.day.wake === T.day.wake ? 'alarm' : `${TT.day.wake > T.day.wake ? '+' : '−'}${Math.abs(TT.day.wake - T.day.wake)} min`}</span>
            </span>
          ) : teach ? (
            <span className="tl-hint" aria-hidden="true">
              Drag the alarm
            </span>
          ) : null}
        </motion.div>
          <button type="button" className="cm-sr" aria-haspopup="menu" onClick={(e) => openMenu(e.currentTarget, b)}>
            Wake up actions
          </button>
        </div>
      );
    }
    return (
      <ContextMenu key={key} items={itemsFor(b)} label={name}>
        <motion.div
          className={`${cls} ${sl.up || sl.down ? 'has-slop' : ''}`}
          initial={false}
          animate={{ y: top, height: h }}
          transition={tr}
          role={main ? 'group' : 'button'}
          tabIndex={main ? undefined : 0}
          aria-label={main ? `${said}. Hold for actions.` : `${said}. Edit in the routine.`}
          onClick={() => tap(b)}
          onKeyDown={main ? undefined : (e) => (e.key === 'Enter' || e.key === ' ' ? (e.preventDefault(), tap(b)) : undefined)}
        >
          {sl.up || sl.down ? <span className="tl-hit" aria-hidden="true" style={{ top: -sl.up, bottom: -sl.down }} /> : null}
          {body}
          {main ? (
            <span
              ref={sizeGrip.ref}
              className="tl-grip bottom"
              {...sizeGrip.bind}
              onPointerDown={(e) => {
                e.stopPropagation();
                sizeGrip.bind.onPointerDown(e);
              }}
              onClick={(e) => e.stopPropagation()}
              tabIndex={0}
              role="slider"
              aria-label={run ? 'Miles. Drag the edge, or use the arrow keys, to change it by half a mile' : 'Minutes. Drag the edge, or use the arrow keys, to change it by five'}
              aria-valuemin={run ? 0.5 : 5}
              aria-valuemax={run ? 30 : 240}
              aria-valuenow={run ? TT.day.miles : TT.day.minutes}
              aria-valuetext={run ? `${num(TT.day.miles)} mi` : `${TT.day.minutes} min`}
              onKeyDown={(e) => void stepKey(e, (dir) => commit(run ? { miles: clamp(T.day.miles + dir * MILES_STEP, 0.5, 30) } : { minutes: clamp(T.day.minutes + dir * MIN_STEP, 5, 240) }))}
            >
              <GripHorizontal size={16} aria-hidden="true" />
            </span>
          ) : null}
          {sizing ? (
            <span className="tl-bubble bottom" aria-hidden="true">
              <span className="stamp">
                {stamp?.[0]}
                <small>{stamp?.[1]}</small>
              </span>
              <span className="caps">back {short(TT.back)}</span>
            </span>
          ) : null}
        </motion.div>
      </ContextMenu>
    );
  });

  return (
    <>
    <div className={`tl ${live ? 'is-live' : ''} ${interactive ? '' : 'is-static'}`} style={{ height }} aria-label="Timeline" role="region">
      <div className="tl-axis" aria-hidden="true">
        {ticks.map((t) => (
          <motion.span key={t} className="tl-tick caps" initial={false} animate={{ y: y(t) - 7 }} transition={tr}>
            {tickLabel(t)}
          </motion.span>
        ))}
        {squeeze.map((c) => (
          <motion.span key={`break-${c.s}`} className="tl-break" initial={false} animate={{ y: y((c.s + c.e) / 2) - 6 }} transition={tr} />
        ))}
        <motion.span className="tl-tick tl-tick-wake" initial={false} animate={{ y: wakeY - 8 }} transition={tr}>
          {short(TT.day.wake)}
        </motion.span>
        {nowY != null ? (
          <span className="tl-tick tl-tick-now" style={{ transform: `translateY(${nowY - 7}px)` }}>
            {short(now)}
          </span>
        ) : null}
      </div>
      <div className="tl-blocks">
        {slept >= 5 ? (
          <motion.div className="tl-sleep" initial={false} animate={{ y: TOP, height: Math.max(0, slept * px - 2) }} transition={tr} role="note" aria-label={`${durationWords(slept)} more sleep than your usual ${clockOfDay(origin)} alarm`}>
            {slept * px >= 16 ? (
              <span>
                <Moon size={14} aria-hidden="true" /> +{durationWords(slept)} sleep
              </span>
            ) : null}
          </motion.div>
        ) : null}
        {blocks}
      </div>
      {nowY != null ? (
        <div className="tl-now" style={{ transform: `translateY(${nowY - 6}px)` }} role="img" aria-label={`Now, ${clockOfDay(now)}`}>
          <i className="now-pulse" />
        </div>
      ) : null}
    </div>
    {footer?.(TT)}
    </>
  );
};

