import { assess, fmtDate, heroSession, label, mi, monthOf, num, parseISO, sessionKey, sessionWord, shiftDays, tone, type Activity, type Session, type StatusKey } from '@logbook/shared';
import { ArrowRightLeft, Check, Plus, SkipForward, Trash2, Undo2 } from 'lucide-react';
import { createContext, Fragment, memo, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useSessionMutations } from '@/api/queries';
import { haptics } from '@/lib/haptics';
import type { ContextMenuItem } from '@/ui/ContextMenu';
import { PAGE_COMMIT, type PageCommitDetail } from '@/ui/nav';
import { Pressable } from '@/ui/Pressable';
import { Skeleton } from '@/ui/Skeleton';
import { useToast } from '@/ui/Toast';
import { useLog, type Log } from '../log/useLog';
import { sessionCan, useSessionActions } from '../sessions/actions';
import { useReshape, type ReshapeResult } from '../sessions/reshape';
import { useOpenSession, useOpenUnplanned } from '../sessions/SessionCard';
import { BlockCardView, type PlanBlockProps } from './Blocks';
import { useFlip } from './flip';
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
const isTraining = (s: Session) => s.kind !== 'rest';
/**
 * What every row of a group does, made once per group (a row would otherwise hold some twenty mutation observers of its own):
 * open a session, add, move, mark, delete and restore, reshape, toast, and `flip` (the FLIP capture, flip.ts: called right
 * before a change that moves rows).
 */
const useKit = (log: Log, flip: () => void, onReshaped: (r: ReshapeResult, to: string) => void) => {
  const open = useOpenSession(log);
  const openUnplanned = useOpenUnplanned();
  const act = useSessionActions(log);
  const toast = useToast();
  const { mark, remove, restore } = useSessionMutations();
  const { reshape } = useReshape();
  return { log, open, openUnplanned, add: act.add, move: act.move, toast, mark, remove, restore, reshape, flip, onReshaped };
};
type KitT = ReturnType<typeof useKit>;
const Kit = createContext<KitT | null>(null);
const useRowKit = () => useContext(Kit)!;

export interface Conflict {
  days: string[];
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

/** One session on a day: a 60 px row in the group. */
const SessionRow = ({ date, s }: { date: string; s: Session }) => {
  const row = useRef<HTMLElement>(null);
  const { log, open, move, toast, mark, remove, restore, reshape, flip, onReshaped } = useRowKit();
  const k = sessionKey(log.snap, date, s);
  const word = sessionWord(log.snap, date, s);
  const runs = s.kind === 'run' ? log.snap.runsOn(date) : [];
  const a = runs.length ? assess(log.zones, s, runs) : null;
  const name = nameOf(s);
  const dist = a ? `${mi(a.miles)} mi` : s.kind === 'run' && s.miles ? `${num(s.miles)} mi` : s.minutes ? `${s.minutes} min` : '';
  const typeWord = s.type && !name.toLowerCase().includes(s.type.toLowerCase()) ? s.type : '';
  const sub = a && runs.length === 1 ? runs[0]!.name : typeWord;
  const drag = useDayDrag({
    date,
    session: s,
    title: name,
    row,
    onDrop: (to) => {
      flip();
      const r = reshape(log, s, date, to);
      if (r) onReshaped(r, to);
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
          flip();
          remove.mutate(s);
          haptics.delete();
          toast(`${name} deleted`, { label: 'Undo', fn: () => (flip(), restore.mutate(s)) });
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
        className={`pl-line t-${tone(s)} k-${k}`}
        label={`${fmtDate('dowLong', date)}: ${name}${dist ? `, ${dist}` : ''}, ${word}. Open; hold for actions or to move`}
        onPress={() => open(date, s)}
        holdMenu={menu}
        menuLabel={`${name} actions`}
        {...drag}
      >
        <span className="pl-tone" aria-hidden="true" />
        <span className="pl-main">
          <span className="stamp pl-name">{name}</span>
          {sub ? <span className="pl-sub">{sub}</span> : null}
        </span>
        {dist ? <span className="pl-dist tnum">{dist}</span> : null}
        <Status k={k} word={word} />
      </Pressable>
    </div>
  );
};

/** A run that happened with nothing planned for it. Tap opens it. */
const BonusRow = ({ date, runs }: { date: string; runs: Activity[] }) => {
  const { log, openUnplanned } = useRowKit();
  const a = assess(log.zones, null, runs);
  const word = sessionWord(log.snap, date, null);
  const name = runs.length === 1 ? runs[0]!.name : `${runs.length} runs`;
  return (
    <Pressable as="div" press="surface" className="pl-line t-easy k-bonus" onPress={() => openUnplanned(date, runs, log)} label={`${fmtDate('dowLong', date)}: ${name}, ${mi(a.miles)} miles, ${word}. Open`}>
      <span className="pl-tone" aria-hidden="true" />
      <span className="pl-main">
        <span className="stamp pl-name">{name}</span>
        <span className="pl-sub">Off the plan</span>
      </span>
      <span className="pl-dist tnum">{mi(a.miles)} mi</span>
      <Status k="bonus" word={word} />
    </Pressable>
  );
};

/** A quiet day: `Rest`. Tap adds a session; a planned rest day also has a hold menu (add, move it, delete it). */
const EmptyRow = ({ date, rest }: { date: string; rest: Session | null }) => {
  const { log, add, move, toast, remove, restore, flip } = useRowKit();
  const items: ContextMenuItem[] | undefined = rest
    ? [
        { label: 'Add a session', icon: <Plus size={18} />, onSelect: () => add(date) },
        { label: 'Move rest day', icon: <ArrowRightLeft size={18} />, onSelect: () => move(date, rest) },
        {
          label: 'Delete rest day',
          destructive: true,
          icon: <Trash2 size={18} />,
          onSelect: () => {
            flip();
            remove.mutate(rest);
            haptics.delete();
            toast('Rest day deleted', { label: 'Undo', fn: () => (flip(), restore.mutate(rest)) });
          },
        },
      ]
    : undefined;
  return (
    <Pressable as="div" press="surface" className="pl-line is-rest" label={`${fmtDate('dowLong', date)}: rest. Add a session`} onPress={() => add(date)} holdMenu={items} menuLabel="Rest day actions">
      <span className="pl-tone" aria-hidden="true" />
      <span className="pl-main">
        <span className="pl-rest">Rest</span>
      </span>
      {date >= log.today ? <Plus size={18} className="pl-plus" aria-hidden="true" /> : null}
    </Pressable>
  );
};

/** One day: the date column (weekday, the number; today's in the accent disc) and its rows. The whole day takes a drop. */
const DayRow = ({ date }: { date: string }) => {
  const { log } = useRowKit();
  const t = log.today;
  const sessions = log.snap.sessionsOn(date);
  const training = sessions.filter(isTraining);
  const lead = heroSession(training);
  const ordered = lead ? [lead, ...training.filter((s) => s !== lead)] : [];
  const runs = log.snap.runsOn(date);
  const bonus = !training.some((s) => s.kind === 'run') && runs.length > 0;
  const rest = sessions.find((s) => s.kind === 'rest') ?? null;
  const isToday = date === t;
  return (
    <div className={`pl-day ${isToday ? 'is-today' : ''} ${date < t ? 'is-past' : ''}`.trim()} role="listitem" {...{ [PLAN_DAY]: date }}>
      <div className="pl-date" aria-hidden="true">
        <span className="pl-dow">{fmtDate('dow', date)}</span>
        <span className="pl-num tnum">{parseISO(date).getDate()}</span>
      </div>
      <div className="pl-lines">
        {ordered.map((s) => (
          <SessionRow key={s.id} date={date} s={s} />
        ))}
        {bonus ? <BonusRow date={date} runs={runs} /> : null}
        {!ordered.length && !bonus ? <EmptyRow date={date} rest={rest} /> : null}
      </div>
    </div>
  );
};

/** The inline question under a hard pair, inside the group: it fades in (150 ms); the rows below move by transform (flip.ts). */
const ConflictRow = ({ c, onKeep }: { c: Conflict; onKeep: () => void }) => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 150, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' });
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
  const flip = useFlip(group);
  const kit = useKit(log, flip, (r, to) => onReshaped(r, to));
  const { toast } = kit;
  const days = Array.from({ length: 7 }, (_, i) => shiftDays(mon, i));
  if (!log.loaded(mon) || !log.loaded(shiftDays(mon, 6)))
    return (
      <div className="pl-group pl-skel" aria-label="Loading the week" aria-busy="true">
        {days.map((d) => (
          <div key={d} className="pl-skel-row">
            <Skeleton w={28} h={32} r={8} />
            <Skeleton w="55%" h={18} r="line" />
          </div>
        ))}
      </div>
    );
  const onReshaped = (r: ReshapeResult, to: string) => {
    if (r.conflict) {
      haptics.warning();
      setConflict({
        days: r.conflict,
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
      <div ref={group} className="pl-group" role="list" aria-label={`Week of ${fmtDate('md', mon)}`}>
        {days.map((d) => (
          <Fragment key={d}>
            <DayRow date={d} />
            {conflict && conflict.days[1] === d ? (
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

/** One week page: the week line, the group, the block card. Memoised by its Monday (the pager re-renders none on a commit). */
export const WeekPage = memo(function WeekPage({ mon, onThisWeek, block }: { mon: string; onThisWeek: () => void; block: PlanBlockProps }) {
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
  return (
    <div className="pl-wpage">
      {log.loaded(mon) ? <WeekLine log={log} mon={mon} onThisWeek={onThisWeek} /> : <div className="pl-wl" aria-hidden="true" />}
      <WeekGroup mon={mon} log={log} conflict={conflict} setConflict={setConflict} />
      <BlockCardView data={block.data} getLog={block.getLog} />
    </div>
  );
});
