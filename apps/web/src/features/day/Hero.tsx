import { clock, decodePolyline, label, num, routePath, type Activity, type ISODate, type PhaseSession, type Session, type SessionMark } from '@logbook/shared';
import { ChevronRight, Share } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import type * as React from 'react';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { useNav } from '@/app/NavController';
import { useSessionMutations, useStravaChecking } from '@/api/queries';
import { CHECKING_MAX_MS, CHECKING_MIN_MS } from '@/lib/gesture';
import { haptics } from '@/lib/haptics';
import { crossfade, fadeIn, fadeOut } from '@/lib/motion';
import { Button, Pressable, Stepper, Ticker, useFirstToday, useSheet, useToast, type ContextMenuItem } from '@/ui';
import type { Log } from '../log/useLog';
import { useSessionActions } from '../sessions/actions';
import { shareDataFor, useOpenSession, useOpenUnplanned } from '../sessions/SessionCard';
import { ShareSheet } from '../share/ShareSheet';
import { CloseDay } from './CloseDay';
import { useIsLive } from './live';
import { faceOf, milesText, phaseOf, secondOf, type Face } from './faces';
import { HoldRing } from './HoldRing';
import { sessionMiles, weekMiles } from './miles';
import { MiniTimeline, OutLine } from './MiniTimeline';
import { useDeferredMinutes, useFaceMinutes } from './useDeferred';

/** The shared element between the hero's four-stop line and This morning's Now card (contracts §F). */
export const morningLineId = (date: ISODate) => `morning-line-${date}`;
export const morningPath = (date: ISODate) => `/today/${date}/morning`;

/** Pointers that start on these are not the hero's: the ring and the line own their press; the deck's buttons theirs. */
const HERO_IGNORE = '.hold-ring, [data-shared], .hero-share, .hero-verb, .hero-next';

/** The share card's data for a day whose miles are logged by hand: the session's miles, and the week counted the same way. */
const shareFor = (date: ISODate, s: Session | null, runs: Activity[], log: Log) => {
  const data = shareDataFor(date, s, runs, log);
  if (runs.length || !s) return data;
  const m = sessionMiles(log.snap, date, s).miles;
  const days = weekMiles(log.snap, date);
  const total = days.reduce((t, d) => t + d.miles, 0);
  return { ...data, miles: m, verdict: m > 0 ? `${num(m)} mi. Done.` : data.verdict, week: data.week ? { ...data.week, days, total } : data.week };
};

/**
 * The open face's status line (§6.1): `Checking Strava…` while a non-quiet `/strava/sync` runs (`useStravaChecking`), shown
 * for at least `CHECKING_MIN_MS` and at most `CHECKING_MAX_MS`; otherwise the face's own words. The two crossfade (120 ms in,
 * 100 ms out) in the same box.
 */
const useCheckingLine = () => {
  const checking = useStravaChecking();
  const [shown, setShown] = useState(checking);
  const since = useRef(checking ? performance.now() : 0);
  useEffect(() => {
    if (checking) {
      if (!since.current) since.current = performance.now();
      setShown(true);
      const cap = setTimeout(() => setShown(false), Math.max(0, CHECKING_MAX_MS - (performance.now() - since.current)));
      return () => clearTimeout(cap);
    }
    if (!since.current) return;
    const left = CHECKING_MIN_MS - (performance.now() - since.current);
    const t = setTimeout(() => {
      since.current = 0;
      setShown(false);
    }, Math.max(0, left));
    return () => clearTimeout(t);
  }, [checking]);
  return shown;
};

const StatusLine = ({ text }: { text: string }) => {
  const checking = useCheckingLine();
  return (
    <span className="hero-status" aria-live="polite">
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span key={checking ? 'checking' : text} className="hero-status-in" initial={{ opacity: 0 }} animate={{ opacity: 1, transition: fadeIn }} exit={{ opacity: 0, transition: fadeOut }}>
          {checking ? 'Checking Strava…' : text}
        </motion.span>
      </AnimatePresence>
    </span>
  );
};

/** The route, 358 × 120, drawn once a day per run (`routeDraw`, 1.1 s); still on every other view. */
const Route = ({ polyline, drawKey, date }: { polyline: string; drawKey: string | null; date: ISODate }) => {
  // the daily moment is the live page's: a neighbour mounted beside it never spends it, and becoming live mounts it afresh
  const live = useIsLive(date);
  return <RouteDraw key={live ? 'live' : 'still'} polyline={polyline} drawKey={live ? drawKey : null} />;
};
const RouteDraw = ({ polyline, drawKey }: { polyline: string; drawKey: string | null }) => {
  const reduce = useReducedMotion();
  const first = useFirstToday(drawKey);
  const d = useMemo(() => routePath(decodePolyline(polyline), 358, 120, 12), [polyline]);
  if (!d) return <div className="hero-route" aria-hidden="true" />;
  return (
    <svg className="hero-route" viewBox="0 0 358 120" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <motion.path d={d} fill="none" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" initial={first && !reduce ? { pathLength: 0 } : false} animate={{ pathLength: 1 }} transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }} />
    </svg>
  );
};

const SharePill = ({ onShare }: { onShare: () => void }) => (
  <Pressable
    className="hero-share"
    label="Share"
    onPress={(e) => {
      e.stopPropagation();
      onShare();
    }}
  >
    <Share size={14} strokeWidth={2.25} aria-hidden="true" /> Share
  </Pressable>
);

/** "Ran a different distance?": a sheet with a stepper in half miles that writes what was run onto the session. */
const DistanceSheet = ({ s }: { s: Session }) => {
  const { upsert } = useSessionMutations();
  const sheet = useSheet();
  const [v, setV] = useState(Number(s.miles) || 1);
  return (
    <div className="hero-dist">
      <Stepper value={v} onChange={setV} step={0.5} min={0.5} max={60} format={(x) => `${num(x)} mi`} parse={(t) => (Number.isFinite(parseFloat(t)) ? Math.round(parseFloat(t) * 2) / 2 : null)} label="Miles run" inputProps={{ inputMode: 'decimal', autoComplete: 'off' }} />
      <Button
        variant="primary"
        onClick={() => {
          if (v !== s.miles) upsert.mutate({ id: s.id, date: s.date, kind: s.kind, type: s.type, title: s.title, details: s.details, miles: v, minutes: s.minutes });
          sheet.close();
        }}
      >
        Save
      </Button>
    </div>
  );
};

/** One stamp of the landed deck: caps over a number that ticks from the plan the first time the day sees it. */
const Stat = ({ k, children }: { k: string; children: React.ReactNode }) => (
  <span className="hero-stat">
    <span className="caps">{k}</span>
    <span className="hero-stat-num">{children}</span>
  </span>
);

interface DeckCtx {
  date: ISODate;
  log: Log;
  face: Face;
  isToday: boolean;
  now: number;
  onShare: () => void;
  onMorning: () => void;
  onOpenNext: () => void;
  onAdjust: () => void;
}

/** The landed deck: DISTANCE · PACE · TIME ticking from the plan on the day's first view (the live page's moment), Share, the coach's sentence. */
const LandedDeck = ({ c }: { c: DeckCtx }) => {
  const L = c.face.landed!;
  const live = useIsLive(c.date);
  const once = (k: string) => (live && c.isToday ? `${L.drawKey}-${k}` : undefined);
  const planned = c.face.lead?.session.kind === 'run' && c.face.lead.session.miles ? c.face.lead.session.miles : L.miles;
  return (
    <div className="hero-deck hero-deck-landed">
      <div className="hero-stats" key={live ? 'live' : 'still'}>
        <Stat k="Distance">
          <Ticker value={L.miles} format={milesText} from={planned} onceADay={once('mi')} />
        </Stat>
        {L.paceSec ? (
          <Stat k="Pace">
            <Ticker value={L.paceSec} format={(v) => clock(v)} from={L.paceSec} onceADay={once('pace')} />
          </Stat>
        ) : null}
        {L.sec ? (
          <Stat k="Time">
            <Ticker value={L.sec} format={(v) => clock(v)} from={L.sec} onceADay={once('time')} />
          </Stat>
        ) : null}
        <SharePill onShare={c.onShare} />
      </div>
      {L.coach ? <p className="hero-coach">{L.coach}</p> : null}
    </div>
  );
};

/** The deck (56): the only part that differs between faces. */
const Deck = ({ c }: { c: DeckCtx }) => {
  const { face } = c;
  if (face.stops)
    return (
      <div className="hero-deck">
        <MiniTimeline stops={face.stops} now={c.isToday ? c.now : -1} onPress={c.onMorning} label={face.stopsLabel ?? 'This morning'} shared={morningLineId(c.date)} />
      </div>
    );
  if (face.out)
    return (
      <div className="hero-deck hero-deck-out">
        <OutLine door={face.out.door} back={face.out.back} progress={face.out.progress} />
        {face.out.sub ? <span className="hero-sub">{face.out.sub}</span> : null}
      </div>
    );
  if (face.kind === 'open')
    return (
      <div className="hero-deck hero-deck-ring">
        <StatusLine text={face.status ?? ''} />
      </div>
    );
  if (face.landed) return <LandedDeck c={c} />;
  if (face.doneHand)
    return (
      <div className="hero-deck hero-deck-ring hero-deck-done">
        {face.doneHand.week ? <span className="hero-sub">{face.doneHand.week}</span> : null}
        {c.isToday ? (
          <span className="hero-done-tools">
            <SharePill onShare={c.onShare} />
            {face.doneHand.adjust ? (
              <Pressable
                className="hero-verb"
                press="dim"
                onPress={(e) => {
                  e.stopPropagation();
                  c.onAdjust();
                }}
              >
                Ran a different distance?
              </Pressable>
            ) : null}
          </span>
        ) : null}
      </div>
    );
  if (face.next)
    return (
      <div className="hero-deck">
        <Pressable
          className="hero-next"
          press="surface"
          label={`${face.next.text}. Open`}
          onPress={(e) => {
            e.stopPropagation();
            c.onOpenNext();
          }}
        >
          <span className="hero-next-text">{face.next.text}</span>
          <ChevronRight size={16} aria-hidden="true" />
        </Pressable>
      </div>
    );
  return <div className="hero-deck" />;
};

/** The words of a face: eyebrow (and its aside), stamp, line, the route on the landed face, the deck. */
const FaceView = ({ c }: { c: DeckCtx }) => {
  const { face } = c;
  return (
    <>
      <div className="hero-eyebrow-row">
        <span className="caps hero-eyebrow">{face.eyebrow}</span>
        {face.aside ? <span className="caps hero-aside">{face.aside}</span> : null}
      </div>
      <span className="hero-stamp">{face.stamp}</span>
      <p className="hero-line">{face.line}</p>
      {face.tall && face.landed?.polyline ? <Route polyline={face.landed.polyline} drawKey={c.isToday ? face.landed.drawKey : null} date={c.date} /> : null}
      <Deck c={c} />
    </>
  );
};

/** The evening slot: the Close card (its own height); a neighbour's copy is still (no composer, no read). */
const EveningFace = ({ date, log, ph, onOpen }: { date: ISODate; log: Log; ph: ReturnType<typeof phaseOf>; onOpen: (p: PhaseSession) => void }) => {
  const live = useIsLive(date);
  return (
    <div className="hero hero-close" data-face="evening">
      <CloseDay date={date} log={log} ph={ph} onOpenSession={onOpen} still={!live} asHero />
    </div>
  );
};

/**
 * The hero (docs/feel.md §3.2–3.4, M13): one card at a fixed 184 (304 for the landed face with its route), whose content
 * follows the day and the clock. Faces are keyed by face + session inside `AnimatePresence mode="popLayout"` and crossfade
 * (150 ms) in the same box, so a phase change moves nothing below the card. A tap opens the session sheet; a hold opens the
 * menu (`Done · Skip · Move · Share`, ≤ 4); the ring and the four-stop line own their press (`ignore`), so a hold on the
 * ring only completes and a tap on the line only pushes This morning. The second session of a two-session day is its own
 * compact card below (`SecondSession`): no inner carousel, ever; the day pager is the only horizontal gesture. The evening
 * slot is the Close card (its own height).
 */
export const Hero = memo(function Hero({ date, log }: { date: ISODate; log: Log }) {
  // the clock's face changes wait for an interaction or idle (§5.3, useDeferred); a minute that keeps the face ticks at once
  const clock = useFaceMinutes();
  const keyOf = (m: number) => {
    const f = faceOf(log, date, phaseOf(log, date, m));
    return `${f.kind}|${f.key}|${f.halo}|${f.tall}`;
  };
  const minutes = useDeferredMinutes(clock, keyOf);
  const ph = useMemo(() => phaseOf(log, date, minutes), [log, date, minutes]);
  const face = useMemo(() => faceOf(log, date, ph), [log, date, ph]);
  const evening = face.kind === 'evening';
  const openSession = useOpenSession(log);
  // the Close card is the one face that is not the 184 card: the two crossfade (150 ms) in the hero's slot
  return (
    <AnimatePresence initial={false} mode="popLayout">
      <motion.div key={evening ? 'close' : 'day'} className="hero-swap" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={crossfade}>
        {evening ? <EveningFace date={date} log={log} ph={ph} onOpen={(p) => openSession(date, p.session, { fromHero: true })} /> : <DayHero date={date} log={log} ph={ph} face={face} />}
      </motion.div>
    </AnimatePresence>
  );
});

/** The 184 card (304 landed): every face but the evening's. */
const DayHero = ({ date, log, ph, face }: { date: ISODate; log: Log; ph: ReturnType<typeof phaseOf>; face: Face }) => {
  const nav = useNav();
  const sheet = useSheet();
  const toast = useToast();
  const openSession = useOpenSession(log);
  const openUnplanned = useOpenUnplanned();
  const act = useSessionActions(log);
  const { mark } = useSessionMutations();
  const [boost, setBoost] = useState(false);
  const isToday = date === log.today;
  const lead = face.lead;
  const runs = log.snap.runsOn(date);

  useEffect(() => {
    if (!boost) return;
    const t = setTimeout(() => setBoost(false), 650);
    return () => clearTimeout(t);
  }, [boost]);

  const open = () => {
    if (lead) openSession(date, lead.session, { fromHero: true });
    else if (runs.length) openUnplanned(date, runs, log);
  };
  const share = () => sheet.open({ title: 'Share', body: <ShareSheet data={shareFor(date, lead?.session ?? null, runs, log)} initial={runs.some((r) => r.polyline) ? 'route' : runs.length ? undefined : 'bubble'} /> });
  const setMark = (s: Session, m: SessionMark | null) => mark.mutate({ session: s, mark: m });
  /** The session done by hand (the ring, or Done in the menu): the one success, the halo blooms. */
  const complete = (s: Session) => {
    setMark(s, 'done');
    setBoost(true);
  };
  const skip = (s: Session) => {
    const was = s.mark;
    setMark(s, 'skip');
    toast(`${label(s)} skipped`, { label: 'Undo', fn: () => mark.mutate({ session: { ...s, mark: 'skip' }, mark: was }) });
  };

  /** The hold menu: ≤ 4, the things a runner reaches for. */
  const items = (): ContextMenuItem[] => {
    const list: ContextMenuItem[] = [];
    if (lead) {
      const s = lead.session;
      const byHand = s.mark === 'done' || s.mark === 'floor';
      const future = date > log.today;
      if (byHand) list.push({ label: 'Not done', onSelect: () => setMark(s, null) });
      else if (!future && lead.key !== 'done' && lead.key !== 'floor')
        list.push({
          label: 'Done',
          onSelect: () => {
            haptics.success();
            complete(s);
          },
        });
      if (lead.key === 'today' || lead.key === 'planned') list.push({ label: 'Skip', onSelect: () => skip(s) });
      if (lead.key !== 'done' && lead.key !== 'floor') list.push({ label: 'Move', onSelect: () => act.move(date, s) });
    }
    if (runs.length || (lead && date <= log.today)) list.push({ label: 'Share', onSelect: share });
    return list.slice(0, 4);
  };

  const c: DeckCtx = {
    date,
    log,
    face,
    isToday,
    now: ph.now,
    onShare: share,
    onMorning: () => nav.push(morningPath(date), { shared: morningLineId(date) }),
    onOpenNext: () => face.next && openSession(face.next.date, face.next.session),
    onAdjust: () => lead && sheet.open({ eyebrow: label(lead.session), title: 'Miles run', body: <DistanceSheet s={lead.session} /> }),
  };
  const name = lead ? `${label(lead.session)}, ${lead.word}` : runs.length ? 'Run' : face.stamp === 'REST' ? 'Rest day' : face.stamp;
  return (
    <Pressable
      as="div"
      className={`hero aura halo-${face.halo} ${boost ? 'halo-boost' : ''} ${face.tall ? 'is-tall' : ''} ${face.quiet ? 'is-quiet' : ''} ${face.pressable ? 'is-pressable' : ''}`}
      data-face={face.kind}
      press={face.pressable ? 'scale' : 'none'}
      ignore={HERO_IGNORE}
      onPress={face.pressable ? open : undefined}
      holdMenu={lead || runs.length ? items : undefined}
      menuLabel={`${name} actions`}
      label={face.pressable ? `${name}. Open` : name}
    >
      <span className="aura-glow" aria-hidden="true" />
      <AnimatePresence initial={false} mode="popLayout">
        <motion.div key={face.key} className="hero-face" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={crossfade}>
          <FaceView c={c} />
        </motion.div>
      </AnimatePresence>
      {face.ring && lead ? (
        <span className="hero-ring" key={lead.session.id}>
          <HoldRing label={`Hold to mark ${label(lead.session)} done`} done={face.ring === 'done'} onComplete={() => complete(lead.session)} onTap={open} />
        </span>
      ) : null}
    </Pressable>
  );
};

/**
 * The second session of a two-session day (§3.4, §3.1 row 3): a compact card, 60 tall: the stamp (17), the plan and its word
 * (15), the 40 px hold ring on the right while it is open today. Tap → its sheet; hold → `Done · Skip · Move`.
 */
export const SecondSession = memo(function SecondSession({ date, log }: { date: ISODate; log: Log }) {
  const ph = useMemo(() => phaseOf(log, date, 12 * 60), [log, date]);
  const lead = ph.training[0] ?? null;
  const p: PhaseSession | null = secondOf(ph, lead);
  const openSession = useOpenSession(log);
  const act = useSessionActions(log);
  const toast = useToast();
  const { mark } = useSessionMutations();
  if (!p || !lead) return null;
  const s = p.session;
  const isToday = date === log.today;
  const open = p.key === 'today' && isToday;
  const sub = [s.kind === 'run' && s.miles ? `${num(s.miles)} mi` : s.minutes ? `${s.minutes} min` : null, p.key === 'today' ? 'Planned' : p.word].filter(Boolean).join(' · ');
  const items: ContextMenuItem[] = [];
  if (p.key !== 'done' && p.key !== 'floor' && date <= log.today) items.push({ label: 'Done', onSelect: () => (haptics.success(), mark.mutate({ session: s, mark: 'done' })) });
  if (p.key === 'today' || p.key === 'planned')
    items.push({
      label: 'Skip',
      onSelect: () => {
        const was = s.mark;
        mark.mutate({ session: s, mark: 'skip' });
        toast(`${label(s)} skipped`, { label: 'Undo', fn: () => mark.mutate({ session: { ...s, mark: 'skip' }, mark: was }) });
      },
    });
  if (p.key !== 'done' && p.key !== 'floor') items.push({ label: 'Move', onSelect: () => act.move(date, s) });
  return (
    <Pressable
      as="div"
      className={`second-session card ${isToday ? '' : 'is-quiet'}`}
      ignore=".hold-ring"
      onPress={() => openSession(date, s)}
      holdMenu={items.length ? items : undefined}
      menuLabel={`${label(s)} actions`}
      label={`${label(s)}, ${p.word}. Open`}
    >
      <span className="ss-text">
        <span className="ss-stamp">{label(s)}</span>
        <span className="ss-sub">{sub}</span>
      </span>
      {open || (isToday && (s.mark === 'done' || s.mark === 'floor')) ? (
        <span className="ss-ring">{<HoldRing size={40} label={`Hold to mark ${label(s)} done`} done={s.mark === 'done' || s.mark === 'floor' ? true : undefined} onComplete={() => mark.mutate({ session: s, mark: 'done' })} onTap={() => openSession(date, s)} />}</span>
      ) : null}
    </Pressable>
  );
});
