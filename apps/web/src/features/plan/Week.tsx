import { assess, fmtDate, mondayOf, label, mi, monthOf, num, sessionKey, sessionWord, shiftDays, tone, type Activity, type Session, type StatusKey, heldOn, TRAINING_STATUS_INFO } from '@logbook/shared';
import { isHeld } from './Held';
import { ArrowRightLeft, Check, ChevronLeft, ChevronRight, Plus, SkipForward, Trash2, Undo2 } from 'lucide-react';
import { effortOf } from '../sessions/effortModel';
import { createContext, Fragment, memo, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { useSessionMutations } from '@/api/queries';
import { haptics } from '@/lib/haptics';
import type { ContextMenuItem } from '@/ui/ContextMenu';
import { PAGE_COMMIT, type PageCommitDetail } from '@/ui/nav';
import { Pressable } from '@/ui/Pressable';
import { Skeleton } from '@/ui/Skeleton';
import { useSheet } from '@/ui/Sheet';
import { useToast } from '@/ui/Toast';
import { useLog, type Log } from '../log/useLog';
import { sessionCan, useSessionActions } from '../sessions/actions';
import type { ReshapeResult } from '../sessions/reshape';
import { runIntent, useOpenSession, useOpenUnplanned } from '../sessions/SessionCard';
import { crossfade, fadeOut } from '@/lib/motion';
import { SectionHeader } from '@/ui/layout';
import { DateGutter } from '@/ui/primitives';
import { useTrainWhen, type TrainWhen } from '../day/trainWhen';
import { morningOf, short as clockShort, stopsOf } from '../morning/model';
import { useFlip, waapiOf } from './flip';
import { LoadFail, useMonthsFailed } from './LoadFail';
import { dayOrder, landingIndex, useMoveTo } from './moveRule';
import { isLanding, PLAN_DAY, useDayDrag } from './useDayDrag';
import { weekWords } from './WeekLine';
import { weekTitle } from './context';
import { arrivingFor, onWeekChange } from './weekLive';
import { openAddSession } from '../sessions/AddSessionSheet';
import { defaultDay } from '../sessions/addModel';
import { sessionIcon } from '../sessions/sessionIcon';
import { dayRange } from '@/ui/charts/range';

/**
 * One week of Plan, day by day: the week's header (its name, its dates, previous and next), one line on what the week holds
 * with `+ Add` at its end (the Add sheet: a run or a lift on any day of this week), and the seven days as rows in one inset
 * group.
 * It is what the week pager renders for prev, cur and next, memoised by its Monday, with its own log, so a page commit
 * re-renders none of the three.
 *
 * A session row: tap opens the session sheet; hold 450 lifts it in place with the menu `Done · Skip · Move · Delete`; a
 * move after the hold drags it (`useDayDrag`): the pill follows the finger, the day under it is lit, a drop moves (or swaps
 * with the day's lead session), the pill shrinks into its new slot and the displaced row slides on `settle`; a drop that
 * makes two hard days in a row fires `warning` and shows the inline `Two hard days in a row. Keep it?` row in the group
 * (the rows below move by transform). An empty day: tap adds (the Add sheet, on that day). Done is a check, missed is the
 * word `Missed` in ink-3 with a 1 px strike on the name: never red. No swipe rows (the pager is the only horizontal gesture
 * on the page).
 */

const nameOf = (s: Session) => (s.kind === 'rest' ? 'Rest' : label(s));
/**
 * What every row of a group does, made once per group (a row would otherwise hold some twenty mutation observers of its own):
 * open a session, add, move, mark, delete and restore, reshape, toast, and `flip` (the FLIP capture, flip.ts: called right
 * before a change that moves rows).
 */
const useKit = (log: Log, flip: ReturnType<typeof useFlip>, onReshaped: (r: ReshapeResult, to: string) => void) => {
  const open = useOpenSession(log);
  const openUnplanned = useOpenUnplanned();
  const act = useSessionActions(log);
  const toast = useToast();
  const sheet = useSheet();
  const { mark, remove, restore } = useSessionMutations();
  // a drop moves or swaps by the one rule the Move sheet uses too (moveRule.ts: never a swap into the past)
  const moveTo = useMoveTo();
  // a day's own add: the Add sheet, opened on that day
  const add = (date: string) => openAddSession(sheet, mondayOf(date), date, log.today);
  return { log, open, openUnplanned, add, move: act.move, askEffort: act.askEffort, toast, mark, remove, restore, moveTo, flip, onReshaped };
};
type KitT = ReturnType<typeof useKit>;
const Kit = createContext<KitT | null>(null);
const useRowKit = () => useContext(Kit)!;
/**
 * A deleted row leaves in a render of its day alone (feel review 3 #4): when its fade is over the day stops drawing it
 * (`hide`), that render's layout starts the rows' FLIP (on the compositor), and only then does the write go, so its render
 * of every mounted tab runs while the rows slide instead of between the fade and the slide. `unhide` is Undo's.
 */
interface DayKitT {
  hide: (s: Session) => void;
  unhide: (s: Session) => void;
}
const DayKit = createContext<DayKitT>({ hide: () => undefined, unhide: () => undefined });

export interface Conflict {
  days: string[];
  /** The day the question sits under: the pair's later day, or its earlier one when the later is on the next page (code review 2 #4). */
  at: string;
  undo: () => void;
}

/**
 * The status at a row's right edge: done (and a run off the plan) a check in a lit disc; missed and skipped a word in Dusk;
 * floor a word a step heavier; still to do (today's included), the chevron that says the row opens. Today needs no tag:
 * its row is tinted and its numeral ringed (layout plan P3), and the row's label says the word.
 */
const Status = ({ k, word }: { k: StatusKey; word: string }) => {
  if (k === 'done' || k === 'bonus')
    return (
      <span className="pl-st is-check" role="img" aria-label={word}>
        <Check size={14} strokeWidth={3} aria-hidden="true" />
      </span>
    );
  if (k === 'missed' || k === 'skipped' || k === 'floor') return <span className={`pl-st is-word k-${k}`}>{word}</span>;
  return <ChevronRight size={18} className="pl-st is-chev" aria-hidden="true" />;
};

/**
 * What leaves on a delete fades (`fadeOut`, 100 ms), then the layout commits once and the rows below FLIP (docs/feel.md
 * §10.1; review-feel-1 #5): a session's whole row (its lifted surface too, so no empty grey box is left: feel review 2 B),
 * a rest day's word and outline only (the row stays, an empty day). `done` resolves when the fade is over; `release` drops
 * the held opacity once the change is in, so an element React keeps (the rest day's row, a row put back by Undo or by a
 * failed write) never stays invisible (code review 2 #2).
 */
const fadeAway = (els: Array<Element | null | undefined>) => {
  const list = els.filter((e): e is HTMLElement => e instanceof HTMLElement);
  if (!list.length || matchMedia('(prefers-reduced-motion: reduce)').matches) return { done: Promise.resolve(), release: () => undefined };
  const t = { ...waapiOf(fadeOut), fill: 'forwards' as const };
  const anims = list.map((k) => k.animate([{ opacity: getComputedStyle(k).opacity }, { opacity: 0 }], t));
  const ok = () => undefined;
  // `done` comes two frames before the fade's end (it is at 4 % by then, ease-out): the change that follows commits there,
  // so the rows below start to move on the frame the fade ends, with no still frame between (feel review 3 #4)
  const near = new Promise<void>((r) => setTimeout(r, Math.max(0, t.duration - 34)));
  return {
    done: Promise.race([near, anims[0]!.finished.then(ok, ok)]),
    release: () => anims.forEach((a) => a.cancel()),
  };
};

/** Two frames on: a change committed now has been painted and its compositor animations have started. */
const afterTwoFrames = (fn: () => void) => requestAnimationFrame(() => requestAnimationFrame(fn));

/** After a delete took a focused row away, focus goes to what is now on that day (code review 2 #8), not to `<body>`. */
const focusDay = (group: HTMLElement | null, date: string) => {
  if (document.activeElement && document.activeElement !== document.body && document.activeElement.isConnected) return;
  group?.querySelector<HTMLElement>(`[${PLAN_DAY}="${date}"] .pl-line`)?.focus({ preventScroll: true });
};

/**
 * A card's one line under the name: what was run (`7.6 mi · 8:42 /mi`), or what is asked: the workout's own shorthand
 * when the plan wrote one (`1.5 mi wu, 3 × 1 mi, 1.5 mi cd`), else the effort the run is graded against (assess.ts: easy
 * under the Z2 ceiling, tempo and threshold Z3–Z4, fast reps reaching Z4); a lift its minutes and kind. Then the effort
 * once it is checked in (`Effort 6`).
 */
const intentOf = runIntent;
const targetLine = (s: Session, name: string, dist: string, a: ReturnType<typeof assess> | null) => {
  const typeWord = s.type && !name.toLowerCase().includes(s.type.toLowerCase()) ? s.type : '';
  const bits: string[] = [];
  if (a) bits.push(`${mi(a.miles)} mi`, ...(a.pace ? [`${a.pace} /mi`] : []));
  else if (s.kind === 'run') bits.push(...(dist ? [dist] : []), s.details || intentOf(s.type));
  else bits.push(...(dist ? [dist] : []), ...(typeWord ? [typeWord] : []), ...(s.details ? [s.details] : []));
  const e = effortOf(s.effort);
  if (e != null) bits.push(`Effort ${e}`);
  return bits.join(' · ');
};

/** The session's icon tile in its tone (a run off the plan: an easy run's). `.pl-tone` is what a delete fades. */
const ToneTile = ({ s }: { s: Session | null }) => {
  const Icon = sessionIcon(s);
  return (
    <span className="pl-tone pl-ic" aria-hidden="true">
      <Icon size={17} strokeWidth={2.1} />
    </span>
  );
};

/**
 * Today's morning on today's run row (layout plan P1: Plan has no Today section; the row says it once): while today's
 * training time is Morning and the run is still to do, its line is "Out 6:45 · back 7:54" (the schedule's door and back);
 * the zone text moves to the session sheet. With Afternoon or no time, or no morning set up, the row keeps its zone text.
 */
export interface MorningLine {
  id: string;
  /** "Out 6:45 · back 7:54"; under 360 pt wide the row shows `short`, "6:45 to 7:54", so the back time is never cut. */
  text: string;
  short: string;
}
export const morningLineOf = (log: Log, date: string, when: TrainWhen): MorningLine | null => {
  if (date !== log.today || when !== 'morning' || !log.loaded(date)) return null;
  const st = log.boot?.morningSettings;
  if (!st) return null;
  const all = log.snap.sessionsOn(date);
  const run = dayOrder(all).find((s) => s.kind === 'run');
  // a run on hold (sick, injured) says so on its row, not the morning
  if (!run || sessionKey(log.snap, date, run) !== 'today' || (isHeld(run) && heldOn(log.boot?.user.status, date))) return null;
  const stops = stopsOf(morningOf(all, log.snap.morningOverride(date), st));
  const door = stops.find((x) => x.key === 'door');
  const back = stops.find((x) => x.key === 'back');
  return door && back ? { id: run.id, text: `Out ${clockShort(door.at)} · back ${clockShort(back.at)}`, short: `${clockShort(door.at)} to ${clockShort(back.at)}` } : null;
};

/** What a session row shows, with no hooks: the live row and a neighbour page not yet live draw the same pixels. */
export const rowFace = (log: Log, date: string, s: Session, morning?: MorningLine | null) => {
  const k = sessionKey(log.snap, date, s);
  const word = sessionWord(log.snap, date, s);
  const runs = s.kind === 'run' ? log.snap.runsOn(date) : [];
  const a = runs.length ? assess(log.zones, s, runs) : null;
  const name = nameOf(s);
  const dist0 = a ? `${mi(a.miles)} mi` : s.kind === 'run' && s.miles ? `${num(s.miles)} mi` : s.minutes ? `${s.minutes} min` : '';
  // a planned distance the name already says (`Easy 4` · `4 mi`) is not said twice: the name gets the room (review-feel-1 #14)
  const dist = !a && s.kind === 'run' && s.miles && new RegExp(`\\b${num(s.miles)}\\b`).test(name) ? '' : dist0;
  const held = isHeld(s) && date >= log.today ? heldOn(log.boot?.user.status, date) : null;
  const am = !held && morning?.id === s.id ? morning : null;
  const sub = held ? `On hold · ${TRAINING_STATUS_INFO[held].label}` : am ? am.text : targetLine(s, name, dist, a);
  const body = (
    <>
      <ToneTile s={s} />
      <span className="pl-main">
        <span className="pl-name">{name}</span>
        {am ? (
          <span className="pl-sub">
            <span className="pl-am">{am.text}</span>
            <span className="pl-am is-short">{am.short}</span>
          </span>
        ) : sub ? (
          <span className="pl-sub">{sub}</span>
        ) : null}
      </span>
      <Status k={k} word={word} />
    </>
  );
  return { k, word, name, dist, sub, cls: `pl-line t-${tone(s)} k-${k}${held ? ' is-held' : ''}`, body };
};
const bonusFace = (log: Log, date: string, runs: Activity[]) => {
  const a = assess(log.zones, null, runs);
  const word = sessionWord(log.snap, date, null);
  const name = runs.length === 1 ? runs[0]!.name : `${runs.length} runs`;
  const sub = `${mi(a.miles)} mi${a.pace ? ` · ${a.pace} /mi` : ''} · Off the plan`;
  const body = (
    <>
      <ToneTile s={null} />
      <span className="pl-main">
        <span className="pl-name">{name}</span>
        <span className="pl-sub">{sub}</span>
      </span>
      <Status k="bonus" word={word} />
    </>
  );
  return { name, word, sub, body };
};
/**
 * A quiet day's face: a planned rest is its moon tile and the word; from today on an open day keeps a quiet plus where
 * its tile would sit (a mark, not a dashed slot: a dashed edge on every open day made an open week a column of boxes, and
 * the standard keeps it to one add slot a group, C5); a past open day keeps its row, blank. Either takes a tap.
 */
const emptyFace = (log: Log, date: string, rest: Session | null) => (
  <>
    {rest ? (
      <ToneTile s={rest} />
    ) : (
      <span className={`pl-tone pl-ic is-empty ${date >= log.today ? 'is-add' : ''}`.trim()} aria-hidden="true">
        {date >= log.today ? <Plus size={18} strokeWidth={1.75} /> : null}
      </span>
    )}
    <span className="pl-main">{rest ? <span className="pl-rest">Rest</span> : null}</span>
  </>
);

/** One session on a day: a 60 px row in the group. */
const SessionRow = ({ date, s, morning }: { date: string; s: Session; morning?: MorningLine | null }) => {
  const row = useRef<HTMLElement>(null);
  const { log, open, move, askEffort, toast, mark, remove, restore, moveTo, flip, onReshaped } = useRowKit();
  const { hide, unhide } = useContext(DayKit);
  const { word, name, sub, cls, body } = rowFace(log, date, s, morning);
  const drag = useDayDrag({
    date,
    session: s,
    title: name,
    row,
    // the pill flies to the row the session will occupy there (feel review 2 E)
    slotFor: (to) => landingIndex(log, s, date, to),
    // written at the release (the rows reflow under the pill's flight); the haptic and the toast when the pill rests
    onDrop: (to, landed) => {
      flip();
      const r = moveTo(log, s, date, to);
      if (!r) return false;
      void landed.then(() => onReshaped(r, to));
      return true;
    },
  });
  // Done · Skip · Move · Delete (§11.2), read when the hold fires so it says the state of that moment
  const menu = (): ContextMenuItem[] => {
    const c = sessionCan(log, date, s);
    const done = c.st === 'done' && s.mark === 'done';
    const skipped = s.mark === 'skip' || s.mark === 'sick';
    return [
      done
        ? { label: 'Not done', icon: <Undo2 size={18} />, onSelect: () => mark.mutate({ session: s, mark: null }) }
        : {
            label: 'Done',
            icon: <Check size={18} />,
            disabled: !c.mark,
            // then the effort check-in, one step, with Skip (Effort.tsx)
            onSelect: () => {
              mark.mutate({ session: s, mark: 'done' });
              askEffort(s);
            },
          },
      {
        label: skipped ? 'Put it back' : 'Skip',
        icon: <SkipForward size={18} />,
        disabled: !skipped && !c.skip,
        onSelect: () => {
          const was = s.mark;
          mark.mutate({ session: s, mark: skipped ? null : 'skip' });
          toast(skipped ? `${name} back on` : `${name} skipped`, { label: 'Undo', fn: () => mark.mutate({ session: s, mark: was }) });
        },
      },
      { label: 'Move', icon: <ArrowRightLeft size={18} />, onSelect: () => move(date, s) },
      {
        label: 'Delete',
        icon: <Trash2 size={18} />,
        destructive: true,
        onSelect: () => {
          haptics.delete();
          const f = fadeAway([row.current]);
          void f.done.then(() => {
            const group = row.current?.closest<HTMLElement>('.pl-wgroup') ?? null;
            const focused = !!row.current?.contains(document.activeElement);
            // the toast rises in the layout of the render the row leaves in, not before it (feel review 2 B)
            flip(() => {
              f.release();
              if (focused) focusDay(group, date);
              toast(`${name} deleted`, { label: 'Undo', fn: () => (flip(), unhide(s), restore.mutate(s)) });
            });
            // the row leaves in this task, in a render of its day (the rows below start to move on the next frame); the
            // write once their FLIP runs on the compositor, so its render cannot hold back their first frames (feel review 3 #4)
            flushSync(() => hide(s));
            afterTwoFrames(() => remove.mutate(s));
          });
        },
      },
    ];
  };
  const landingNow = isLanding(s.id);
  // just added (the Add sheet): the row is lit for a moment, and once the rows have made room and the sheet is on its way
  // down it is brought into view above the dock, so the eye finds what was added
  const [fresh, setFresh] = useState(() => arrivingFor(s.id) > 0);
  useEffect(() => {
    const left = arrivingFor(s.id);
    if (!left) return;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const show = setTimeout(() => row.current?.closest<HTMLElement>('.pl-slot')?.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' }), reduce ? 0 : 320);
    const settle = setTimeout(() => setFresh(false), left);
    return () => {
      clearTimeout(show);
      clearTimeout(settle);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className={`pl-slot ${fresh ? 'is-new' : ''}`.trim()} data-session-id={s.id} data-landing={landingNow ? '' : undefined}>
      <Pressable
        ref={row}
        as="div"
        press="surface"
        className={cls}
        // the printed words first (name, its line, the status), then the day the date column shows
        label={`${name}${sub ? `. ${sub}` : ''}. ${word}. ${fmtDate('dowLong', date)}. Open; hold for actions or to move`}
        onPress={() => open(date, s)}
        holdMenu={menu}
        menuLabel={`${name} actions`}
        {...drag}
      >
        {body}
      </Pressable>
    </div>
  );
};

/** A run that happened with nothing planned for it. Tap opens it. */
const BonusRow = ({ date, runs }: { date: string; runs: Activity[] }) => {
  const { log, openUnplanned } = useRowKit();
  const { name, word, sub, body } = bonusFace(log, date, runs);
  return (
    <Pressable as="div" press="surface" className="pl-line t-easy k-bonus" onPress={() => openUnplanned(date, runs, log)} label={`${name}. ${sub}. ${word}. ${fmtDate('dowLong', date)}. Open`}>
      {body}
    </Pressable>
  );
};

/**
 * A quiet day. A planned rest day says `Rest` (a plan decision) and has a hold menu (add, move it, delete it); a day with
 * nothing planned says nothing, only the `+` from today on (review-feel-1 #11). Tap adds a session.
 */
const EmptyRow = ({ date, rest }: { date: string; rest: Session | null }) => {
  const { log, add, move, toast, remove, restore, flip } = useRowKit();
  const { hide, unhide } = useContext(DayKit);
  const line = useRef<HTMLElement>(null);
  const items: ContextMenuItem[] | undefined = rest
    ? [
        { label: 'Add a session', icon: <Plus size={18} />, onSelect: () => add(date) },
        { label: 'Move rest day', icon: <ArrowRightLeft size={18} />, onSelect: () => move(date, rest) },
        {
          label: 'Delete rest day',
          destructive: true,
          icon: <Trash2 size={18} />,
          onSelect: () => {
            haptics.delete();
            // the word and the outline go; the row stays (an empty day, its + from today on)
            const f = fadeAway([line.current?.querySelector('.pl-rest'), line.current?.querySelector('.pl-tone')]);
            void f.done.then(() => {
              flip(() => {
                f.release();
                toast('Rest day deleted', { label: 'Undo', fn: () => (flip(), unhide(rest), restore.mutate(rest)) });
              });
              // as a session's Delete: the word leaves in a render of its day, then the write (feel review 3 #4)
              flushSync(() => hide(rest));
              afterTwoFrames(() => remove.mutate(rest));
            });
          },
        },
      ]
    : undefined;
  return (
    <Pressable ref={line} as="div" press="surface" className={`pl-line is-rest ${rest ? '' : 'is-empty'}`.trim()} label={rest ? `Rest. ${fmtDate('dowLong', date)}. Add a session` : `${fmtDate('dowLong', date)}: nothing planned. Add a session`} onPress={() => add(date)} holdMenu={items} menuLabel="Rest day actions">
      {emptyFace(log, date, rest)}
    </Pressable>
  );
};

/** One day: the date column (weekday, the number; today's in the accent disc) and its rows. The whole day takes a drop. */
/** What a day holds, in the order its rows are drawn (moveRule.ts's `dayOrder`, which the drag's landing reads too). */
const dayOf = (log: Log, date: string, hidden?: ReadonlySet<string>) => {
  const own = log.snap.sessionsOn(date);
  // a deleted row is gone from its day before the write takes it out of the data
  const sessions = hidden?.size ? own.filter((x) => !hidden.has(x.id)) : own;
  const ordered = dayOrder(sessions);
  const runs = log.snap.runsOn(date);
  const bonus = !ordered.some((s) => s.kind === 'run') && runs.length > 0;
  const rest = sessions.find((s) => s.kind === 'rest') ?? null;
  const t = log.today;
  return { ordered, runs, bonus, rest, cls: `pl-day ${date === t ? 'is-today' : ''} ${date < t ? 'is-past' : ''}`.trim() };
};
/** The day's column: the shared date gutter (layout standard 6.2), today's numeral ringed. It carries no handlers. */
const DateCol = ({ date, today }: { date: string; today: string }) => <DateGutter date={date} today={date === today} className={`pl-date ${date < today ? 'is-past' : ''}`.trim()} />;
const DayRow = ({ date, morning }: { date: string; morning?: MorningLine | null }) => {
  const { log, flip } = useRowKit();
  const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set());
  const dayKit = useMemo<DayKitT>(
    () => ({
      hide: (x) => setHidden((m) => new Set(m).add(x.id)),
      unhide: (x) =>
        setHidden((m) => {
          if (!m.has(x.id)) return m;
          const n = new Set(m);
          n.delete(x.id);
          return n;
        }),
    }),
    [],
  );
  // a render of this day alone (a row hidden or back): the group's FLIP runs from here (it does nothing when no row moved)
  const hiddenWas = useRef(hidden);
  useLayoutEffect(() => {
    if (hiddenWas.current === hidden) return;
    hiddenWas.current = hidden;
    flip.reflow();
  }, [hidden, flip]);
  // once the data has let go of a hidden row, the day forgets it (a failed delete's refetch then shows it again)
  const ids = log.snap.sessionsOn(date).map((x) => x.id).join(' ');
  useEffect(() => {
    if (!hidden.size) return;
    const have = new Set(ids.split(' '));
    if ([...hidden].some((id) => !have.has(id))) setHidden((m) => new Set([...m].filter((id) => have.has(id))));
  }, [ids]); // eslint-disable-line react-hooks/exhaustive-deps
  const { ordered, runs, bonus, rest, cls } = dayOf(log, date, hidden);
  return (
    <DayKit.Provider value={dayKit}>
      <div className={cls} role="listitem" {...{ [PLAN_DAY]: date }}>
        <DateCol date={date} today={log.today} />
        <div className="pl-lines">
          {ordered.map((s) => (
            <SessionRow key={s.id} date={date} s={s} morning={morning} />
          ))}
          {bonus ? <BonusRow date={date} runs={runs} /> : null}
          {!ordered.length && !bonus ? <EmptyRow date={date} rest={rest} /> : null}
        </div>
      </div>
    </DayKit.Provider>
  );
};

/**
 * A neighbour page before it is live (PlanView mounts the live page in a transition after a commit): the same days, the
 * same rows, the same pixels, with no handlers and no hooks per row, so a quick swipe that reaches it before the
 * transition shows the week as it is, and the swap to the live page changes nothing on screen (feel review 2 D).
 */
const StillDay = ({ log, date, morning }: { log: Log; date: string; morning?: MorningLine | null }) => {
  const { ordered, runs, bonus, rest, cls } = dayOf(log, date);
  const line = (key: string, className: string, body: ReactNode) => (
    <div key={key} className="pl-slot">
      <div className={`pressable ${className}`} data-press="surface">
        {body}
      </div>
    </div>
  );
  return (
    <div className={cls}>
      <DateCol date={date} today={log.today} />
      <div className="pl-lines">
        {ordered.map((s) => {
          const f = rowFace(log, date, s, morning);
          return line(s.id, f.cls, f.body);
        })}
        {bonus ? <div className="pressable pl-line t-easy k-bonus" data-press="surface">{bonusFace(log, date, runs).body}</div> : null}
        {!ordered.length && !bonus ? <div className={`pressable pl-line is-rest ${rest ? '' : 'is-empty'}`.trim()} data-press="surface">{emptyFace(log, date, rest)}</div> : null}
      </div>
    </div>
  );
};

/**
 * The inline question under a hard pair, inside the group: it fades in (150 ms) from its first frame, and it is revealed
 * as what is below it slides down off it (flip.ts moves the next days, or the block card under Sunday, on `settle`): each
 * frame its bottom is clipped to the top of what is below it and to the group's surface, so no part of it is drawn below
 * the group or over the block card while they move, whichever render moves them (feel review 3 #2; at 4× the drop's data
 * can land after the question). Both start in the layout of the render it comes in, before that frame is painted.
 */
const ConflictRow = ({ c, onKeep }: { c: Conflict; onKeep: () => void }) => {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    el.animate([{ opacity: 0 }, { opacity: 1 }], waapiOf(crossfade));
    const group = el.closest<HTMLElement>('.pl-wgroup');
    const surf = group?.querySelector<HTMLElement>('.pl-wsurf');
    el.style.clipPath = 'inset(0 0 100% 0)';
    const t0 = performance.now();
    let raf = 0;
    const clip = () => {
      const r = el.getBoundingClientRect();
      const below = el.nextElementSibling ?? afterGroup(group ?? null)[0];
      const lim = Math.min(below?.getBoundingClientRect().top ?? Infinity, surf?.getBoundingClientRect().bottom ?? Infinity);
      const cut = Math.max(0, Math.min(r.height, r.bottom - lim));
      el.style.clipPath = cut > 0.5 ? `inset(0 0 ${cut.toFixed(1)}px 0)` : '';
      if (performance.now() - t0 < 1500) raf = requestAnimationFrame(clip);
      else el.style.clipPath = '';
    };
    raf = requestAnimationFrame(clip);
    return () => cancelAnimationFrame(raf);
  }, []);
  // the question is never asked under the dock or off screen: it scrolls into view above it (its scroll margin is the
  // dock's height), once the rows under it have made room
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const id = setTimeout(() => el.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' }), reduce ? 0 : 260);
    return () => clearTimeout(id);
  }, []);
  return (
    <div ref={ref} className="pl-conflict" role="alert">
      <p>Two hard days in a row. Keep it?</p>
      <div className="pl-conflict-acts">
        <Pressable className="pl-ask" onPress={onKeep}>
          Keep it
        </Pressable>
        <Pressable className="pl-ask is-on" onPress={c.undo}>
          Undo
        </Pressable>
      </div>
    </div>
  );
};

/**
 * What sits under the week's group on its page, in order: anything after it in its section, then the sections after that
 * (the block). They ride the group's FLIP, so the group's edge and the cards under it move together.
 */
const afterGroup = (g: HTMLElement | null): HTMLElement[] => {
  const out: HTMLElement[] = [];
  for (let n: Element | null = g; n && !n.classList.contains('pl-wpage'); n = n.parentElement)
    for (let e = n.nextElementSibling; e; e = e.nextElementSibling) if (e instanceof HTMLElement) out.push(e);
  return out;
};

/** The seven days of `mon` in one inset group (the drop target of every drag). */
const WeekGroup = ({ mon, log, conflict, setConflict, morning }: { mon: string; log: Log; conflict: Conflict | null; setConflict: (c: Conflict | null) => void; morning: MorningLine | null }) => {
  const group = useRef<HTMLDivElement>(null);
  const surf = useRef<HTMLDivElement>(null);
  // the block card (and anything else under the group) rides the same FLIP: the group's edge and the card move together;
  // the surface behind the rows stretches with them (no tear where a row left or comes)
  const flip = useFlip(
    group,
    () => {
      return afterGroup(group.current);
    },
    () => surf.current,
  );
  const kit = useKit(log, flip, (r, to) => onReshaped(r, to));
  const { toast } = kit;
  // a session written to this week from outside its rows (the Add sheet, its Undo): the rows are read first, so
  // what the change moves slides to its place (weekLive.ts)
  const capture = useRef(flip);
  capture.current = flip;
  useEffect(() => onWeekChange(mon, () => capture.current()), [mon]);
  const days = Array.from({ length: 7 }, (_, i) => shiftDays(mon, i));
  if (!log.loaded(mon) || !log.loaded(shiftDays(mon, 6))) return <SkelGroup days={days} />;
  const onReshaped = (r: ReshapeResult, to: string) => {
    if (r.conflict) {
      haptics.warning();
      const [a, b] = r.conflict as [string, string];
      const inPage = (d: string) => d >= mon && d <= shiftDays(mon, 6);
      setConflict({
        days: r.conflict,
        at: inPage(b) ? b : inPage(a) ? a : to,
        undo: () => {
          flip();
          r.undo();
          setConflict(null);
        },
      });
      return;
    }
    setConflict(null);
    haptics.drop();
    toast(r.swapped ? r.said : `Moved to ${fmtDate('dow', to)}`, { label: 'Undo', fn: () => (flip(), r.undo()) });
  };
  return (
    <Kit.Provider value={kit}>
      <div ref={group} className="pl-group pl-wgroup" role="list" aria-label={`Week of ${fmtDate('md', mon)}`}>
        <div ref={surf} className="pl-wsurf" aria-hidden="true" />
        {days.map((d) => (
          <Fragment key={d}>
            <DayRow date={d} morning={d === log.today ? morning : null} />
            {conflict && conflict.at === d ? (
              <ConflictRow
                c={conflict}
                onKeep={() => {
                  flip();
                  setConflict(null);
                }}
              />
            ) : null}
          </Fragment>
        ))}
      </div>
    </Kit.Provider>
  );
};

/** A week not yet live (`still`): the same group, drawn from the same log, with no row hooks (feel review 2 D). */
const StillGroup = ({ mon, log, morning }: { mon: string; log: Log; morning: MorningLine | null }) => {
  const days = Array.from({ length: 7 }, (_, i) => shiftDays(mon, i));
  if (!log.loaded(mon) || !log.loaded(shiftDays(mon, 6))) return <SkelGroup days={days} />;
  return (
    <div className="pl-group pl-wgroup" aria-hidden="true">
      <div className="pl-wsurf" />
      {days.map((d) => (
        <StillDay key={d} log={log} date={d} morning={d === log.today ? morning : null} />
      ))}
    </div>
  );
};
const SkelGroup = ({ days }: { days: string[] }) => (
  <div className="pl-group pl-skel" aria-label="Loading the week" aria-busy="true">
    {days.map((d) => (
      <div key={d} className="pl-skel-row">
        <Skeleton w={28} h={32} r={8} />
        <Skeleton w="55%" h={18} r="line" />
      </div>
    ))}
  </div>
);

/**
 * The pager pill in a pane's header: previous, `Today` when the page shown is not the current one, next. The week's and
 * the month's are the same control (`unit` names what a step moves).
 */
export const StepNav = ({ unit, away, onStep, onHome }: { unit: 'week' | 'month'; away: boolean; onStep: (dir: -1 | 1) => void; onHome: () => void }) => (
  <span className="pl-wk-nav">
    <Pressable className="pl-step" press="scale" data-step="-1" onPress={() => onStep(-1)} label={`Previous ${unit}`}>
      <ChevronLeft size={18} aria-hidden="true" />
    </Pressable>
    {away ? (
      <Pressable className="pl-step-now" press="scale" onPress={onHome} label={`Today. Go to this ${unit}`}>
        Today
      </Pressable>
    ) : null}
    <Pressable className="pl-step" press="scale" data-step="1" onPress={() => onStep(1)} label={`Next ${unit}`}>
      <ChevronRight size={18} aria-hidden="true" />
    </Pressable>
  </span>
);

/** A week's dates for its header: `Nov 9 to 15`, or `Nov 30 to Dec 6` across a month. */
const weekRange = (mon: string) => dayRange(mon, shiftDays(mon, 6));

/**
 * One week page: the header (the week's name, `This week`, `Next week`, or its dates; the dates beside a named week; then the
 * pager pill `‹ Today ›`: previous week, back to this week when off it, next week), the week's one line (`23 mi · 4 runs.
 * First run today.`), then the seven days. Memoised by its Monday (the pager re-renders none on a commit). `still`: a
 * neighbour not yet live draws the same page without its row hooks (PlanView makes it live in a transition).
 */
export const WeekPage = memo(function WeekPage({ mon, onThisWeek, onStep, still }: { mon: string; onThisWeek: () => void; onStep: (dir: -1 | 1) => void; still?: boolean }) {
  const months = useMemo(() => [...new Set([monthOf(mon), monthOf(shiftDays(mon, 6))])], [mon]);
  const log = useLog(months);
  const [conflict, setConflict] = useState<Conflict | null>(null);
  // the question belongs to the week it was asked on: leaving the week answers it (the move stays)
  useEffect(() => {
    const on = (e: Event) => {
      const d = (e as CustomEvent<PageCommitDetail>).detail;
      if (d.step === 'week' && d.from === mon) setConflict(null);
    };
    window.addEventListener(PAGE_COMMIT, on);
    return () => window.removeEventListener(PAGE_COMMIT, on);
  }, [mon]);
  const ready = log.loaded(mon) && log.loaded(shiftDays(mon, 6));
  // a month that failed with nothing stored: say so with Retry, never a skeleton that stays (the still page stays a skeleton)
  const fail = useMonthsFailed(months);
  const words = ready ? weekWords(log, mon) : null;
  const named = weekTitle(mon, log.today);
  // a week with a name (this, last, next) shows its dates beside it; any other week is named by its dates alone
  const far = named.startsWith('Week of');
  const away = mon !== mondayOf(log.today);
  // today's training time (Today's Morning / Afternoon / No time): it decides whether today's run row says the morning
  const when = useTrainWhen(log.today);
  const morning = ready && mon === mondayOf(log.today) ? morningLineOf(log, log.today, when) : null;
  const sheet = useSheet();
  // the week's Add: the Add sheet on the day `defaultDay` picks (today in this week, the first open day of a later one)
  const addHere = () => openAddSession(sheet, mon, defaultDay(log.snap.sessionsOn, mon, log.today), log.today);
  const weekIn = far ? `the w${named.slice(1)}` : named.toLowerCase();
  return (
    <div className="pl-wpage">
      <section className="pl-sec pl-week-sec" aria-label={`${named}, ${weekRange(mon)}`}>
        <SectionHeader
          className={`pl-wk-head ${away ? 'is-away' : ''}`.trim()}
          title={far ? weekRange(mon) : named}
          meta={far ? undefined : weekRange(mon)}
          action={<StepNav unit="week" away={away} onStep={onStep} onHome={onThisWeek} />}
        />
        <div className="pl-wk-bar">
          {words ? (
            <p className="pl-wk-line">
              {/* where the header has no room for its dates (plantop.css), the line carries them */}
              {far ? null : <span className="pl-wk-range" aria-hidden="true">{`${weekRange(mon)} · `}</span>}
              <b>{words.head}.</b>
              {words.sub ? ` ${words.sub}` : null}
            </p>
          ) : (
            <p className="pl-wk-line" aria-hidden="true">
              &nbsp;
            </p>
          )}
          {/* a run or a lift on any day of this week: quiet (Deep Sky words, a plus), a 44 pt target clear of the arrows' */}
          <Pressable className="pl-add" press="dim" disabled={!ready} onPress={addHere} label={`Add a run or lift to ${weekIn}`}>
            <Plus size={18} strokeWidth={1.75} aria-hidden="true" />
            Add
          </Pressable>
        </div>
        {!ready && fail.failed && !still ? <LoadFail what="Couldn’t load this week." onRetry={fail.retry} /> : still ? <StillGroup mon={mon} log={log} morning={morning} /> : <WeekGroup mon={mon} log={log} conflict={conflict} setConflict={setConflict} morning={morning} />}
      </section>
    </div>
  );
});
