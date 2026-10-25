import { clockOfDay, num, type MorningTimeline, type RoutineKey } from '@logbook/shared';
import { AlarmClock, Backpack, BookOpen, CircleAlert, CircleCheck, CircleDot, Coffee, Dog, Dumbbell, Flower2, Footprints, Moon, Pencil, PersonStanding, Sandwich, ShowerHead, Shirt, SkipForward, Trash2, Undo2, UtensilsCrossed, type LucideIcon } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import type * as React from 'react';
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { haptics } from '@/lib/haptics';
import { fadeIn, useReduced } from '@/lib/motion';
import { ChipButton, Pressable, type ContextMenuItem, type DragPoint } from '@/ui';
import { AlarmHandle, type AlarmHandleProps } from './AlarmHandle';
import { drawnY, flipY, stopFlip } from './flip';
import { LeaveRow } from './LeaveRow';
import { short, timeState, whenSettled, type SchedRow } from './model';

/** The late note's three fixes (spec §4.1): the alarm is the morning's, the miles and the skip are the session's. */
export interface LateFixes {
  /** `{ wake }` for this date (null once the morning's workout is done: an earlier alarm changes nothing then, N7). */
  wake: ((wake: number) => void) | null;
  /** A session upsert with these miles (null when the day has no run session). */
  miles: ((miles: number) => void) | null;
  /** The run session marked 'skip' (null when there is none). */
  skipRun: (() => void) | null;
}

/** What the schedule's rows open and change. MorningView builds it; it owns the sheets, the writes and the toasts. */
export interface ScheduleActions {
  /** The alarm sheet (the drag's fallback). */
  editWake: () => void;
  /** The workout: the session sheet (the session is the run, spec §4.3); the alarm sheet on a morning with none. */
  editDay: () => void;
  /** When the back-home routine starts. */
  editStart: () => void;
  /** The step's sheet; `keep` keeps focus on the page if its Remove takes the row away (code review 2 N5). */
  editStep: (k: RoutineKey, keep?: () => void) => void;
  addStep: () => void;
  removeStep: (k: RoutineKey) => void;
  /** The routine's new order, the steps on the schedule only. One write. */
  saveOrder: (visible: RoutineKey[]) => void;
  /** The routine editor with its leave field focused. */
  editLeave: () => void;
  skipLabel: string | null;
  skip: () => void;
  /** Every open workout of the day skipped; null when none is open (the item would do nothing, code review 1 F4). */
  rest: (() => void) | null;
  backLabel: string | null;
  backToPlan: () => void;
  late: LateFixes;
}

const ICON: Record<string, LucideIcon> = { wake: AlarmClock, run: Footprints, gym: Dumbbell, free: Moon, late: CircleAlert, shower: ShowerHead, ready: Shirt, smoothie: Coffee, prep: Backpack };
/** A step of your own wears the icon its name suggests. */
const GUESS: Array<[RegExp, LucideIcon]> = [
  [/dog|pet/i, Dog],
  [/coffee|tea|smoothie|shake/i, Coffee],
  [/breakfast|eat|oats|egg/i, UtensilsCrossed],
  [/lunch|sandwich|meal/i, Sandwich],
  [/meditat|breath|yoga|pray/i, Flower2],
  [/stretch|mobility|foam|roll/i, PersonStanding],
  [/read|book|journal|write/i, BookOpen],
  [/walk|stroll/i, Footprints],
  [/shower|bath/i, ShowerHead],
  [/dress|clothes|outfit/i, Shirt],
  [/pack|bag/i, Backpack],
];
const noop = () => undefined;
const iconOf = (r: SchedRow): LucideIcon => ICON[r.icon] ?? GUESS.find(([re]) => re.test(r.name))?.[1] ?? CircleDot;

/** The 2 px line under the row that is under way: scaleX, 1 s linear a minute (the one clock-driven motion kept, §4.1). */
const Progress = ({ p }: { p: number }) => (
  <span className="sch-progress" aria-hidden="true">
    <i style={{ transform: `scaleX(${p.toFixed(4)})` }} />
  </span>
);

/**
 * The alarm drag's flash (§4.2): an accent copy of a stamp over it, lit while the alarm moves and fading out over 400 ms on
 * release. Opacity on its own layer, so the fade runs on the compositor even while the release's write re-renders the
 * pages under this one (a colour tween would freeze with the main thread). The text is CSS content: not in textContent.
 */
export const Flash = ({ t }: { t: string }) => <span className="sch-flash" aria-hidden="true" data-t={t} />;

/**
 * A sub with the part a narrow screen drops: the run row's pace (`4 mi · back 8:13` at 320: the time back is the news), and
 * Free's `· routine at 8:40` (the routine's first row says 8:40 in its time column; feel review 1 FL9).
 */
const subOf = (r: SchedRow): ReactNode => {
  const m = r.kind === 'work' ? /^(.+? mi)( · [^·]+\/mi)( · back .+)$/.exec(r.sub) : null;
  if (m)
    return (
      <>
        {m[1]}
        <span className="sub-pace">{m[2]}</span>
        {m[3]}
      </>
    );
  const f = r.kind === 'free' ? /^(.+?)( · routine at .+)$/.exec(r.sub) : null;
  if (f)
    return (
      <>
        {f[1]}
        <span className="sub-wide">{f[2]}</span>
      </>
    );
  return r.sub;
};

/**
 * One row type: time 48 · icon disc 32 · name and sub. Nothing on the right. `swap`: the row's content became another
 * thing in the same box (Skip on a two-session morning hands the slot to the lift): the icon and the words are keyed on it
 * and fade in over 150 ms (feel review 1 FL5), the box and the time stay.
 */
const RowBody = ({ r, time, moved, swap }: { r: SchedRow; time: ReactNode; moved?: boolean; swap?: { key: string; on: boolean } }) => {
  const Icon = iconOf(r);
  const sw = swap?.on ? ' is-swap' : '';
  return (
    <>
      {time == null ? (
        <span className="sch-time-slot" aria-hidden="true" />
      ) : (
        <span className={`sch-time ${moved ? 'is-moved' : ''}`}>
          {time}
          <Flash t={typeof time === 'string' ? time : ''} />
        </span>
      )}
      <span key={`i${swap?.key ?? ''}`} className={`sch-ico${sw}`} aria-hidden="true">
        <Icon size={18} />
      </span>
      <span key={`m${swap?.key ?? ''}`} className={`sch-main${sw}`}>
        <span className="sch-name">{r.name}</span>
        {r.sub ? <span className="sch-sub">{subOf(r)}</span> : null}
      </span>
    </>
  );
};

/**
 * The late note as one row under the run (spec §4.1): by how much, and the fixes as one-tap chips. The fixes are offered
 * while they can still change the morning (code review 3 N7): on today, until the time back (build plan §4.4 #9 keeps all
 * three at 08:40 on the run, back 8:58); the miles and the skip only for a run still to do (MorningView passes neither for a
 * run Strava has matched or one marked). `held`: an alarm drag's finger is down (the row set is kept,
 * FL1), and the row keeps the height it had when the drag began, whatever it says meanwhile (feel review 3 R3-1).
 */
const LateBody = ({ T, fix, interactive, now, rel, held }: { T: MorningTimeline; fix?: LateFixes; interactive: boolean; now: number; rel: ScheduleProps['rel']; held: boolean }) => {
  const box = useRef<HTMLDivElement>(null);
  const hold = useRef<number | null>(null);
  // read in the render that starts the hold: the DOM is still the last commit's, the note as the drag found it. One read a
  // drag (the page has just laid out for the pointer move); released, the row lays out as itself again
  if (!held) hold.current = null;
  else if (hold.current == null && box.current) hold.current = box.current.offsetHeight;
  const style = hold.current != null ? { minHeight: hold.current } : undefined;
  // an alarm drag that began late and has come back in time keeps the row (the row set holds under the finger, FL1): it says
  // so, neutral (feel review 2 R2-3), its one line in the middle of the height it holds
  if (!T.late || !T.fix)
    return (
      <div ref={box} className="sch-hit late-hit is-clear" role="note" style={style}>
        <span className="sch-time-slot" aria-hidden="true" />
        <span className="sch-ico" aria-hidden="true">
          <CircleCheck size={18} />
        </span>
        <span className="sch-main">
          <span className="sch-name late-text is-clear">Back {short(T.back)} · in time</span>
        </span>
      </div>
    );
  const miles = T.fix.maxMiles != null ? Math.floor(T.fix.maxMiles * 2) / 2 : null;
  const wake = Math.floor(T.fix.latestWake / 5) * 5;
  // back home (or a run already done): the morning is what it is, and the note says so without offering to change it
  const live = interactive && !!fix && (rel !== 'today' || now < T.back);
  const chips = live
    ? [
        fix.wake ? <ChipButton key="w" onClick={() => fix.wake!(wake)}>Wake {short(wake)}</ChipButton> : null,
        miles != null && miles >= 0.5 && fix.miles ? <ChipButton key="m" onClick={() => fix.miles!(miles)}>Run {num(miles)} mi</ChipButton> : null,
        fix.skipRun ? <ChipButton key="s" onClick={fix.skipRun}>Skip the run</ChipButton> : null,
      ].filter(Boolean)
    : [];
  return (
    <div ref={box} className={`sch-hit late-hit${chips.length ? '' : ' is-quiet'}`} role="note" style={style}>
      <span className="sch-time-slot" aria-hidden="true" />
      <span className="sch-ico" aria-hidden="true">
        <CircleAlert size={18} />
      </span>
      <span className="sch-main">
        {/* one line at 390 (feel review 1 FL6): the time back and by how much; the chips under it */}
        <span className="sch-name late-text">
          Back {short(T.back)} · {T.late} min late
        </span>
      </span>
      {/* the fixes take the row's whole width under the note (from the time column), so three chips fit one line at 390 */}
      {chips.length ? <span className="late-fixes">{chips}</span> : null}
    </div>
  );
};

export interface ScheduleProps {
  T: MorningTimeline;
  rows: SchedRow[];
  rel: 'past' | 'today' | 'future';
  now: number;
  /** Row ids (and 'leave') whose stamps an alarm drag has moved: lit while it moves, fading back to ink on release. */
  moved: ReadonlySet<string>;
  /** Taps, holds and drags; absent on a past morning (read-only). */
  actions?: ScheduleActions;
  /** The alarm handle's callbacks (the Wake row's stamp). */
  wake: Pick<AlarmHandleProps, 'onStep' | 'onCommit' | 'onDragging'> & { dragging: boolean; /** An alarm drag (finger or arrow keys) is keeping the row set. */ held?: boolean };
}

/**
 * The morning as one inset group of 60 px rows (spec §4.1): Wake · the workout · the late note · Free · the routine · Leave.
 * A tap opens the thing tapped (the alarm sheet, the session sheet, the routine's start, the step); the Wake row's stamp is
 * the alarm handle. Hold a step 450 ms: it lifts with `Edit · Remove`; move after the hold and it follows the finger 1:1
 * while the others slide out of its way (one `select` a slot), and the release lands it (`drop`) with one save. Hold the
 * workout: `Skip Easy 4 · Make this a rest day · Edit`. Rows that come and go fade (100 ms out) and the rows below move on
 * `settle` by transform (the FLIP rule, §10.1), so a Skip, an alarm drag that brings the late note, and a reorder all move the
 * same way. The Leave row ends the group, sticky to the page's bottom.
 */
export const Schedule = ({ T, rows, rel, now, moved, actions, wake }: ScheduleProps): React.JSX.Element => {
  const reduce = useReduced();
  const isToday = rel === 'today';
  const interactive = !!actions;
  const list = useRef<HTMLOListElement>(null);

  // ---------- the routine's order: the server's, except under a finger and until the server has the dropped one ----------
  const stepRows = rows.filter((r) => r.kind === 'step');
  const sig = stepRows.map((r) => r.id).join('|');
  const [local, setLocal] = useState<string[] | null>(null);
  const localRef = useRef(local);
  localRef.current = local;
  const drag = useRef<{ id: string; grab: number; y: number; el: HTMLElement; from: string } | null>(null);
  // the server caught up with a dropped order (or nothing moved): its order again
  useEffect(() => {
    if (local && local.join('|') === sig && !drag.current) setLocal(null);
  }, [local, sig]);
  const order = local ?? stepRows.map((r) => r.id);
  const byId = new Map(stepRows.map((r) => [r.id, r]));
  let t = stepRows[0]?.start ?? T.leave;
  const ordered = order
    .map((id) => byId.get(id))
    .filter((r): r is SchedRow => !!r)
    .map((r) => {
      const start = t;
      const mins = r.end - r.start;
      t += mins;
      return start === r.start ? r : { ...r, at: start, start, end: start + mins };
    });
  // a step the server added while a local order was kept goes on the end
  for (const r of stepRows) if (!order.includes(r.id)) ordered.push(r);
  const shown = [...rows.filter((r) => r.kind !== 'step'), ...ordered];

  // ---------- the FLIP (§10.1): a row whose slot moved starts where it was drawn and springs home on `settle` ----------
  const tops = useRef(new Map<string, number>());
  const recording = useRef<(() => void) | null>(null);
  useEffect(() => () => recording.current?.(), []);
  /** The lifted step under the finger: its slot's top on the page against where the finger says it is (1:1, no spring). */
  const place = () => {
    const d = drag.current;
    const ol = list.current;
    if (!d || !ol) return;
    const y = d.y - d.grab - (ol.getBoundingClientRect().top + d.el.offsetTop);
    d.el.style.transform = `translateY(${y.toFixed(2)}px)`;
  };
  useLayoutEffect(() => {
    const ol = list.current;
    if (!ol) return;
    // the first render only records where the rows are, once the push has settled: reading offsetTop here would force the new
    // page's first layout inside the push's commit, and on the next frame it forced it inside the slide (feel review 1 FL4)
    if (!tops.current.size) {
      if (!recording.current)
        recording.current = whenSettled(() => {
          if (tops.current.size || !list.current) return;
          for (const li of list.current.querySelectorAll<HTMLElement>(':scope > li[data-row]')) tops.current.set(li.dataset.row!, li.offsetTop);
        });
      return;
    }
    const sc = ol.closest<HTMLElement>('.pushed');
    const scBottom = sc?.getBoundingClientRect().bottom ?? Infinity;
    const next = new Map<string, number>();
    for (const li of ol.querySelectorAll<HTMLElement>(':scope > li[data-row]')) {
      if (li.dataset.motionPopId) continue;
      const id = li.dataset.row!;
      const top = li.offsetTop;
      next.set(id, top);
      const prev = tops.current.get(id);
      if (prev == null || prev === top || drag.current?.id === id || reduce) continue;
      // the Leave row pinned to the page's bottom does not move when the rows above it do
      if (id === 'leave' && Math.abs(li.getBoundingClientRect().bottom - scBottom) < 1.5) continue;
      flipY(li, prev - top + drawnY(li));
    }
    tops.current = next;
    place();
  });

  // ---------- the reorder (after the hold) ----------
  const [said, setSaid] = useState('');
  const scroll = useRef({ raf: 0, v: 0 });
  const rowEl = (id: string) => list.current?.querySelector<HTMLElement>(`:scope > li[data-row="${CSS.escape(id)}"]`) ?? null;
  const reslot = () => {
    const d = drag.current;
    const ol = list.current;
    const cur = localRef.current;
    if (!d || !ol || !cur) return;
    const top = ol.getBoundingClientRect().top;
    const mid = d.y - d.grab + d.el.offsetHeight / 2;
    const others = cur.filter((k) => k !== d.id);
    let at = 0;
    for (const k of others) {
      const r = rowEl(k);
      if (r && top + r.offsetTop + r.offsetHeight / 2 < mid) at++;
    }
    const next = [...others.slice(0, at), d.id, ...others.slice(at)];
    if (next.join('|') === cur.join('|')) return place();
    haptics.select();
    localRef.current = next;
    flushSync(() => setLocal(next));
  };
  /** Near the page's top or bottom edge the page scrolls under a lifted step (the Leave row's band counts as the edge). */
  const autoScroll = () => {
    const d = drag.current;
    const sc = list.current?.closest<HTMLElement>('.pushed');
    const s = scroll.current;
    if (!d || !sc) return void (s.raf = 0);
    const r = sc.getBoundingClientRect();
    const bottom = r.bottom - 60 - 24;
    const top = r.top + 104;
    s.v = d.y > bottom ? Math.min(14, (d.y - bottom) / 4) : d.y < top ? -Math.min(14, (top - d.y) / 4) : 0;
    if (s.v) {
      const was = sc.scrollTop;
      sc.scrollTop += s.v;
      if (sc.scrollTop !== was) reslot();
    }
    s.raf = s.v ? requestAnimationFrame(autoScroll) : 0;
  };
  const onDragStart = (id: string) => (p: DragPoint) => {
    const el = rowEl(id);
    if (!el || !actions) return;
    stopFlip(el);
    const visualTop = el.getBoundingClientRect().top;
    // the grab is where the finger went down, not where the drag began 8 px later: the row takes up the slop on the first
    // drag frame and stays under the thumb (feel review 1 FL7)
    drag.current = { id, grab: p.y - p.dy - visualTop, y: p.y, el, from: order.join('|') };
    el.classList.add('is-lifted');
    localRef.current = order;
    flushSync(() => setLocal(order));
    place();
  };
  const onDragMove = (p: DragPoint) => {
    const d = drag.current;
    if (!d) return;
    d.y = p.y;
    place();
    reslot();
    if (!scroll.current.raf) scroll.current.raf = requestAnimationFrame(autoScroll);
  };
  const onDragEnd = (_p: DragPoint, _e: PointerEvent, cancelled: boolean) => {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    if (scroll.current.raf) cancelAnimationFrame(scroll.current.raf);
    scroll.current.raf = 0;
    const cur = localRef.current ?? [];
    const el = d.el;
    const home = () => el.classList.remove('is-lifted');
    // the drop: from under the finger into its slot on `settle` (reduced motion: in place at once)
    if (reduce) {
      el.style.transform = '';
      home();
    } else flipY(el, drawnY(el), home);
    if (cancelled) {
      setLocal(null);
      return;
    }
    haptics.drop();
    if (cur.join('|') !== d.from) {
      actions?.saveOrder(cur as RoutineKey[]);
      const name = byId.get(d.id)?.name ?? 'Step';
      setSaid(`${name} moved to ${cur.indexOf(d.id) + 1} of ${cur.length}`);
    } else setLocal(null);
  };
  /** The keyboard's (and VoiceOver's) reorder: one slot, one write. */
  const nudge = (id: string, dir: -1 | 1) => {
    const o = [...order];
    const i = o.indexOf(id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= o.length) return;
    [o[i], o[j]] = [o[j]!, o[i]!];
    haptics.select();
    setLocal(o);
    actions?.saveOrder(o as RoutineKey[]);
    setSaid(`${byId.get(id)?.name ?? 'Step'} moved to ${j + 1} of ${o.length}`);
  };

  // ---------- focus after a row leaves (code review 1 F6) ----------
  // a keyboard Remove or Skip takes away the row the menu gives focus back to: once that row is gone and focus fell to the
  // body, the next row that is still here takes it (the one before, else the Wake row)
  const refocus = useRef<{ id: string; ids: string[]; until: number } | null>(null);
  const keepFocus = (id: string) => {
    refocus.current = { id, ids: [...shown.map((x) => x.id), 'leave'], until: performance.now() + 2000 };
    const live = (k: string) => list.current?.querySelector<HTMLElement>(`:scope > li[data-row="${CSS.escape(k)}"]:not([data-motion-pop-id]) .sch-hit`) ?? null;
    const tick = () => {
      const f = refocus.current;
      if (!f || !list.current || performance.now() > f.until) return void (refocus.current = null);
      if (!live(f.id)) {
        const a = document.activeElement as HTMLElement | null;
        // stray: on the body, or still on the row that is leaving (the menu gave it back before the row went)
        const stray = !a || a === document.body || !!a.closest(`li[data-row="${CSS.escape(f.id)}"]`);
        if (stray) {
          const i = f.ids.indexOf(f.id);
          const pick = [...f.ids.slice(i + 1), ...f.ids.slice(0, i).reverse(), 'wake'].map(live).find(Boolean);
          pick?.focus({ preventScroll: true });
        } else if (!a.closest('.cm-menu') && !a.closest('.sch')) return void (refocus.current = null);
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

  // ---------- the workout row's content handed to another thing (FL5): fade the new one in, once ----------
  const swaps = useRef(new Map<string, { key: string; on: boolean }>());
  const swapOf = (r: SchedRow) => {
    const key = `${r.icon}|${r.name}`;
    const was = swaps.current.get(r.id);
    return was == null ? { key, on: false } : was.key !== key ? { key, on: true } : was;
  };
  const nextSwaps = new Map<string, { key: string; on: boolean }>();
  useLayoutEffect(() => {
    swaps.current = nextSwaps;
  });

  // ---------- the rows ----------
  const label = (r: SchedRow) => `${r.name}, ${clockOfDay(r.at)}${r.sub ? `, ${r.sub}` : ''}`;
  const rowFor = (r: SchedRow): ReactNode => {
    const st = timeState(isToday, now, r.start, r.end);
    const cls = `sch-row k-${r.kind} ${r.tone ? `t-${r.tone}` : ''} ${st.cls}`;
    const time = short(r.at);
    const isMoved = moved.has(r.id);
    let inner: ReactNode;
    if (r.kind === 'late') inner = <LateBody T={T} fix={actions?.late} interactive={interactive} now={now} rel={rel} held={!!wake.held} />;
    else if (!actions)
      inner = (
        <>
          <div className="sch-hit" aria-label={label(r)}>
            <RowBody r={r} time={r.kind === 'wake' ? null : time} />
          </div>
          {r.kind === 'wake' ? <AlarmHandle wake={r.at} disabled onStep={noop} onCommit={noop} onTap={noop} /> : null}
        </>
      );
    else if (r.kind === 'wake') {
      const items: ContextMenuItem[] = actions.backLabel ? [{ label: `Back to ${actions.backLabel}`, icon: <Undo2 size={18} />, onSelect: actions.backToPlan }] : [];
      inner = (
        <>
          <Pressable as="div" className="sch-hit" press="surface" onPress={actions.editWake} holdMenu={items.length ? items : undefined} menuLabel="Wake up actions" label={`${label(r)}. Change the alarm`}>
            <RowBody r={r} time={null} />
          </Pressable>
          <AlarmHandle wake={r.at} onStep={wake.onStep} onCommit={wake.onCommit} onDragging={wake.onDragging} onTap={actions.editWake} moved={isMoved} />
        </>
      );
    } else if (r.kind === 'work') {
      const rest = actions.rest;
      const items: ContextMenuItem[] = [
        ...(actions.skipLabel
          ? [
              {
                label: `Skip ${actions.skipLabel}`,
                icon: <SkipForward size={18} />,
                onSelect: () => {
                  keepFocus(r.id);
                  actions.skip();
                },
              },
            ]
          : []),
        ...(rest
          ? [
              {
                label: 'Make this a rest day',
                icon: <Moon size={18} />,
                onSelect: () => {
                  keepFocus(r.id);
                  rest();
                },
              },
            ]
          : []),
        { label: 'Edit', icon: <Pencil size={18} />, onSelect: actions.editDay },
      ];
      const swap = swapOf(r);
      nextSwaps.set(r.id, swap);
      inner = (
        <Pressable as="div" className="sch-hit" press="surface" onPress={actions.editDay} holdMenu={items} menuLabel={`${r.name} actions`} label={`${label(r)}. Open the session`}>
          <RowBody r={r} time={time} moved={isMoved} swap={swap} />
        </Pressable>
      );
    } else if (r.kind === 'free')
      inner = (
        <Pressable as="div" className="sch-hit" press="surface" onPress={actions.editStart} label={`${label(r)}. Change when the routine starts`}>
          <RowBody r={r} time={time} moved={isMoved} />
        </Pressable>
      );
    else {
      const k = r.id as RoutineKey;
      const i = order.indexOf(r.id);
      inner = (
        <>
          <Pressable
            as="div"
            className="sch-hit"
            press="surface"
            onPress={() => actions.editStep(k, () => keepFocus(r.id))}
            holdMenu={[
              { label: 'Edit', icon: <Pencil size={18} />, onSelect: () => actions.editStep(k, () => keepFocus(r.id)) },
              {
                label: 'Remove',
                icon: <Trash2 size={18} />,
                onSelect: () => {
                  keepFocus(r.id);
                  actions.removeStep(k);
                },
                destructive: true,
              },
            ]}
            menuLabel={`${r.name} actions`}
            onDragStart={onDragStart(r.id)}
            onDragMove={onDragMove}
            onDragEnd={onDragEnd}
            label={`${label(r)}. Edit. Hold to move`}
            onKeyDown={(e: React.KeyboardEvent<HTMLElement>) => {
              if (!e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
              e.preventDefault();
              nudge(r.id, e.key === 'ArrowUp' ? -1 : 1);
            }}
          >
            <RowBody r={r} time={time} moved={isMoved} />
          </Pressable>
          {order.length > 1 ? (
            <span className="sch-sr">
              {i > 0 ? (
                <button type="button" className="sr-only" tabIndex={-1} onClick={() => nudge(r.id, -1)}>
                  Move {r.name} up
                </button>
              ) : null}
              {i < order.length - 1 ? (
                <button type="button" className="sr-only" tabIndex={-1} onClick={() => nudge(r.id, 1)}>
                  Move {r.name} down
                </button>
              ) : null}
            </span>
          ) : null}
        </>
      );
    }
    return (
      <motion.li key={r.id} data-row={r.id} className={cls} initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1, transition: fadeIn }} exit={{ opacity: 0, transition: { duration: 0.1 } }}>
        {inner}
        {st.cls === 'is-now' && r.kind !== 'late' ? <Progress p={st.p} /> : null}
      </motion.li>
    );
  };

  return (
    <>
      <ol ref={list} className={`sch ${wake.dragging ? 'is-alarm-drag' : ''}`} aria-label="The morning, from the alarm to the door">
        <AnimatePresence initial={false} mode="popLayout">
          {shown.map(rowFor)}
        </AnimatePresence>
        <LeaveRow T={T} rel={rel} now={now} moved={moved.has('leave')} onPress={actions?.editLeave} />
      </ol>
      <span className="sr-only" aria-live="polite">
        {said}
      </span>
    </>
  );
};
