import { assess, fmtDate, label, mi, monthOf, num, parseISO, sessionKey, sessionWord, shiftDays, tone, type Activity, type Session, type StatusKey } from '@logbook/shared';
import { ArrowRightLeft, Check, Plus, SkipForward, Trash2, Undo2 } from 'lucide-react';
import { createContext, Fragment, memo, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { useSessionMutations } from '@/api/queries';
import { haptics } from '@/lib/haptics';
import type { ContextMenuItem } from '@/ui/ContextMenu';
import { PAGE_COMMIT, type PageCommitDetail } from '@/ui/nav';
import { Pressable } from '@/ui/Pressable';
import { Skeleton } from '@/ui/Skeleton';
import { useToast } from '@/ui/Toast';
import { useLog, type Log } from '../log/useLog';
import { sessionCan, useSessionActions } from '../sessions/actions';
import type { ReshapeResult } from '../sessions/reshape';
import { useOpenSession, useOpenUnplanned } from '../sessions/SessionCard';
import { BlockCardView, type PlanBlockProps } from './Blocks';
import { crossfade, fadeOut } from '@/lib/motion';
import { useFlip, waapiOf } from './flip';
import { dayOrder, landingIndex, useMoveTo } from './moveRule';
import { isLanding, PLAN_DAY, useDayDrag } from './useDayDrag';
import { WeekLine } from './WeekLine';

/**
 * One week of Plan (docs/feel.md §7.2): the week line, the seven days as 60 px rows in one inset group, and the block card.
 * It is what the week pager renders for prev, cur and next, memoised by its Monday, with its own log, so a page commit
 * re-renders none of the three.
 *
 * A session row: tap opens the session sheet; hold 450 lifts it in place with the menu `Done · Skip · Move · Delete`; a
 * move after the hold drags it (`useDayDrag`): the pill follows the finger, the day under it is lit, a drop moves (or swaps
 * with the day's lead session), the pill shrinks into its new slot and the displaced row slides on `settle`; a drop that
 * makes two hard days in a row fires `warning` and shows the inline `Two hard days in a row. Keep it?` row in the group
 * (the rows below move by transform). An empty day: tap adds. Done is a check, missed is the word `Missed` in ink-3 with a
 * 1 px strike on the name: never red. No swipe rows (the pager is the only horizontal gesture on the page).
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
  const { mark, remove, restore } = useSessionMutations();
  // a drop moves or swaps by the one rule the Move sheet uses too (moveRule.ts: never a swap into the past)
  const moveTo = useMoveTo();
  return { log, open, openUnplanned, add: act.add, move: act.move, toast, mark, remove, restore, moveTo, flip, onReshaped };
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

/** The status at a row's right edge: done (and a run off the plan) a 14 px check; missed and skipped a word in ink-3; floor in amber. */
const Status = ({ k, word }: { k: StatusKey; word: string }) => {
  if (k === 'done' || k === 'bonus')
    return (
      <span className="pl-st is-check" role="img" aria-label={word}>
        <Check size={14} strokeWidth={3} aria-hidden="true" />
      </span>
    );
  if (k === 'missed' || k === 'skipped' || k === 'floor') return <span className={`pl-st is-word k-${k}`}>{word}</span>;
  return null;
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

/** What a session row shows, with no hooks: the live row and a neighbour page not yet live draw the same pixels. */
const rowFace = (log: Log, date: string, s: Session) => {
  const k = sessionKey(log.snap, date, s);
  const word = sessionWord(log.snap, date, s);
  const runs = s.kind === 'run' ? log.snap.runsOn(date) : [];
  const a = runs.length ? assess(log.zones, s, runs) : null;
  const name = nameOf(s);
  const dist0 = a ? `${mi(a.miles)} mi` : s.kind === 'run' && s.miles ? `${num(s.miles)} mi` : s.minutes ? `${s.minutes} min` : '';
  // a planned distance the name already says (`Easy 4` · `4 mi`) is not said twice: the name gets the room (review-feel-1 #14)
  const dist = !a && s.kind === 'run' && s.miles && new RegExp(`\\b${num(s.miles)}\\b`).test(name) ? '' : dist0;
  const typeWord = s.type && !name.toLowerCase().includes(s.type.toLowerCase()) ? s.type : '';
  const sub = a && runs.length === 1 ? runs[0]!.name : typeWord;
  const body = (
    <>
      <span className="pl-tone" aria-hidden="true" />
      <span className="pl-main">
        <span className="stamp pl-name">{name}</span>
        {sub ? <span className="pl-sub">{sub}</span> : null}
      </span>
      {dist ? <span className="pl-dist tnum">{dist}</span> : null}
      <Status k={k} word={word} />
    </>
  );
  return { k, word, name, dist, cls: `pl-line t-${tone(s)} k-${k}`, body };
};
const bonusFace = (log: Log, date: string, runs: Activity[]) => {
  const a = assess(log.zones, null, runs);
  const word = sessionWord(log.snap, date, null);
  const name = runs.length === 1 ? runs[0]!.name : `${runs.length} runs`;
  const body = (
    <>
      <span className="pl-tone" aria-hidden="true" />
      <span className="pl-main">
        <span className="stamp pl-name">{name}</span>
        <span className="pl-sub">Off the plan</span>
      </span>
      <span className="pl-dist tnum">{mi(a.miles)} mi</span>
      <Status k="bonus" word={word} />
    </>
  );
  return { name, word, miles: a.miles, body };
};
const emptyFace = (log: Log, date: string, rest: Session | null) => (
  <>
    <span className="pl-tone" aria-hidden="true" />
    <span className="pl-main">{rest ? <span className="pl-rest">Rest</span> : null}</span>
    {date >= log.today ? <Plus size={18} className="pl-plus" aria-hidden="true" /> : null}
  </>
);

/** One session on a day: a 60 px row in the group. */
const SessionRow = ({ date, s }: { date: string; s: Session }) => {
  const row = useRef<HTMLElement>(null);
  const { log, open, move, toast, mark, remove, restore, moveTo, flip, onReshaped } = useRowKit();
  const { hide, unhide } = useContext(DayKit);
  const { k, word, name, dist, cls, body } = rowFace(log, date, s);
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
        : { label: 'Done', icon: <Check size={18} />, disabled: !c.mark, onSelect: () => mark.mutate({ session: s, mark: 'done' }) },
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
  return (
    <div className="pl-slot" data-session-id={s.id} data-landing={landingNow ? '' : undefined}>
      <Pressable
        ref={row}
        as="div"
        press="surface"
        className={cls}
        label={`${fmtDate('dowLong', date)}: ${name}${dist ? `, ${dist}` : ''}, ${word}. Open; hold for actions or to move`}
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
  const { name, word, miles, body } = bonusFace(log, date, runs);
  return (
    <Pressable as="div" press="surface" className="pl-line t-easy k-bonus" onPress={() => openUnplanned(date, runs, log)} label={`${fmtDate('dowLong', date)}: ${name}, ${mi(miles)} miles, ${word}. Open`}>
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
    <Pressable ref={line} as="div" press="surface" className={`pl-line is-rest ${rest ? '' : 'is-empty'}`.trim()} label={`${fmtDate('dowLong', date)}: ${rest ? 'rest' : 'nothing planned'}. Add a session`} onPress={() => add(date)} holdMenu={items} menuLabel="Rest day actions">
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
const DateCol = ({ date }: { date: string }) => (
  <div className="pl-date" aria-hidden="true">
    <span className="pl-dow">{fmtDate('dow', date)}</span>
    <span className="pl-num tnum">{parseISO(date).getDate()}</span>
  </div>
);
const DayRow = ({ date }: { date: string }) => {
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
        <DateCol date={date} />
        <div className="pl-lines">
          {ordered.map((s) => (
            <SessionRow key={s.id} date={date} s={s} />
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
const StillDay = ({ log, date }: { log: Log; date: string }) => {
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
      <DateCol date={date} />
      <div className="pl-lines">
        {ordered.map((s) => {
          const f = rowFace(log, date, s);
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
      const below = el.nextElementSibling ?? group?.nextElementSibling;
      const lim = Math.min(below?.getBoundingClientRect().top ?? Infinity, surf?.getBoundingClientRect().bottom ?? Infinity);
      const cut = Math.max(0, Math.min(r.height, r.bottom - lim));
      el.style.clipPath = cut > 0.5 ? `inset(0 0 ${cut.toFixed(1)}px 0)` : '';
      if (performance.now() - t0 < 1500) raf = requestAnimationFrame(clip);
      else el.style.clipPath = '';
    };
    raf = requestAnimationFrame(clip);
    return () => cancelAnimationFrame(raf);
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

/** The seven days of `mon` in one inset group (the drop target of every drag). */
const WeekGroup = ({ mon, log, conflict, setConflict }: { mon: string; log: Log; conflict: Conflict | null; setConflict: (c: Conflict | null) => void }) => {
  const group = useRef<HTMLDivElement>(null);
  const surf = useRef<HTMLDivElement>(null);
  // the block card (and anything else under the group) rides the same FLIP: the group's edge and the card move together;
  // the surface behind the rows stretches with them (no tear where a row left or comes)
  const flip = useFlip(
    group,
    () => {
      const out: HTMLElement[] = [];
      for (let e = group.current?.nextElementSibling as HTMLElement | null; e; e = e.nextElementSibling as HTMLElement | null) out.push(e);
      return out;
    },
    () => surf.current,
  );
  const kit = useKit(log, flip, (r, to) => onReshaped(r, to));
  const { toast } = kit;
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
            <DayRow date={d} />
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
const StillGroup = ({ mon, log }: { mon: string; log: Log }) => {
  const days = Array.from({ length: 7 }, (_, i) => shiftDays(mon, i));
  if (!log.loaded(mon) || !log.loaded(shiftDays(mon, 6))) return <SkelGroup days={days} />;
  return (
    <div className="pl-group pl-wgroup" aria-hidden="true">
      <div className="pl-wsurf" />
      {days.map((d) => (
        <StillDay key={d} log={log} date={d} />
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
 * One week page: the week line, the group, the block card. Memoised by its Monday (the pager re-renders none on a commit).
 * `still`: a neighbour not yet live draws the same page without its row hooks (PlanView makes it live in a transition).
 */
export const WeekPage = memo(function WeekPage({ mon, onThisWeek, block, still }: { mon: string; onThisWeek: () => void; block: PlanBlockProps; still?: boolean }) {
  const months = useMemo(() => [...new Set([monthOf(mon), monthOf(shiftDays(mon, 6))])], [mon]);
  const page = useMemo(() => ({ from: mon, to: shiftDays(mon, 6) }), [mon]);
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
  return (
    <div className="pl-wpage">
      {log.loaded(mon) ? <WeekLine log={log} mon={mon} onThisWeek={onThisWeek} /> : <div className="pl-wl" aria-hidden="true" />}
      {still ? <StillGroup mon={mon} log={log} /> : <WeekGroup mon={mon} log={log} conflict={conflict} setConflict={setConflict} />}
      <BlockCardView data={block.data} getLog={block.getLog} page={page} />
    </div>
  );
});
