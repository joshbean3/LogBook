import { clock, dayPhase, decodePolyline, durationWords, fmtDate, floorFor, label, mi, mondayOf, relativeDay, routePath, shiftDays, weekSummary, type Activity, type DayPhase, type ISODate, type PhaseSession, type SessionMark } from '@logbook/shared';
import { CalendarPlus, Check, ChevronsDown, ExternalLink, HeartPulse, MoveRight, Share, SkipForward, Sunrise } from 'lucide-react';
import { animate, motion, useMotionValue, useReducedMotion } from 'motion/react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { useSessionMutations } from '@/api/queries';
import { haptics } from '@/lib/haptics';
import { springs } from '@/lib/motion';
import { ContextMenu, shared, Ticker, useFirstToday, useSheet, useToast, WeekRing, type ContextMenuItem } from '@/ui';
import type { Log } from '../log/useLog';
import { openMoveSheet } from '../sessions/MoveSheet';
import { useOpenWeek } from '../progress/sheets';
import { shareDataFor, useOpenSession, useOpenUnplanned } from '../sessions/SessionCard';
import { SessionEditor } from '../sessions/SessionEditor';
import { ShareSheet } from '../share/ShareSheet';
import { CloseDay } from './CloseDay';
import { doneVerdict, planLine, ringDays, runTotals, shortClock } from './dayWords';
import { HoldRing } from './HoldRing';
import { MiniTimeline, OutLine } from './MiniTimeline';

export type HeroState = 'morning' | 'out' | 'done' | 'open' | 'rest' | 'evening' | 'past' | 'future';
type Halo = 'done' | 'floor' | 'missed' | 'upcoming' | 'rest';

/** The phase of a day, with the clock passed in (the page's clock, `?at=` in dev). */
export const phaseOf = (log: Log, date: ISODate, minutes: number): DayPhase =>
  dayPhase({ date: log.today, minutes }, { date, snapshot: log.snap, settings: log.boot?.morningSettings ?? null, override: log.snap.morningOverride(date) });

const haloOf = (p: PhaseSession | null, hasRuns: boolean): Halo => {
  if (!p) return hasRuns ? 'done' : 'rest';
  switch (p.key) {
    case 'done':
    case 'bonus':
      return 'done';
    case 'floor':
      return 'floor';
    case 'missed':
    case 'skipped':
      return 'missed';
    case 'rest':
      return 'rest';
    default:
      return 'upcoming';
  }
};

/**
 * The ring in the hero's corner: the week around the shown day. Tap → the week sheet (the Progress team's, the app's one:
 * the ring large, miles and runs against the plan, the streak, and every session, each opening its own sheet).
 */
const HeroWeekRing = ({ date, log, still }: { date: ISODate; log: Log; still?: boolean }) => {
  const openWeek = useOpenWeek(log.today);
  const sum = useMemo(() => weekSummary(log.snap, mondayOf(date)), [log.snap, date]);
  const ti = sum.days.findIndex((d) => d.date === log.today);
  return <WeekRing days={ringDays(sum, log.today)} size={40} today={ti >= 0 ? ti : undefined} onceADay={still ? null : 'today-week-ring'} onPress={still ? undefined : () => openWeek(sum.weekStart)} />;
};

/** The session's name as the hero's label: a stamp, and the shared element that flies into the session sheet. */
const Stamp = ({ p, big, live, children }: { p: PhaseSession | null; big?: boolean; live: boolean; children?: ReactNode }) => (
  <span className={`stamp hero-stamp ${big ? 'big' : ''}`} {...(live && p ? shared(`session-${p.session.id}`) : {})}>
    {children ?? (p ? label(p.session) : '')}
  </span>
);

/** The route drawn on black, once a day per run (and again when a run lands while the page is open). */
const Route = ({ runs, drawKey }: { runs: Activity[]; drawKey: string | null }) => {
  const reduce = useReducedMotion();
  const first = useFirstToday(drawKey);
  const poly = runs.find((r) => r.polyline)?.polyline ?? null;
  const d = useMemo(() => (poly ? routePath(decodePolyline(poly), 358, 160, 12) : ''), [poly]);
  if (!d) return null;
  return (
    <svg className="hero-route" viewBox="0 0 358 160" aria-hidden="true">
      <motion.path d={d} fill="none" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" initial={first && !reduce ? { pathLength: 0 } : false} animate={{ pathLength: 1 }} transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }} />
    </svg>
  );
};

/** DISTANCE · PACE · TIME, ticking up once on the day's first view of this run. */
const RunStamps = ({ runs, tickKey }: { runs: Activity[]; tickKey: string | null }) => {
  const t = runTotals(runs);
  const paceSec = t.miles > 0.1 ? t.sec / t.miles : 0;
  return (
    <div className="aura-stats hero-stats">
      <span className="aura-stat">
        <span className="caps">Distance</span>
        <span className="stamp aura-num">
          <Ticker value={t.miles} format={mi} from={0} onceADay={tickKey ? `${tickKey}-mi` : undefined} />
          <small>mi</small>
        </span>
      </span>
      <span className="aura-stat">
        <span className="caps">Pace</span>
        <span className="stamp aura-num">
          {paceSec ? <Ticker value={paceSec} format={(v) => clock(v)} from={paceSec * 1.25} onceADay={tickKey ? `${tickKey}-pace` : undefined} /> : '—'}
          {paceSec ? <small>/mi</small> : null}
        </span>
      </span>
      <span className="aura-stat">
        <span className="caps">Time</span>
        <span className="stamp aura-num">
          <Ticker value={t.sec} format={(v) => clock(v)} from={0} onceADay={tickKey ? `${tickKey}-time` : undefined} />
        </span>
      </span>
    </div>
  );
};

/** The next session that is not rest or skipped, within a week after `date`. */
const nextSession = (log: Log, date: ISODate) =>
  Array.from({ length: 7 }, (_, i) => shiftDays(date, i + 1))
    .map((d) => ({ d, s: log.snap.sessionsOn(d).find((s) => s.kind !== 'rest' && s.mark !== 'skip' && s.mark !== 'sick') }))
    .find((x): x is { d: ISODate; s: NonNullable<typeof x.s> } => !!x.s) ?? null;

/**
 * What leads the hero on a day with no session today: tomorrow's session ("Tomorrow: Easy 4."), or, on a plan that has
 * not started yet (the first day after onboarding: nothing planned or run in the week behind today), the first one. Null
 * when the day should just say rest.
 */
const upNext = (log: Log, date: ISODate) => {
  if (date !== log.today) return null;
  const next = nextSession(log, date);
  if (!next) return null;
  const fresh = !Array.from({ length: 7 }, (_, i) => shiftDays(date, -1 - i)).some((d) => log.snap.sessionsOn(d).length || log.snap.activitiesOn(d).length);
  const tomorrow = next.d === shiftDays(date, 1);
  if (!tomorrow && !fresh) return null;
  return { ...next, fresh, when: tomorrow ? 'Tomorrow' : fmtDate('dowLong', next.d) };
};

interface FaceCtx {
  date: ISODate;
  log: Log;
  ph: DayPhase;
  live: boolean;
  onShare: () => void;
  onMorning: () => void;
  onOpen: (p: PhaseSession | null) => void;
  onComplete: (p: PhaseSession) => void;
}

/** One page of the hero: what this session (or this day) needs you to see now. */
const Face = ({ c, p, index }: { c: FaceCtx; p: PhaseSession | null; index: number }) => {
  const { ph, date, log, live } = c;
  const isToday = date === log.today;
  const runs = log.snap.runsOn(date);
  // runs belong to the run session (or to a day with nothing planned)
  const myRuns = !p || p.session.kind === 'run' ? runs : [];
  const lead = index === 0;

  if (isToday && lead && ph.phase === 'morning' && ph.doorAt != null && ph.backBy != null) {
    const n = ph.doorIn ?? 0;
    const stops = [
      { key: 'wake', label: 'Wake', at: ph.wakeAt ?? ph.doorAt },
      { key: 'door', label: 'Door', at: ph.doorAt },
      { key: 'back', label: 'Back', at: ph.backBy },
      { key: 'leave', label: 'Leave', at: ph.leaveAt ?? ph.backBy },
    ];
    return (
      <div className="hero-face">
        <Stamp p={p} live={live} />
        <h2 className="hero-line display">
          Out the door in{' '}
          {n < 60 ? (
            <>
              <Ticker value={n} /> min
            </>
          ) : (
            durationWords(n)
          )}
        </h2>
        <MiniTimeline stops={stops} now={ph.now} onPress={c.onMorning} label={`Morning timeline: wake ${shortClock(stops[0]!.at)}, out the door ${shortClock(ph.doorAt)}, back ${shortClock(ph.backBy)}, leave ${shortClock(stops[3]!.at)}. Open Morning`} />
      </div>
    );
  }
  if (isToday && lead && ph.phase === 'out' && ph.doorAt != null && ph.backBy != null) {
    return (
      <div className="hero-face">
        <Stamp p={p} live={live} />
        <h2 className="hero-line display">Back by {shortClock(ph.backBy)}</h2>
        <OutLine door={ph.doorAt} back={ph.backBy} progress={ph.outProgress ?? 0} />
      </div>
    );
  }
  // done or at the floor, or a run off the plan
  if ((p && (p.key === 'done' || p.key === 'floor')) || (!p && runs.length)) {
    const drawKey = live && myRuns[0] ? `route-${myRuns[0].id}` : null;
    return (
      <div className="hero-face">
        <div className="hero-labelrow">
          <Stamp p={p} live={live}>
            {p ? undefined : 'Bonus run'}
          </Stamp>
          <span className={`hero-word k-${p?.key ?? 'bonus'}`}>{p?.word ?? 'Bonus'}</span>
        </div>
        <Route runs={myRuns} drawKey={drawKey} />
        <h2 className="hero-line display">{doneVerdict(p, myRuns)}</h2>
        {myRuns.length ? <RunStamps runs={myRuns} tickKey={drawKey} /> : p ? <p className="hero-plan">{planLine(p.session, '') || label(p.session)}</p> : null}
        {myRuns.length && live ? (
          <button
            type="button"
            className="aura-share hero-share"
            onClick={(e) => {
              e.stopPropagation();
              c.onShare();
            }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <Share size={14} strokeWidth={2.25} aria-hidden="true" /> Share
          </button>
        ) : null}
      </div>
    );
  }
  if (!p) {
    // nothing planned: rest, said as a fact that counts
    const next = nextSession(log, date);
    const up = upNext(log, date);
    if (up) {
      // what comes next leads: "Tomorrow: Easy 4." and its door time from that morning's timeline
      const nph = phaseOf(log, up.d, ph.now);
      const block = up.s.blockId ? log.boot?.blocks.find((b) => b.id === up.s.blockId) : null;
      return (
        <div className="hero-face hero-next">
          <span className="caps hero-eyebrow">{up.fresh ? (block?.name ?? 'Your plan') : 'Rest day'}</span>
          <h2 className="hero-line display">
            {up.when}: {label(up.s)}.
          </h2>
          {up.fresh ? null : <p className="hero-plan hero-rest-line">Rest. It counts.</p>}
          {nph.doorAt != null ? <p className="hero-sub">Out the door {shortClock(nph.doorAt)}.</p> : null}
        </div>
      );
    }
    return (
      <div className="hero-face">
        <span className="caps hero-eyebrow">{isToday ? 'Rest day' : date < log.today ? relativeDay(date, log.today) : `${relativeDay(date, log.today)} · Rest`}</span>
        <h2 className="hero-line display big">{date < log.today ? 'Rested. It counted.' : 'Rest. It counts.'}</h2>
        {next?.s ? <p className="hero-plan">Next: {label(next.s)}, {relativeDay(next.d, log.today).toLowerCase() === 'tomorrow' ? 'tomorrow' : relativeDay(next.d, log.today)}.</p> : null}
      </div>
    );
  }
  const floor = floorFor(p.session);
  if (isToday && p.key === 'today') {
    return (
      <div className="hero-face hero-open">
        <div className="hero-open-text">
          <span className="caps hero-eyebrow">{p.session.kind === 'run' ? 'Today’s run' : p.session.kind === 'lift' ? 'Today’s lift' : 'Today'}</span>
          <Stamp p={p} big live={live} />
          <p className="hero-plan">{planLine(p.session, floor)}</p>
        </div>
        <span className="hold-wrap">
          {live ? <HoldRing label={`Hold to mark ${label(p.session)} done`} onComplete={() => c.onComplete(p)} onTap={() => c.onOpen(p)} /> : <span className="hold-ring ghost" aria-hidden="true" />}
          <span className="caps hold-cap" aria-hidden="true">
            Hold
          </span>
        </span>
      </div>
    );
  }
  // another day, quieter: what was, or what is coming
  const future = date > log.today;
  return (
    <div className="hero-face hero-quiet">
      <div className="hero-labelrow">
        <span className="caps hero-eyebrow">{relativeDay(date, log.today)}</span>
      </div>
      <Stamp p={p} big live={live} />
      <p className="hero-plan">
        {future ? planLine(p.session, floor) : p.key === 'missed' ? 'Missed. The week still counts.' : p.key === 'skipped' ? (p.session.mark === 'sick' ? 'Skipped to recover. It counts for the week.' : 'Skipped.') : p.word}
      </p>
      {future && lead && ph.doorAt != null ? <p className="hero-sub">Out the door {shortClock(ph.doorAt)}.</p> : null}
    </div>
  );
};

/**
 * Pull the morning hero down to open the full Morning timeline. The hero follows the finger (rubber-banded), passes a line
 * with `haptics.threshold()`, and pushes /morning on release. The touch stops at the hero, so the page's pull to refresh does
 * not run underneath it.
 */
const usePullToMorning = (enabled: boolean, onCommit: () => void) => {
  const ref = useRef<HTMLDivElement>(null);
  const y = useMotionValue(0);
  const fire = useRef(onCommit);
  fire.current = onCommit;
  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;
    const LINE = 56;
    let s: { x: number; y: number; on: boolean; armed: boolean } | null = null;
    const start = (e: TouchEvent) => {
      e.stopPropagation();
      if (e.touches.length !== 1 || window.scrollY > 0) return void (s = null);
      s = { x: e.touches[0]!.clientX, y: e.touches[0]!.clientY, on: false, armed: false };
    };
    const move = (e: TouchEvent) => {
      if (!s) return;
      const dx = e.touches[0]!.clientX - s.x;
      const dy = e.touches[0]!.clientY - s.y;
      if (!s.on) {
        if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
        if (dy <= 0 || Math.abs(dx) > dy) return void (s = null);
        s.on = true;
      }
      if (e.cancelable) e.preventDefault();
      const v = Math.max(0, dy);
      y.set(v < LINE ? v * 0.6 : LINE * 0.6 + (v - LINE) * 0.2);
      const over = v >= LINE;
      if (over !== s.armed) {
        s.armed = over;
        if (over) haptics.threshold();
      }
    };
    const end = () => {
      const go = s?.on && s.armed;
      s = null;
      void animate(y, 0, springs.settle);
      if (go) fire.current();
    };
    el.addEventListener('touchstart', start, { passive: true });
    el.addEventListener('touchmove', move, { passive: false });
    el.addEventListener('touchend', end);
    el.addEventListener('touchcancel', end);
    return () => {
      el.removeEventListener('touchstart', start);
      el.removeEventListener('touchmove', move);
      el.removeEventListener('touchend', end);
      el.removeEventListener('touchcancel', end);
    };
  }, [enabled, y]);
  return { ref, y };
};

/**
 * The time-aware hero (docs/experience.md §5.1). One card, lit from below, whose content follows `dayPhase`: the countdown
 * and mini timeline before the door, "Back by" while out, the route and stamps once the run lands, the hold-to-complete
 * ring for a session still open, rest as a fact that counts, Close the day in the evening, and a quieter look back or ahead
 * on other days. Two sessions page inside it, with dots. The week ring sits in its corner. `live` is false for the
 * neighbouring days drawn beside it while the date pager moves: those are still and claim no shared ids or daily moments.
 */
export const Hero = ({ date, log, minutes, live }: { date: ISODate; log: Log; minutes: number; live: boolean }) => {
  const ph = useMemo(() => phaseOf(log, date, minutes), [log, date, minutes]);
  const nav = useNavigate();
  const sheet = useSheet();
  const toast = useToast();
  const openSession = useOpenSession(log);
  const openUnplanned = useOpenUnplanned();
  const { mark } = useSessionMutations();
  const [page, setPage] = useState(0);
  const [boost, setBoost] = useState(false);
  const isToday = date === log.today;
  const runs = log.snap.runsOn(date);
  const pages: Array<PhaseSession | null> = ph.training.length ? ph.training : [ph.primary && ph.primary.session.kind !== 'rest' ? ph.primary : null];
  const cur = pages[Math.min(page, pages.length - 1)] ?? null;
  const loaded = log.loaded(date);

  // a run that lands while the page is open: the route draws (a new run, a new key), the numbers tick, one Success
  const seenRuns = useRef<number | null>(null);
  useEffect(() => {
    if (!live || !isToday || !loaded) return;
    if (seenRuns.current != null && runs.length > seenRuns.current) {
      haptics.success();
      setBoost(true);
    }
    seenRuns.current = runs.length;
  }, [live, isToday, loaded, runs.length]);
  useEffect(() => {
    if (!boost) return;
    const t = setTimeout(() => setBoost(false), 650);
    return () => clearTimeout(t);
  }, [boost]);

  const morningPath = isToday ? '/morning' : `/morning/${date}`;
  const open = (p: PhaseSession | null) => {
    // the stamp carries `session-<id>` (see Stamp): the hero's title flies into the sheet's
    if (p) openSession(date, p.session, { fromHero: true, sharedId: `session-${p.session.id}` });
    else if (runs.length) openUnplanned(date, runs, log);
  };
  const share = () => sheet.open({ title: 'Share', body: <ShareSheet data={shareDataFor(date, cur?.session ?? null, runs, log)} /> });
  const setMark = (p: PhaseSession, m: SessionMark | null, word?: string) => {
    const was = p.session.mark;
    mark.mutate({ session: p.session, mark: m });
    if (word) toast(word, { label: 'Undo', fn: () => mark.mutate({ session: { ...p.session, mark: m }, mark: was }) });
  };
  /** the click that ends a completing hold lands on the new face: it is not a tap */
  const quietUntil = useRef(0);
  const complete = (p: PhaseSession) => {
    // the ring fired Success at its peak; the halo brightens for the day's first completion
    quietUntil.current = Date.now() + 700;
    setMark(p, 'done');
    setBoost(true);
  };
  const c: FaceCtx = { date, log, ph, live, onShare: share, onMorning: () => nav(morningPath), onOpen: open, onComplete: complete };

  const evening = isToday && ph.phase === 'evening';
  const pull = usePullToMorning(live && isToday && (ph.phase === 'morning' || ph.phase === 'out'), () => nav(morningPath));

  const items: ContextMenuItem[] = [];
  if (cur) {
    items.push({ label: 'Open', icon: <ExternalLink size={18} />, onSelect: () => open(cur) });
    if (cur.key === 'today' || cur.key === 'missed' || cur.key === 'skipped')
      items.push(
        { label: 'Done', icon: <Check size={18} />, onSelect: () => (haptics.success(), complete(cur)) },
        { label: 'Floor', icon: <ChevronsDown size={18} />, onSelect: () => (haptics.toggle(), setMark(cur, 'floor')) },
      );
    if (cur.key === 'today' || cur.key === 'planned') {
      items.push({ label: 'Skip', icon: <SkipForward size={18} />, onSelect: () => setMark(cur, 'skip', 'Skipped') });
      items.push({ label: 'Not feeling 100%', icon: <HeartPulse size={18} />, onSelect: () => setMark(cur, 'sick', 'Skipped to recover. The week still counts.') });
      items.push({ label: 'Move', icon: <MoveRight size={18} />, onSelect: () => openMoveSheet(sheet, date, cur.session) });
    }
  }
  if (runs.length) items.push({ label: 'Share', icon: <Share size={18} />, onSelect: share });
  if (isToday) items.push({ label: 'Morning', icon: <Sunrise size={18} />, onSelect: () => nav(morningPath) });
  items.push({ label: 'Add a session', icon: <CalendarPlus size={18} />, onSelect: () => sheet.open({ title: 'Add session', body: <SessionEditor date={date} session={null} /> }) });

  const corner = <HeroWeekRing date={date} log={log} still={!live} />;
  if (evening)
    return (
      <div className="hero-slot">
        <CloseDay date={date} log={log} ph={ph} onOpenSession={open} still={!live} corner={<span className="hero-corner-in">{corner}</span>} asHero />
      </div>
    );

  const halo = haloOf(cur, runs.length > 0);
  // a rest day led by tomorrow's session: the card opens that session
  const up = !cur && !runs.length ? upNext(log, date) : null;
  const pressable = !!cur || runs.length > 0 || !!up;
  const name = cur ? `${label(cur.session)}, ${cur.word}` : runs.length ? 'Bonus run' : up ? `${up.when}: ${label(up.s)}` : 'Rest day';
  const openHero = () => (up ? openSession(up.d, up.s) : open(cur));
  return (
    <div className="hero-slot">
      <ContextMenu items={items} label={name} disabled={!live}>
        <motion.div
          ref={pull.ref}
          style={{ y: pull.y }}
          className={`aura today-hero halo-${halo} ${boost ? 'halo-boost' : ''} ${pressable ? 'is-pressable' : ''} ${!isToday ? 'is-other' : ''}`}
          role={pressable ? 'button' : 'group'}
          tabIndex={pressable && live ? 0 : undefined}
          aria-label={pressable ? `${name}. Open` : name}
          onClick={(e) => {
            if (!pressable || !live || Date.now() < quietUntil.current || (e.target as HTMLElement).closest('button, a, textarea, input')) return;
            openHero();
          }}
          onKeyDown={(e) => {
            if (!pressable || e.target !== e.currentTarget) return;
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              openHero();
            }
          }}
          whileTap={pressable && live ? { scale: 0.985 } : undefined}
          transition={springs.press}
        >
          <span className="aura-glow" aria-hidden="true" />
          <span className="hero-corner" onPointerDown={(e) => e.stopPropagation()}>
            {corner}
          </span>
          {pages.length > 1 ? (
            <>
              <div
                className="hero-pages"
                onPointerDown={(e) => e.stopPropagation()}
                onScroll={(e) => {
                  const el = e.currentTarget;
                  const i = Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
                  if (i !== page) {
                    setPage(i);
                    haptics.select();
                  }
                }}
              >
                {pages.map((p, i) => (
                  <div key={p?.session.id ?? i} className="hero-page" aria-hidden={i !== page || undefined}>
                    <Face c={{ ...c, live: live && i === page }} p={p} index={i} />
                  </div>
                ))}
              </div>
              <div className="hero-dots" role="tablist" aria-label="Sessions">
                {pages.map((p, i) => (
                  <button
                    key={p?.session.id ?? i}
                    type="button"
                    role="tab"
                    aria-selected={i === page}
                    aria-label={p ? label(p.session) : 'Day'}
                    className={`hero-dot ${i === page ? 'on' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      const el = (e.currentTarget.parentElement?.previousElementSibling as HTMLElement | null) ?? null;
                      el?.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' });
                    }}
                  >
                    <i />
                  </button>
                ))}
              </div>
            </>
          ) : (
            <Face c={c} p={cur} index={0} />
          )}
        </motion.div>
      </ContextMenu>
    </div>
  );
};
