import { assess, clock, clockOfDay, counts, e1rm, floorFor, fmtDate, label, METERS_PER_MILE, mi, mondayOf, monthOf, MORNING_DEFAULTS, num, sessionKey, sessionStatus, sessionWord, shiftDays, STATUS_WORDS, tone, weekTotals, zoneOf, type Activity, type Lap, type Session, type StatusKey } from '@logbook/shared';
import { Check, MoreHorizontal, Sparkles } from 'lucide-react';
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useContextMenu } from '@/ui/ContextMenu';
import { Button, Chip, Stat, StatStrip } from '@/ui/primitives';
import { useSheet, type SheetSpec } from '@/ui/Sheet';
import { useCoachShown } from '../day/coachShown';
import { useLog, type Log } from '../log/useLog';
import { doorOf, morningOf } from '../morning/model';
import type { ShareData, ShareDayType } from '../share/cards';
import { sessionCan, useSessionActions } from './actions';
import { LiftLog } from './LiftLog';
import { dayMiles, sessionMiles } from './miles';
import { voiceHead, voiceLine } from './voice';
import { mainRun, recordLap, RouteMap, useRunRecords, whenLine } from './RunDetail';
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

/** The chip class for a status key: the colours `.chip` already has. A missed day is the plain chip, never red (§7.2). */
export const chipKind = (k: StatusKey): string => ({ done: 'done', bonus: 'done', floor: 'floor', missed: '', today: 'open', planned: 'upcoming', skipped: '', rest: '' })[k];

/** caps label, the number, its unit, and an optional small line under it ("of 6") */
type SheetStat = [string, string, string?, string?];

/** The one stat pattern (docs/system.md §4.6): caps labels over stamps, a hairline above, 2 to 4 columns. */
export const StatRow = ({ stats }: { stats: SheetStat[] }) =>
  stats.length ? (
    <StatStrip className={`stat-row cols-${stats.length}`}>
      {stats.map(([k, v, u, n]) => (
        <Stat key={k} label={k} value={v} unit={u} delta={n ? { text: n } : undefined} small={stats.length > 3} />
      ))}
    </StatStrip>
  ) : null;

/** The day's verdict in the brand voice: "Floor held." / "Easy 6, done." / "6.0 mi, off the plan." */
const runVerdict = (sess: Session | null, runs: Activity[], miles: number, status: string): string => {
  if (status === 'floor') return 'Floor held.';
  if (sess) return `${label(sess)}, done.`;
  return runs.length > 1 ? `${mi(miles)} mi across ${runs.length} runs.` : `${mi(miles)} mi, off the plan.`;
};

/** The run miles the plan asked for on this day, 0 when it named none. */
export const plannedMiles = (s: Session | null | undefined): number => (s?.kind === 'run' ? Number(s.miles) || 0 : 0);

/** A finished run's numbers: DISTANCE (what happened, "of 6" under it) · PACE · TIME · HR. */
export const runStats = (sess: Session | null, runs: Activity[], log: Log): SheetStat[] => {
  const a = assess(log.zones, sess, runs);
  const planned = plannedMiles(sess);
  const dist: SheetStat[] = a.miles >= 0.05 ? [['Distance', mi(a.miles), 'mi', planned ? `of ${num(planned)}` : undefined]] : [];
  const out: SheetStat[] = [...dist];
  if (a.pace) out.push(['Pace', a.pace, '/mi']);
  if (a.movingSec) out.push(['Time', clock(a.movingSec)]);
  if (a.avgHr != null) out.push(['HR', String(a.avgHr), 'bpm']);
  return out;
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
      if (door != null) stats.push(['Out at', short(door)], ['Back', short(T.back)]);
    }
  }
  if (sets) stats.push(['Sets', String(sets)]);
  return stats.slice(0, 4);
};

const weekdayLong = (d: string) => new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(new Date(`${d}T12:00:00`));

/**
 * Everything a share needs: the kind of day, its title, the run when there was one (an activity, or a run marked Done by
 * hand at its planned miles: contract 5's `sessionMiles`), the sets, the habits lit, the day's words, and the week around
 * it, counted the same way.
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

/**
 * What happened, graded against the plan: who ran it and when, splits, the read, and the coach's read when the server
 * already holds one (nothing is fetched from here).
 */
export const SessionActual = ({ date, sess, runs, log, prLap }: { date: string; sess: Session | null; runs: Activity[]; log: Log; prLap?: Lap | null }) => {
  const a = assess(log.zones, sess, runs);
  const laps = runs.flatMap((r) => r.laps ?? []).filter((l) => l[0] > 160);
  const key = sess ? sess.id : 'run';
  // the month's read, else the one the hero's ask brought back (it joins the month without a notify, so an open sheet hears
  // of it here)
  const fresh = useCoachShown(date, key);
  const saved = log.snap.coachOn(date, key) ?? fresh;
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
        <div className="splits" id={`splits-${key}`} aria-label="Mile splits">
          {laps.map((l, i) => {
            const part = l[0] < 0.9 * METERS_PER_MILE;
            const z = l[2] != null ? zoneOf(log.zones, l[2]) : null;
            const p = l[1] / (l[0] / METERS_PER_MILE);
            // the fastest mile gets the longest bar
            const w = slowest === fastest ? 1 : 0.35 + 0.65 * (1 - (p - fastest) / (slowest - fastest));
            return (
              <div key={i} className={`split ${z ? `sz${z}` : ''} ${part ? 'part' : ''} ${l === prLap ? 'is-pr' : ''}`}>
                <span className="split-n">{l === prLap ? 'PR' : part ? mi(l[0] / METERS_PER_MILE) : i + 1}</span>
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
      {saved ? (
        <div className="coach">
          <span className="caps coach-head">
            <Sparkles size={14} aria-hidden="true" /> Coach’s read
          </span>
          <p className="coach-line">{saved}</p>
        </div>
      ) : null}
    </div>
  );
};

export { RouteMap } from './RunDetail';

/**
 * The session sheet's ⋯, in the sheet header's action slot (`SheetSpec.action`): "Not feeling 100%" and Delete as a context
 * menu under the button. It reads the session live, like the sheet's body, so a mark made in the sheet changes what it offers.
 */
const SessionMore = ({ date, id }: { date: string; id: string }) => {
  const log = useLog([monthOf(date)]);
  const act = useSessionActions(log);
  const menu = useContextMenu();
  const btn = useRef<HTMLButtonElement>(null);
  const s = log.snap.sessionsOn(date).find((x) => x.id === id);
  if (!s) return null;
  const name = s.kind === 'rest' ? 'Rest' : label(s);
  const items = act.menuItems(date, s, { push: true }).filter((i) => i.label === 'Not feeling 100%' || i.destructive);
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
 * The session, in full (docs/system.md): the sheet's serif title is its name, the eyebrow the date; the route at the top
 * when there is one; one StatRow; Done (`Button primary`) and Floor (`Button soft`) at 48; Skip, Move, Edit and Share as
 * quiet buttons; Delete and "Not feeling 100%" in the header's ⋯. The evidence (splits, the read) follows.
 */
const SessionSheet = ({ date, id }: { date: string; id: string }) => {
  // the sheet body is captured once at open; subscribing here keeps marks, sets and deletes live while it is up
  const log = useLog([monthOf(date)]);
  const sheet = useSheet();
  const act = useSessionActions(log);
  const [liftOpen, setLiftOpen] = useState(false);
  // "Not feeling 100%" with nothing hard in the days ahead answers on its own button, not in a toast (§8)
  const [nothingToEase, setNothingToEase] = useState(false);
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
  // the sheet opens on the stats and the verbs; the evidence (splits, the read) renders right after, in the background
  const evidence = useDeferredValue(true, false);
  const records = useRunRecords(runs);
  if (!s) return null;
  const when = runs.length ? whenLine(date, log.today, mainRun(runs)?.time ?? null, startClock) : null;
  const matched = s.kind === 'run' && runs.length > 0;
  const c = sessionCan(log, date, s);
  const st = c.st;
  const key = sessionKey(log.snap, date, s);
  const word = sessionWord(log.snap, date, s);
  const sets = log.snap.liftsOn(date);
  const others = log.snap.activitiesOn(date).filter((a) => a.kind !== 'run');
  const canLog = s.kind === 'lift' || (s.kind === 'cross' && /hyrox/i.test(s.type ?? ''));
  const stats = runs.length ? runStats(s, runs, log) : planStats(date, s, log, s.kind === 'lift' ? sets.length : 0);
  const polyRun = runs.find((r) => r.polyline) ?? null;
  const poly = polyRun?.polyline;
  const meta = sessionMeta(s);
  const floorText = floorFor(s);
  const skipped = s.mark === 'skip' || s.mark === 'sick';
  return (
    <div className={`ss t-${tone(s)}`}>
      {poly ? <RouteMap polyline={poly} drawKey={s.id} /> : null}
      <div className="ss-status">
        <Chip kind={chipKind(key)}>{word}</Chip>
        {when ? <span className="t-sub ink3">{when}</span> : null}
        {s.movedFrom ? <span className="t-sub ink3">Moved from {fmtDate('md', s.movedFrom)}</span> : null}
      </div>
      {meta ? <p className="t-sub ink2 ss-meta">{meta}</p> : null}
      <StatRow stats={stats} />
      {c.mark ? (
        <div className="ss-verbs" role="group" aria-label="Mark it">
          <Button variant={st === 'done' ? 'soft' : 'primary'} className="lg" aria-pressed={st === 'done'} onClick={() => (st === 'done' ? act.clear(s) : act.done(s))}>
            <Check size={18} strokeWidth={2.6} aria-hidden="true" />
            Done
          </Button>
          <Button variant={st === 'floor' ? 'default' : 'soft'} className={`lg ss-floor ${st === 'floor' ? 'is-on' : ''}`} aria-pressed={st === 'floor'} onClick={() => (st === 'floor' ? act.clear(s) : act.floor(s))}>
            Floor
          </Button>
        </div>
      ) : c.auto ? (
        <p className="t-sub ink2 ss-auto">{st === 'floor' ? 'Floor held, from the run that came in.' : s.kind === 'lift' ? 'Done: the sets are logged.' : 'Done: matched to your run.'}</p>
      ) : s.kind !== 'rest' && date > log.today ? (
        <p className="t-sub ink2 ss-auto">Planned for {date === shiftDays(log.today, 1) ? 'tomorrow' : fmtDate('dowLong', date)}. Done and Floor open on the day.</p>
      ) : null}
      <div className="ss-second">
        {!matched && (c.skip || skipped) ? (
          <Button variant="quiet" aria-pressed={skipped} onClick={() => act.skip(s)}>
            {skipped ? 'Put back' : 'Skip'}
          </Button>
        ) : null}
        <Button variant="quiet" onClick={() => act.move(date, s, true)}>
          Move
        </Button>
        <Button variant="quiet" onClick={() => act.edit(date, s, true)}>
          Edit
        </Button>
        {share && share.miles > 0 ? (
          <Button variant="quiet" onClick={() => act.share(share, true)}>
            Share
          </Button>
        ) : null}
        {/* today's matched run only: a past day's "not feeling" would rewrite days that are already a record */}
        {matched && date === log.today ? (
          <Button variant="quiet" disabled={nothingToEase} onClick={() => setNothingToEase(act.notFeeling(date, s) === 0)}>
            {nothingToEase ? 'Nothing hard ahead' : 'Not feeling 100%'}
          </Button>
        ) : null}
      </div>
      {runs.length && evidence ? <SessionActual date={date} sess={s} runs={runs} log={log} prLap={recordLap(runs, records)} /> : null}
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
      {s.kind !== 'rest' && floorText && !runs.length ? <p className="fine ss-floor-line">The floor: {floorText}. On a bad day it still counts.</p> : null}
    </div>
  );
};

/** A run with no session behind it: the route, its numbers and evidence, and Share. `fromHero` is accepted and makes no difference. */
export const UnplannedSheet = ({ date, runs, log }: { date: string; runs: Activity[]; log: Log; fromHero?: boolean }) => {
  const share = useMemo(() => shareDataFor(date, null, runs, log), [date, runs, log]);
  const act = useSessionActions(log);
  const polyRun = runs.find((r) => r.polyline) ?? null;
  const key = sessionKey(log.snap, date, null);
  const records = useRunRecords(runs);
  const when = whenLine(date, log.today, mainRun(runs)?.time ?? null, startClock);
  return (
    <div className="ss t-easy">
      {polyRun?.polyline ? <RouteMap polyline={polyRun.polyline} drawKey={`u-${date}`} /> : null}
      <div className="ss-status">
        <Chip kind={chipKind(key)}>{sessionWord(log.snap, date, null)}</Chip>
        <span className="t-sub ink3">{when ? `${when} · off the plan` : 'Off the plan'}</span>
      </div>
      <StatRow stats={runStats(null, runs, log)} />
      {share.miles > 0 ? (
        <div className="ss-second">
          <Button variant="quiet" onClick={() => act.share(share, true)}>
            Share
          </Button>
        </div>
      ) : null}
      <SessionActual date={date} sess={null} runs={runs} log={log} prLap={recordLap(runs, records)} />
    </div>
  );
};

/** The sheet's title on the old path: the date as a caps label. New callers pass the session's name as the title and the date as the eyebrow. */
export const sessionSheetTitle = (date: string) => <span className="caps">{fmtDate('long', date)}</span>;

export interface OpenSessionOpts {
  /** Accepted for old callers; the sheet is the same from the hero and from a row. */
  fromHero?: boolean;
}

/** The spec for a session's sheet: its name as the serif title, the date as the eyebrow. */
export const sessionSheetSpec = (date: string, s: Session, _opts: OpenSessionOpts = {}): SheetSpec => ({
  eyebrow: fmtDate('long', date),
  title: s.kind === 'rest' ? 'Rest' : label(s),
  action: <SessionMore date={date} id={s.id} />,
  body: <SessionSheet date={date} id={s.id} />,
  wide: true,
});

/**
 * Open a session's sheet: `open(date, session, { sharedId })`. With `{ push: true }` (from inside another sheet) it slides
 * in on top of that sheet, with Back to it, instead of replacing it.
 */
export const useOpenSession = (_log?: Log, how: { push?: boolean } = {}) => {
  const sheet = useSheet();
  return (date: string, s: Session, opts: OpenSessionOpts = {}) => {
    const spec = sessionSheetSpec(date, s, opts);
    if (how.push) sheet.push(spec);
    else sheet.open(spec);
  };
};

/** `useOpenSession(log, { push: true })`: a session pushed inside the sheet that is up, with Back to it. */
export const usePushSession = (log?: Log) => useOpenSession(log, { push: true });

/** Open an unplanned run's sheet: the run's name as the title, the date as the eyebrow. */
export const useOpenUnplanned = () => {
  const sheet = useSheet();
  return (date: string, runs: Activity[], log: Log) =>
    sheet.open({ eyebrow: fmtDate('long', date), title: runs.length === 1 ? runs[0]!.name : `${runs.length} runs`, body: <UnplannedSheet date={date} runs={runs} log={log} />, wide: true });
};
