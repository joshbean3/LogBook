import { assess, clock, clockOfDay, counts, decodePolyline, e1rm, isAutoStatus, floorFor, fmtDate, label, METERS_PER_MILE, mi, mondayOf, monthOf, MORNING_DEFAULTS, num, routePath, sessionKey, sessionStatus, sessionWord, shiftDays, STATUS_WORDS, tone, weekTotals, zoneOf, type Activity, type Session, type StatusKey } from '@logbook/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowRightLeft, Check, ChevronRight, MoreHorizontal, Pencil, Share2, SkipForward, Sparkles } from 'lucide-react';
import { AnimatePresence, motion, useMotionValue, useReducedMotion } from 'motion/react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { api, ApiError } from '@/api/client';
import { keys, useSessionMutations } from '@/api/queries';
import { haptics } from '@/lib/haptics';
import { ease } from '@/lib/motion';
import { DROP_SPRING, getDragInfo, hitDropDay, INSTANT, LIFT, REST, setDragInfo, SLOP, useDragInfo, useDropDays, useDropOver, useHoldDrag } from '@/lib/useDrag';
import type { MonthBundle } from '@/api/types';
import { useContextMenu } from '@/ui/ContextMenu';
import { Button, Chip, ChipButton, DayStrip, Mark } from '@/ui/primitives';
import { useSheet, type SheetSpec } from '@/ui/Sheet';
import { useToast } from '@/ui/Toast';
import { useFirstToday } from '@/ui/useFirstToday';
import { useLog, type Log } from '../log/useLog';
import { doorOf, morningOf } from '../morning/model';
import type { ShareData, ShareDayType } from '../share/cards';
import { sessionCan, useSessionActions } from './actions';
import { LiftLog } from './LiftLog';
import { openMoveSheet } from './MoveSheet';
import { dayMiles, sessionMiles } from './miles';
import { SessionEditor } from './SessionEditor';
import { voiceHead, voiceLine } from './voice';
import './sessions.css';

/** One line that says what the session is: "Easy · 6 mi · 1.5 mi wu". The floor is explained in the sheet, never in the row. */
export const sessionMeta = (s: Session, _st?: string): string => {
  const bits: string[] = [];
  const lbl = label(s).toLowerCase();
  if (s.type && !lbl.includes(s.type.toLowerCase())) bits.push(s.type);
  if (s.kind === 'run' && s.miles && !lbl.includes(num(s.miles))) bits.push(`${num(s.miles)} mi`);
  if (s.minutes) bits.push(`${s.minutes} min`);
  if (s.details) bits.push(s.details);
  return bits.join(' · ');
};

const short = (m: number) => clockOfDay(m).replace(' AM', '').replace(' PM', '');
/** "14:38" → "2:38 PM": one time format across the app (audit §3.2). */
export const startClock = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h == null || m == null || Number.isNaN(h) || Number.isNaN(m) ? hhmm : clockOfDay(h * 60 + m);
};

/** The chip class for a status key: the colours `.chip` already has. */
export const chipKind = (k: StatusKey): string => ({ done: 'done', bonus: 'done', floor: 'floor', missed: 'missed', today: 'open', planned: 'upcoming', skipped: '', rest: '' })[k];

/** caps label, the number, its unit, and an optional small line under it ("of 6") */
type SheetStat = [string, string, string?, string?];

const Stats = ({ stats }: { stats: SheetStat[] }) =>
  stats.length ? (
    <div className="sh-stats" role="list" aria-label="Summary">
      {stats.map(([k, v, u, n]) => (
        <span key={k} className="sh-stat" role="listitem">
          <span className="caps">{k}</span>
          <span className="stamp sh-num">
            {v}
            {u ? <small>{u}</small> : null}
          </span>
          {n ? <span className="sh-note">{n}</span> : null}
        </span>
      ))}
    </div>
  ) : null;

/** The day's verdict in the brand voice: "Floor held." / "Easy 6, done." / "6.0 mi, off the plan." */
const runVerdict = (sess: Session | null, runs: Activity[], miles: number, status: string): string => {
  if (status === 'floor') return 'Floor held.';
  if (sess) return `${label(sess)}, done.`;
  return runs.length > 1 ? `${mi(miles)} mi across ${runs.length} runs.` : `${mi(miles)} mi, off the plan.`;
};

/** The run miles the plan asked for on this day, 0 when it named none. */
export const plannedMiles = (s: Session | null | undefined): number => (s?.kind === 'run' ? Number(s.miles) || 0 : 0);

/** A finished run's numbers: DISTANCE (what happened, "of 6" under it) / PACE / TIME / AVG HR. */
const runStats = (sess: Session | null, runs: Activity[], log: Log): SheetStat[] => {
  const a = assess(log.zones, sess, runs);
  const planned = plannedMiles(sess);
  return [
    ['Distance', mi(a.miles), 'mi', planned ? `of ${num(planned)}` : undefined],
    ['Pace', a.pace ?? '—', a.pace ? '/mi' : undefined],
    ['Time', clock(a.movingSec)],
    ['Avg HR', a.avgHr != null ? String(a.avgHr) : '—', a.avgHr != null ? 'bpm' : undefined],
  ];
};

/** A planned session's numbers: PLAN / FLOOR / OUT / BACK when known (SETS for a lift). */
const planStats = (date: string, s: Session, log: Log, sets: number): SheetStat[] => {
  const floor = floorFor(s);
  const mm = /(\d+)\s*min/.exec(floor);
  const stats: SheetStat[] = [];
  if (s.kind === 'rest') return stats;
  if (s.kind === 'run' && s.miles) stats.push(['Plan', num(s.miles), 'mi']);
  else if (s.minutes) stats.push(['Plan', String(s.minutes), 'min']);
  if (floor) stats.push(mm ? ['Floor', mm[1]!, 'min'] : ['Floor', floor.split(/[,\s]/)[0]!]);
  // the door time is the morning timeline's own (Today's hero and Morning read the same `doorOf`), never worked out here
  if (date >= log.today && log.boot) {
    const sessions = log.snap.sessionsOn(date);
    const main = sessions.find((x) => x.kind === 'run') ?? sessions.find((x) => x.kind !== 'rest');
    if (main?.id === s.id) {
      const T = morningOf(sessions, log.snap.morningOverride(date), log.boot.morningSettings ?? MORNING_DEFAULTS);
      const door = doorOf(T);
      // "Out at": four caps labels share one baseline at 320 ("Out the door" wrapped to two lines); the sentence elsewhere keeps "Out the door"
      if (door != null) stats.push(['Out at', short(door)], ['Back', short(T.back)]);
    }
  }
  if (sets) stats.push(['Sets', String(sets)]);
  return stats;
};

const weekdayLong = (d: string) => new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(new Date(`${d}T12:00:00`));

/**
 * Everything a share card needs: the kind of day (it picks the cards), its title, the run when there was one (an activity,
 * or a run marked Done by hand at its planned miles: contract 5's `sessionMiles`), the sets, the habits lit, the day's words,
 * and the week around it, counted the same way.
 */
export const shareDataFor = (date: string, sess: Session | null, runs: Activity[], log: Log): ShareData => {
  const a = assess(log.zones, sess, runs);
  const snap = log.snap;
  const status = sess ? sessionStatus(snap, date, sess) : 'done';
  const monday = mondayOf(date);
  const wt = weekTotals(snap, monday);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = shiftDays(monday, i);
    return { date: d, miles: d <= log.today ? dayMiles(snap, d).miles : 0 };
  });
  // the miles: the activities when there are any, else this session's (or the day's) logged miles
  const miles = runs.length ? a.miles : sess?.kind === 'run' ? sessionMiles(snap, date, sess).miles : sess ? 0 : dayMiles(snap, date).miles;
  const training = snap.sessionsOn(date).filter((x) => x.kind !== 'rest');
  const sets = snap.liftsOn(date);
  const lifted = sets.length > 0 || training.some((x) => x.kind !== 'run' && counts(sessionStatus(snap, date, x)));
  const entries = snap.journalOn(date);
  const words = entries[0]?.text.replace(/\s+/g, ' ').trim() ?? '';
  const journal = words ? (words.length > 120 ? `${words.slice(0, 119).replace(/\s+\S*$/, '')}…` : words) : null;
  const hs = log.habits.filter((h) => h.createdOn <= date);
  const habits = hs.length ? { lit: hs.filter((h) => snap.isHabitDone(date, h.id)).length, of: hs.length } : null;
  const plannedSomething = training.some((x) => sessionStatus(snap, date, x) !== 'skipped');
  // a day whose sessions were all skipped is a skipped day, never "Rest": it says so in the shared status word
  const skippedAll = training.length > 0 && !plannedSomething;
  const skippedSess = skippedAll ? (sess && training.some((x) => x.id === sess.id) ? sess : training[0]!) : null;
  const dayType: ShareDayType = miles > 0 ? 'run' : lifted ? 'lift' : !plannedSomething && !skippedAll ? 'rest' : 'journal';
  let top: string | null = null;
  if (sets.length) {
    const best = sets.reduce((b, x) => (e1rm(x.weight, x.reps) > e1rm(b.weight, b.reps) ? x : b));
    top = `${best.exercise} ${best.weight} × ${best.reps}`;
  }
  const liftSess = training.find((x) => x.kind === 'lift') ?? (sess && sess.kind !== 'run' ? sess : null);
  const name =
    dayType === 'run'
      ? runs.length === 1
        ? runs[0]!.name
        : sess?.kind === 'run'
          ? label(sess)
          : runs.length
            ? `${runs.length} runs`
            : label(training.find((x) => x.kind === 'run') ?? null) || 'Run'
      : dayType === 'lift'
        ? liftSess?.type || 'Strength'
        : dayType === 'rest'
          ? 'Rest'
          : skippedSess
            ? `${label(skippedSess)} · ${STATUS_WORDS.skipped}`
            : weekdayLong(date);
  const verdict =
    dayType === 'run'
      ? runs.length
        ? runVerdict(sess, runs, a.miles, status)
        : `${mi(miles)} mi. ${status === 'floor' ? 'Floor held.' : 'Done.'}`
      : dayType === 'lift'
        ? sets.length
          ? `${sets.length} ${sets.length === 1 ? 'set' : 'sets'}. Lifted.`
          : 'Lifted. Logged.'
        : dayType === 'rest'
          ? 'Rest. It counts.'
          : skippedSess
            ? skippedSess.mark === 'sick'
              ? 'Rested to recover. It counts for the week.'
              : 'The week still counts.'
            : `${weekdayLong(date)}, written down.`;
  return {
    name,
    label: sess ? label(sess) : null,
    verdict,
    date,
    time: runs[0]?.time ?? null,
    miles,
    movingSec: runs.length ? a.movingSec : 0,
    elevFt: runs.reduce((t, r) => t + r.elevFt, 0),
    avgHr: runs.length ? a.avgHr : null,
    polyline: runs.find((r) => r.polyline)?.polyline ?? null,
    week: { monday, days, total: days.reduce((t, d) => t + d.miles, 0), planned: wt.planned },
    dayType,
    habits,
    journal,
    lift: dayType === 'lift' ? { sets: sets.length, top } : null,
  };
};

/** The share data for a run session when there is something to share (an activity, or a run marked Done by hand), else null. */
export const shareFor = (date: string, s: Session, log: Log): ShareData | null => {
  if (s.kind !== 'run') return null;
  const runs = log.snap.runsOn(date);
  return runs.length || sessionMiles(log.snap, date, s).miles > 0 ? shareDataFor(date, s, runs, log) : null;
};

/** What happened, graded against the plan: who ran it and when, splits, the read, the coach. */
export const SessionActual = ({ date, sess, runs, log }: { date: string; sess: Session | null; runs: Activity[]; log: Log }) => {
  const a = assess(log.zones, sess, runs);
  const laps = runs.flatMap((r) => r.laps ?? []).filter((l) => l[0] > 160);
  const key = sess ? sess.id : 'run';
  const saved = log.snap.coachOn(date, key);
  const qc = useQueryClient();
  const toast = useToast();
  const coach = useMutation({
    mutationFn: () => api<{ date: string; key: string; text: string; createdAt: string }>('/coach/read', { method: 'POST', json: { date, sessionId: sess?.id ?? null } }),
    onSuccess: (r) => qc.setQueryData<MonthBundle>(keys.month(monthOf(date)), (b) => (b ? { ...b, coach: [...b.coach.filter((c) => !(c.date === date && c.key === key)), r] } : b)),
    onError: (e) => toast(e instanceof ApiError ? e.message : 'Couldn’t get the coach’s read.'),
  });
  const fastest = laps.length ? Math.min(...laps.map((l) => l[1] / (l[0] / METERS_PER_MILE))) : 0;
  const slowest = laps.length ? Math.max(...laps.map((l) => l[1] / (l[0] / METERS_PER_MILE))) : 0;
  const za = a.avgHr != null ? zoneOf(log.zones, a.avgHr) : null;
  const starts = runs.map((r) => r.time).filter((t): t is string => !!t);
  const line = [
    // the run's own name, when the sheet's title is the plan's
    sess && runs.length === 1 ? runs[0]!.name : null,
    starts.length ? `Started ${starts.map(startClock).join(' and ')}` : null,
    runs.length > 1 ? `${runs.length} runs combined` : null,
    za ? `Z${za} average` : null,
    a.maxHr != null ? `max ${a.maxHr} bpm` : null,
    runs[0]?.cadence ? `${runs[0].cadence} spm` : null,
    runs.some((r) => r.elevFt) ? `${runs.reduce((t, r) => t + r.elevFt, 0)} ft up` : null,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <div className="actual">
      <p className="fine">{line}</p>
      {a.avgHr == null && runs.some((r) => !r.perfAt) ? <p className="fine">Heart rate and splits are on their way.</p> : null}
      {laps.length > 1 ? (
        <div className="splits" aria-label="Mile splits">
          {laps.map((l, i) => {
            const part = l[0] < 0.9 * METERS_PER_MILE;
            const z = l[2] != null ? zoneOf(log.zones, l[2]) : null;
            const p = l[1] / (l[0] / METERS_PER_MILE);
            // the fastest mile gets the longest bar
            const w = slowest === fastest ? 1 : 0.35 + 0.65 * (1 - (p - fastest) / (slowest - fastest));
            return (
              <div key={i} className={`split ${z ? `sz${z}` : ''} ${part ? 'part' : ''}`}>
                <span className="split-n">{part ? mi(l[0] / METERS_PER_MILE) : i + 1}</span>
                <span className="split-bar">
                  <i style={{ width: `${w * 100}%` }} />
                </span>
                <span className="split-pace">{clock(p)}</span>
                <span className="split-hr">{l[2] != null ? l[2] : ''}</span>
              </div>
            );
          })}
        </div>
      ) : null}
      {a.lines.length ? (
        <div className={`assess v-${a.verdict}`}>
          {sess ? <div className="assess-head">{voiceHead(a.head)}</div> : null}
          <ul>
            {a.lines.map((x) => (
              <li key={x}>{voiceLine(x)}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {log.features.claude ? (
        saved ? (
          <div className="coach">
            <span className="caps row" style={{ gap: 6 }}>
              <Sparkles size={12} /> Coach’s read
            </span>
            <p className="serif">{saved}</p>
            <button type="button" className="link sm" disabled={coach.isPending} onClick={() => coach.mutate()}>
              {coach.isPending ? 'Asking…' : 'Ask again'}
            </button>
          </div>
        ) : (
          <ChipButton onClick={() => coach.mutate()} disabled={coach.isPending}>
            <Sparkles size={14} />
            {coach.isPending ? 'Reading the run…' : 'Coach’s read'}
          </ChipButton>
        )
      ) : null}
    </div>
  );
};

/** The route at the top of the sheet, on black; it draws itself the first time it is seen today. */
export const RouteMap = ({ polyline, drawKey }: { polyline: string; drawKey: string }) => {
  const reduce = useReducedMotion();
  const first = useFirstToday(`route-sheet-${drawKey}`);
  const d = useMemo(() => routePath(decodePolyline(polyline), 358, 168, 14), [polyline]);
  if (!d) return null;
  return (
    <div className="ss-map" aria-hidden="true">
      <svg viewBox="0 0 358 168" preserveAspectRatio="xMidYMid meet">
        <path d={d} className="ss-map-glow" />
        <motion.path d={d} className="ss-map-line" initial={first && !reduce ? { pathLength: 0 } : false} animate={{ pathLength: 1 }} transition={{ duration: 1.1, ease }} />
      </svg>
    </div>
  );
};

/**
 * The session sheet's ⋯, in the sheet header's action slot (`SheetSpec.action`): Share, "Not feeling 100%" and Delete as a
 * context menu under the button (the same menu, destructive last and red, that a long-press opens elsewhere). It reads
 * the session live, like the sheet's body, so a mark made in the sheet changes what it offers.
 */
const SessionMore = ({ date, id }: { date: string; id: string }) => {
  const log = useLog([monthOf(date)]);
  const act = useSessionActions(log);
  const menu = useContextMenu();
  const btn = useRef<HTMLButtonElement>(null);
  const s = log.snap.sessionsOn(date).find((x) => x.id === id);
  if (!s) return null;
  const share = shareFor(date, s, log);
  const name = s.kind === 'rest' ? 'Rest' : label(s);
  const items = act.menuItems(date, s, { share, push: true }).filter((i) => i.label === 'Not feeling 100%' || i.label === 'Share' || i.destructive);
  if (!items.length) return null;
  return (
    <button
      ref={btn}
      type="button"
      className="icon-btn"
      aria-label={`More for ${name}`}
      title="More"
      aria-haspopup="menu"
      onClick={() => {
        const el = btn.current;
        // a tap opens a menu: no haptic, nothing lifts; focus comes back to the button
        if (el) menu.open({ items, anchor: el.getBoundingClientRect(), label: `${name} actions`, returnFocus: el, haptic: false });
      }}
    >
      <MoreHorizontal size={22} aria-hidden="true" />
    </button>
  );
};

/**
 * The session, in full. Its name is the sheet's title (it flew in from the row or the hero), the route sits at the top when
 * there is one, then the two verbs that matter: Done (the one blue) and Floor, 48px. Skip, Move and Edit sit under them;
 * Move and Edit push inside the sheet. Delete and "Not feeling 100%" live in the header's ⋯ (`SessionMore`). The evidence (splits, the
 * read, started · HR · cadence · elevation) follows.
 */
const SessionSheet = ({ date, id }: { date: string; id: string }) => {
  // the sheet body is captured once at open; subscribing here keeps marks, sets and deletes live while it is up
  const log = useLog([monthOf(date)]);
  const sheet = useSheet();
  const act = useSessionActions(log);
  const [liftOpen, setLiftOpen] = useState(false);
  const s = log.snap.sessionsOn(date).find((x) => x.id === id);
  const gone = !s && log.loaded(date);
  useEffect(() => {
    if (gone) sheet.close();
  }, [gone, sheet]);
  // the title is the session's name as it is now: an Edit (4 → 4.5 mi) renames the sheet when it pops back here
  const title = s ? (s.kind === 'rest' ? 'Rest' : label(s)) : null;
  useEffect(() => {
    if (title) sheet.update({ title });
  }, [title]); // eslint-disable-line react-hooks/exhaustive-deps
  const runs = s?.kind === 'run' ? log.snap.runsOn(date) : [];
  // a run with an activity, or one marked Done by hand (its planned miles, contract 5), can be shared
  const share = useMemo(() => (s && s.kind === 'run' && (runs.length || sessionMiles(log.snap, date, s).miles > 0) ? shareDataFor(date, s, runs, log) : null), [date, s, runs, log]);
  if (!s) return null;
  const c = sessionCan(log, date, s);
  const st = c.st;
  const key = sessionKey(log.snap, date, s);
  const word = sessionWord(log.snap, date, s);
  const sets = log.snap.liftsOn(date);
  const others = log.snap.activitiesOn(date).filter((a) => a.kind !== 'run');
  const canLog = s.kind === 'lift' || (s.kind === 'cross' && /hyrox/i.test(s.type ?? ''));
  const stats = runs.length ? runStats(s, runs, log) : planStats(date, s, log, s.kind === 'lift' ? sets.length : 0);
  const poly = runs.find((r) => r.polyline)?.polyline;
  const meta = sessionMeta(s);
  const floorText = floorFor(s);
  return (
    <div className={`ss t-${tone(s)}`}>
      {poly ? <RouteMap polyline={poly} drawKey={s.id} /> : null}
      <div className="ss-status">
        <Chip kind={chipKind(key)}>{word}</Chip>
        {s.movedFrom ? <span className="t-sub ink3">Moved from {fmtDate('md', s.movedFrom)}</span> : null}
      </div>
      {meta ? <p className="t-sub ink2 ss-meta">{meta}</p> : null}
      <Stats stats={stats} />
      {c.mark ? (
        <div className="ss-verbs" role="group" aria-label="Mark it">
          <button type="button" className={`ss-big done ${st === 'done' ? 'is-on' : ''}`} aria-pressed={st === 'done'} onClick={() => (st === 'done' ? act.clear(s) : act.done(s))}>
            <Check size={20} strokeWidth={2.6} aria-hidden="true" />
            Done
          </button>
          <button type="button" className={`ss-big floor ${st === 'floor' ? 'is-on' : ''}`} aria-pressed={st === 'floor'} onClick={() => (st === 'floor' ? act.clear(s) : act.floor(s))}>
            <span className="ss-floor-glyph" aria-hidden="true" />
            Floor
          </button>
        </div>
      ) : c.auto ? (
        <p className="t-sub ink2 ss-auto">{st === 'floor' ? 'Floor held, from the run that came in.' : s.kind === 'lift' ? 'Done: the sets are logged.' : 'Done: matched to your run.'}</p>
      ) : s.kind !== 'rest' && date > log.today ? (
        <p className="t-sub ink2 ss-auto">Planned for {date === shiftDays(log.today, 1) ? 'tomorrow' : fmtDate('dowLong', date)}. Done and Floor open on the day.</p>
      ) : null}
      <div className="ss-second">
        {share && share.miles > 0 ? (
          <button type="button" className="ss-pill" onClick={() => act.share(share, true)}>
            <Share2 size={18} aria-hidden="true" />
            Share
          </button>
        ) : c.skip || s.mark === 'skip' || s.mark === 'sick' ? (
          <button type="button" className="ss-pill" aria-pressed={s.mark === 'skip' || s.mark === 'sick'} onClick={() => act.skip(s)}>
            <SkipForward size={18} aria-hidden="true" />
            {s.mark === 'skip' || s.mark === 'sick' ? 'Put back' : 'Skip'}
          </button>
        ) : null}
        <button type="button" className="ss-pill" onClick={() => act.move(date, s, true)}>
          <ArrowRightLeft size={18} aria-hidden="true" />
          Move
          <ChevronRight size={16} className="ss-pill-chev" aria-hidden="true" />
        </button>
        <button type="button" className="ss-pill" onClick={() => act.edit(date, s, true)}>
          <Pencil size={18} aria-hidden="true" />
          Edit
          <ChevronRight size={16} className="ss-pill-chev" aria-hidden="true" />
        </button>
      </div>
      {runs.length ? <SessionActual date={date} sess={s} runs={runs} log={log} /> : null}
      {s.kind === 'lift' && sets.length ? (
        <p className="t-sub ink2">
          {sets.length} {sets.length === 1 ? 'set' : 'sets'}: {sets.map((x) => `${x.exercise} ${x.weight}×${x.reps}`).join(', ')}
        </p>
      ) : null}
      {s.kind !== 'run'
        ? others.map((a) => (
            <p key={a.id} className="t-sub ink2">
              {a.name} · {Math.round(a.movingSec / 60)} min
            </p>
          ))
        : null}
      {canLog ? (
        <>
          <Button variant={liftOpen ? 'default' : 'soft'} onClick={() => setLiftOpen((o) => !o)} style={{ justifySelf: 'start' }}>
            {liftOpen ? 'Close the log' : 'Log sets'}
          </Button>
          {liftOpen ? <LiftLog date={date} /> : null}
        </>
      ) : null}
      {s.kind !== 'rest' && floorText && !runs.length ? (
        <p className="fine ss-floor-line">
          The floor: {floorText}. On a bad day it still counts.
        </p>
      ) : null}
    </div>
  );
};

/** A run with no session behind it: the route, its numbers and evidence, and Share. `fromHero` is accepted and makes no difference. */
export const UnplannedSheet = ({ date, runs, log }: { date: string; runs: Activity[]; log: Log; fromHero?: boolean }) => {
  const share = useMemo(() => shareDataFor(date, null, runs, log), [date, runs, log]);
  const act = useSessionActions(log);
  const poly = runs.find((r) => r.polyline)?.polyline;
  const key = sessionKey(log.snap, date, null);
  return (
    <div className="ss t-easy">
      {poly ? <RouteMap polyline={poly} drawKey={`u-${date}`} /> : null}
      <div className="ss-status">
        <Chip kind={chipKind(key)}>{sessionWord(log.snap, date, null)}</Chip>
        <span className="t-sub ink3">Off the plan</span>
      </div>
      <Stats stats={runStats(null, runs, log)} />
      <SessionActual date={date} sess={null} runs={runs} log={log} />
      {share.miles > 0 ? (
        <div className="sheet-foot">
          <span />
          <div className="foot-right">
            <Button variant="primary" onClick={() => act.share(share, true)}>
              Share
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
};

/** The sheet's title on the old path: the date as a caps label. New callers pass the session's name as the title and the date as the eyebrow. */
export const sessionSheetTitle = (date: string) => <span className="caps sh-sheet-date">{fmtDate('long', date)}</span>;

export interface OpenSessionOpts {
  /** Accepted for old callers; the sheet is the same from the hero and from a row. */
  fromHero?: boolean;
  /**
   * The shared title: the id the opener marked with `shared(id)` (by convention `session-<id>`). The opener's title flies
   * into the sheet's header as it rises, and home again on close. Leave it off when nothing on the page carries the id.
   */
  sharedId?: string;
}

/** The spec for a session's sheet: its name as the serif title, the date as the eyebrow. */
export const sessionSheetSpec = (date: string, s: Session, opts: OpenSessionOpts = {}): SheetSpec => ({
  eyebrow: fmtDate('long', date),
  title: s.kind === 'rest' ? 'Rest' : label(s),
  layoutId: opts.sharedId,
  action: <SessionMore date={date} id={s.id} />,
  body: <SessionSheet date={date} id={s.id} />,
  wide: true,
});

/**
 * Open a session's sheet: `open(date, session, { sharedId })`. With `{ push: true }` (from inside another sheet, like
 * Progress's week sheet) it slides in on top of that sheet, with Back to it, instead of replacing it.
 */
export const useOpenSession = (_log?: Log, how: { push?: boolean } = {}) => {
  const sheet = useSheet();
  return (date: string, s: Session, opts: OpenSessionOpts = {}) => {
    const spec = sessionSheetSpec(date, s, opts);
    if (how.push) sheet.push({ ...spec, layoutId: undefined });
    else sheet.open(spec);
  };
};

/** `useOpenSession(log, { push: true })`: a session pushed inside the sheet that is up, with Back to it. */
export const usePushSession = (log?: Log) => useOpenSession(log, { push: true });

/** Open an unplanned run's sheet: the run's name as the title, the date as the eyebrow. */
export const useOpenUnplanned = () => {
  const sheet = useSheet();
  return (date: string, runs: Activity[], log: Log, opts: { sharedId?: string } = {}) =>
    sheet.open({ eyebrow: fmtDate('long', date), title: runs.length === 1 ? runs[0]!.name : `${runs.length} runs`, layoutId: opts.sharedId, body: <UnplannedSheet date={date} runs={runs} log={log} />, wide: true });
};

/**
 * Hold a row still for 450ms (one haptic) and Move opens when the finger lifts, so the release never lands on the calendar
 * that opened under it; a plain tap still opens the sheet. A finger that moves is a scroll or a drag, never a hold.
 */
const LONG_PRESS_MS = 450;
const useLongPress = (fire: () => void) => {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** the press completed and is waiting for the release */
  const ready = useRef(false);
  /** true once, for the click that follows the release */
  const fired = useRef(false);
  const origin = useRef({ x: 0, y: 0 });
  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    ready.current = false;
  };
  return {
    onPointerDown: (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      fired.current = false;
      origin.current = { x: e.clientX, y: e.clientY };
      clear();
      // no haptic here: the hold already ticked once at 300ms when it armed
      timer.current = setTimeout(() => {
        timer.current = null;
        ready.current = true;
      }, LONG_PRESS_MS);
    },
    onPointerMove: (e: React.PointerEvent) => {
      if ((timer.current || ready.current) && Math.hypot(e.clientX - origin.current.x, e.clientY - origin.current.y) >= SLOP) clear();
    },
    onPointerUp: () => {
      const go = ready.current;
      clear();
      if (!go) return;
      fired.current = true;
      // the release still makes a click a few frames later, aimed at whatever is under the finger by then: let it land on
      // this row (where it is swallowed) before the sheet exists, then open
      let timer: ReturnType<typeof setTimeout> | null = null;
      const open = () => {
        window.removeEventListener('click', open, true);
        if (timer) clearTimeout(timer);
        setTimeout(fire, 0);
      };
      window.addEventListener('click', open, { capture: true, once: true });
      timer = setTimeout(() => {
        // no click came: nothing to swallow next time
        fired.current = false;
        open();
      }, 350);
    },
    onPointerLeave: clear,
    onPointerCancel: clear,
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
    cancel: clear,
    /** true once, when the click that ends a long press should be swallowed */
    consume: () => {
      const f = fired.current;
      fired.current = false;
      return f;
    },
  };
};

type Ghost = { leaving: null | 'back' | 'gone' };
/** The copy in the air sits this far above the finger, so the day under the finger stays readable. */
const GHOST_RISE = 24;

/**
 * A row you can pick up: hold 300ms (one tick, the row dims), then move, and a compact copy (the tone dot and the name)
 * lifts just above the finger. Any day cell on the page marked as a drop target lights under it; let go there and the
 * session moves, with the usual toast and Undo. Let go anywhere else and the copy springs back. A hold with no movement
 * still opens Move when the finger lifts, and a tap still opens the sheet.
 */
const useRowDrag = (date: string, s: Session, title: string, press: { cancel: () => void }) => {
  const { move } = useSessionMutations();
  const toast = useToast();
  const reduce = useReducedMotion();
  const over = useDropOver();
  const [armed, setArmed] = useState(false);
  const [ghost, setGhost] = useState<Ghost | null>(null);
  const gx = useMotionValue(0);
  const gy = useMotionValue(0);
  const origin = useRef({ x: 0, y: 0 });
  const land = (leaving: 'back' | 'gone') => setGhost((g) => (g ? { ...g, leaving } : g));
  const drag = useHoldDrag<HTMLButtonElement>({
    disabled: s.kind === 'rest',
    autoScroll: true,
    onArm: () => {
      haptics.lift();
      setArmed(true);
    },
    onStart: (p) => {
      press.cancel();
      origin.current = { x: p.x, y: p.y };
      gx.set(p.x);
      gy.set(p.y);
      setGhost({ leaving: null });
      setDragInfo({ kind: 'session', date, id: s.id });
    },
    onMove: (p) => {
      gx.set(p.x);
      gy.set(p.y);
      const hit = hitDropDay(p.x, p.y);
      if (over.set(hit && hit.day !== date ? hit : null)) haptics.select();
    },
    onDrop: (p) => {
      // the release point is the last word: a final move can be coalesced away before the up
      const fresh = hitDropDay(p.x, p.y);
      const hit = fresh && fresh.day !== date ? fresh : null;
      over.clear();
      setArmed(false);
      setDragInfo(null);
      if (!hit) return land('back');
      const to = hit.day;
      haptics.drop();
      move.mutate({ session: s, to });
      toast(`Moved to ${fmtDate('short', to)}`, { label: 'Undo', fn: () => move.mutate({ session: { ...s, date: to }, to: date }) });
      land('gone');
    },
    onCancel: (phase) => {
      over.clear();
      setArmed(false);
      setDragInfo(null);
      if (phase === 'dragging') land('back');
    },
  });
  // a row that leaves the page mid-drag (the day changed, the session moved) must not leave the week strip open
  useEffect(
    () => () => {
      if (getDragInfo()?.id === s.id) setDragInfo(null);
    },
    [s.id],
  );
  const portal = ghost
    ? createPortal(
        <motion.div
          className={`srow-ghost t-${tone(s)}`}
          aria-hidden="true"
          style={{ x: gx, y: gy }}
          initial={REST}
          animate={ghost.leaving === 'back' ? { ...REST, x: origin.current.x, y: origin.current.y } : ghost.leaving === 'gone' ? { ...REST, opacity: 0 } : reduce ? REST : LIFT}
          transition={reduce ? INSTANT : DROP_SPRING}
          onAnimationComplete={() => ghost.leaving && setGhost(null)}
        >
          <span className="srow-ghost-pill" style={{ transform: `translate(-50%, calc(-100% - ${GHOST_RISE}px))` }}>
            <i className="srow-ghost-dot" />
            <span className="srow-ghost-title">{title}</span>
          </span>
        </motion.div>,
        document.body,
      )
    : null;
  return { drag, portal, lifted: armed || !!ghost };
};

/**
 * The week as a drop target for a session dragged on Today: seven cells that slide in under the Training head while a row is
 * in the air, and slide away when it lands. Mount it between the head and the list.
 */
export const DropWeekStrip = ({ date, log }: { date: string; log: Log }) => {
  const info = useDragInfo();
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const mon = mondayOf(date);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => shiftDays(mon, i)), [mon]);
  const on = info?.kind === 'session' && info.date === date;
  useDropDays(ref, on ? days : []);
  // the strip opens above the list, so the page scrolls by the same amount as the strip grows, before each paint: the row
  // stays under the finger and the head slides up out of the way, instead of the week landing under a finger that has not
  // moved. A ResizeObserver sees every change of the strip's height, animated or instant (reduced motion).
  // `applied` is what the page really scrolled, so the strip's exit gives back exactly that.
  const shown = useRef(0);
  const applied = useRef(0);
  const keep = (h: number) => {
    const d = h - shown.current;
    shown.current = h;
    if (!d) return;
    const before = window.scrollY;
    window.scrollBy(0, d);
    applied.current += window.scrollY - before;
  };
  useEffect(() => {
    const el = ref.current;
    if (!on || !el) return;
    const ro = new ResizeObserver(() => keep(el.offsetHeight));
    ro.observe(el);
    keep(el.offsetHeight);
    return () => ro.disconnect();
  }, [on]); // eslint-disable-line react-hooks/exhaustive-deps
  const giveBack = () => {
    if (applied.current) window.scrollBy(0, -applied.current);
    applied.current = 0;
    shown.current = 0;
  };
  return (
    <AnimatePresence initial={false} onExitComplete={giveBack}>
      {on ? (
        <motion.div key="strip" ref={ref} className="drop-strip" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={reduce ? INSTANT : { duration: 0.2, ease: 'easeOut' }}>
          <div className="drop-strip-in">
            {/* no day is selected here: the one light is the ring under the finger; the session's own day sits back */}
            <DayStrip
              days={days}
              selected=""
              today={log.today}
              onPick={() => undefined}
              labelOf={(d) => (d === date ? `${fmtDate('long', d)}, where it is` : `${fmtDate('long', d)}. Drop here to move`)}
              ariaLabel="Drop on a day"
              extra={(d) => {
                const main = log.snap.sessionsOn(d).find((x) => x.kind !== 'rest');
                return <i className={`dcell-dot ${main ? `t-${tone(main)}` : 'none'} ${d === date ? 'dcell-origin' : ''}`} />;
              }}
            />
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
};

/** A 60px row: check, colour bar, the run's name (or the plan's label), the plan and the actual as the sub line, one stat, chevron. Hold and move to drag it to another day. */
export const SessionRow = ({ date, s, log, as = 'li' }: { date: string; s: Session; log: Log; as?: 'li' | 'div' }) => {
  const st = sessionStatus(log.snap, date, s);
  const auto = isAutoStatus(log.snap, date, s);
  const word = sessionWord(log.snap, date, s);
  const { mark } = useSessionMutations();
  const open = useOpenSession(log);
  const sheet = useSheet();
  const cancelDrag = useRef<() => void>(() => undefined);
  const press = useLongPress(() => {
    cancelDrag.current();
    openMoveSheet(sheet, date, s);
  });
  const runs = s.kind === 'run' ? log.snap.runsOn(date) : [];
  const sets = log.snap.liftsOn(date);
  const lbl = label(s);
  const a = runs.length ? assess(log.zones, s, runs) : null;
  const planned = plannedMiles(s);
  // a logged run leads with its own name, the way Aura sets it; the plan drops to the sub line with what happened against it: "Easy 6 · 3.0 of 6 mi"
  const title = runs.length ? runs.map((r) => r.name).join(' + ') : lbl;
  const sub = a ? [lbl, planned ? `${mi(a.miles)} of ${num(planned)} mi` : null, s.details].filter(Boolean).join(' · ') : sessionMeta(s, st) || word;
  const { drag, portal, lifted } = useRowDrag(date, s, title, press);
  cancelDrag.current = drag.cancel;
  let stat: ReactNode = null;
  if (a) {
    stat = (
      <span className="srow-stat">
        <b>{mi(a.miles)} mi</b>
        <small>{a.pace ? `${a.pace}/mi` : clock(a.movingSec)}</small>
      </span>
    );
  } else if (s.kind === 'lift' && sets.length) {
    stat = (
      <span className="srow-stat">
        <b>{sets.length}</b>
        <small>{sets.length === 1 ? 'set' : 'sets'}</small>
      </span>
    );
  } else if (st !== 'done') stat = <Chip kind={chipKind(sessionKey(log.snap, date, s))}>{word}</Chip>;
  const Tag = as;
  const setBody = (el: HTMLButtonElement | null) => {
    drag.ref.current = el;
  };
  return (
    <>
      <Tag className={`srow t-${tone(s)} s-${st} ${lifted ? 'is-lifted' : ''}`}>
        <Mark status={st} label={`${lbl}: ${word}`} title={auto ? 'Matched to a logged run' : undefined} disabled={s.kind === 'rest' || auto} onClick={() => mark.mutate({ session: s, mark: st === 'done' && s.mark === 'done' ? null : 'done' })} />
        <button
          ref={setBody}
          type="button"
          className="srow-body"
          aria-label={`${title}. ${sub}. Open; hold to move`}
          onClick={() => (drag.consumeClick() || press.consume() ? undefined : open(date, s))}
          onPointerDown={(e) => {
            press.onPointerDown(e);
            drag.bind.onPointerDown(e);
          }}
          onPointerMove={(e) => {
            press.onPointerMove(e);
            drag.bind.onPointerMove(e);
          }}
          onPointerUp={() => {
            press.onPointerUp();
            drag.bind.onPointerUp();
          }}
          onPointerLeave={() => {
            press.onPointerLeave();
            drag.bind.onPointerLeave();
          }}
          onPointerCancel={() => {
            press.onPointerCancel();
            drag.bind.onPointerCancel();
          }}
          onContextMenu={press.onContextMenu}
        >
          <span className="srow-bar" aria-hidden="true" />
          <span className="srow-main">
            <span className="lrow-title">{title}</span>
            <span className="lrow-sub">{sub}</span>
          </span>
          {stat}
          <ChevronRight size={18} className="srow-chev" />
        </button>
      </Tag>
      {portal}
    </>
  );
};

export const UnplannedRow = ({ date, runs, log }: { date: string; runs: Activity[]; log: Log }) => {
  const openUnplanned = useOpenUnplanned();
  const a = assess(log.zones, null, runs);
  return (
    <li className="srow t-easy s-done">
      <Mark status="done" disabled label="Unplanned run, done" />
      <button type="button" className="srow-body" onClick={() => openUnplanned(date, runs, log)}>
        <span className="srow-bar" aria-hidden="true" />
        <span className="srow-main">
          <span className="lrow-title">{runs.map((r) => r.name).join(' + ')}</span>
          <span className="lrow-sub">Unplanned</span>
        </span>
        <span className="srow-stat">
          <b>{mi(a.miles)} mi</b>
          <small>{a.pace ? `${a.pace}/mi` : ''}</small>
        </span>
        <ChevronRight size={18} className="srow-chev" />
      </button>
    </li>
  );
};

export const AddSessionButton = ({ date, children, variant = 'quiet' }: { date: string; children?: ReactNode; variant?: 'ghost' | 'soft' | 'primary' | 'quiet' }) => {
  const sheet = useSheet();
  return (
    <Button variant={variant} size="sm" onClick={() => sheet.open({ title: 'Add a session', detent: 'large', body: <SessionEditor date={date} session={null} /> })}>
      {children ?? 'Add'}
    </Button>
  );
};
