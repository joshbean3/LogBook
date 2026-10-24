import { label, num, type Activity, type ISODate, type PhaseSession, type Session, type SessionMark } from '@logbook/shared';
import { ChevronRight, Share } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import type * as React from 'react';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { useNav } from '@/app/NavController';
import { useSessionMutations, useStravaChecking } from '@/api/queries';
import { CHECKING_MAX_MS, CHECKING_MIN_MS, HOLD_SLOP_PX } from '@/lib/gesture';
import { haptics } from '@/lib/haptics';
import { crossfade, fadeIn, fadeOut } from '@/lib/motion';
import { Button, Pressable, Stepper, useSheet, useToast, type ContextMenuItem } from '@/ui';
import type { Log } from '../log/useLog';
import { useSessionActions } from '../sessions/actions';
import { shareDataFor, useOpenSession, useOpenUnplanned } from '../sessions/SessionCard';
import { ShareSheet } from '../share/ShareSheet';
import { isPagerMoving, useIsLive } from './live';
import { CloseDay } from './CloseDay';
import { faceOf, phaseOf, preLandingFace, secondOf, type Face } from './faces';
import { HoldRing } from './HoldRing';
import { sessionMiles, weekMiles } from './miles';
import { MiniTimeline, OutLine } from './MiniTimeline';
import { LandedDeck, LandingRoute, RingSlot, SharePill } from './RunLanding';
import { markSuccess, StravaRetry, useStravaLanding } from './useStravaLanding';
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
  // shown on the render the check starts (no effect in between: the line's first frame is the next one)
  const since = useRef(0);
  if (checking && !since.current) since.current = performance.now();
  const [hold, setHold] = useState(false);
  const [capped, setCapped] = useState(false);
  useEffect(() => {
    if (checking) {
      setCapped(false);
      const cap = setTimeout(() => setCapped(true), Math.max(0, CHECKING_MAX_MS - (performance.now() - since.current)));
      return () => clearTimeout(cap);
    }
    if (!since.current) return;
    // it stays CHECKING_MIN_MS at least, then fades out
    setHold(true);
    const t = setTimeout(() => {
      since.current = 0;
      setHold(false);
    }, Math.max(0, CHECKING_MIN_MS - (performance.now() - since.current)));
    return () => clearTimeout(t);
  }, [checking]);
  return (checking && !capped) || (hold && !capped);
};

/** `fadeIn`'s value one frame (16.7 ms) into its 120 ms on the (.22, 1, .36, 1) curve. */
const FADE_FIRST_FRAME = 0.4;

const StatusLine = ({ text }: { text: string }) => {
  const checking = useCheckingLine();
  return (
    <span className="hero-status" aria-live="polite">
      <AnimatePresence initial={false} mode="popLayout">
        {/* the fade starts one frame in (motion's first frame samples 0): the line is on the first frame after the check starts */}
        <motion.span key={checking ? 'checking' : text} className="hero-status-in" initial={{ opacity: FADE_FIRST_FRAME }} animate={{ opacity: 1, transition: fadeIn }} exit={{ opacity: 0, transition: fadeOut }}>
          {checking ? 'Checking Strava…' : text}
        </motion.span>
      </AnimatePresence>
    </span>
  );
};

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
  /** The landing's hold on the landed face's numbers, route and verdict (§6.1). */
  numbers: 'hold' | 'go' | 'still';
}

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
  if (face.landed) return <LandedDeck face={face} numbers={c.numbers} easyPace={c.log.snap.easyPace ?? null} onShare={c.onShare} />;
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
      {/* the verdict crossfades in once the landing's FLIP is at rest (§6.1 stage 4) */}
      <motion.p className="hero-line" initial={false} animate={{ opacity: c.numbers === 'hold' ? 0 : 1 }} transition={crossfade}>
        {face.line}
      </motion.p>
      {face.tall && face.landed?.polyline ? <LandingRoute polyline={face.landed.polyline} drawKey={c.isToday ? face.landed.drawKey : null} date={c.date} numbers={c.numbers} /> : null}
      <Deck c={c} />
    </>
  );
};

interface DeckActions {
  onShare: () => void;
  onMorning: () => void;
  onOpenNext: () => void;
  onAdjust: () => void;
}
/**
 * One face in its layer (`.hero-face`), memoised on what it draws: the hero's handlers come through a stable object, so a
 * landing stage (a class, an opacity) re-renders no face.
 */
const FaceLayer = memo(function FaceLayer({ face, numbers, date, log, isToday, now, acts }: { face: Face; numbers: DeckCtx['numbers']; date: ISODate; log: Log; isToday: boolean; now: number; acts: DeckActions }) {
  return <FaceView c={{ date, log, face, isToday, now, numbers, ...acts }} />;
});

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
        {evening ? <EveningFace date={date} log={log} ph={ph} onOpen={(p) => openSession(date, p.session, { fromHero: true })} /> : <DayHero date={date} log={log} ph={ph} face={face} minutes={minutes} />}
      </motion.div>
    </AnimatePresence>
  );
});

/**
 * The click a touch makes after its release, when the release already acted: it would land on what the release opened (the
 * sheet's scrim, which closes the sheet). Swallowed at the window in the capture phase; a click with no pointer behind it
 * (`detail === 0`: Enter, Space, VoiceOver) is never swallowed, and the arm goes at the next touch or after 600 ms.
 * (A local stand-in for WP1's internal click swallow, until Pressable has a release option: docs/reviews/wp2.md, Requests.)
 */
const swallowNextClick = () => {
  const on = (e: MouseEvent) => {
    if (e.detail === 0) return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    done();
  };
  const done = () => {
    clearTimeout(t);
    window.removeEventListener('click', on, true);
    window.removeEventListener('pointerdown', done, true);
  };
  const t = setTimeout(done, 600);
  window.addEventListener('click', on, true);
  window.addEventListener('pointerdown', done, true);
};

/** The 184 card (304 landed): every face but the evening's. The run landing (§6.1) plays on it. */
const DayHero = ({ date, log, ph, face: dayFace, minutes }: { date: ISODate; log: Log; ph: ReturnType<typeof phaseOf>; face: Face; minutes: number }) => {
  const nav = useNav();
  const sheet = useSheet();
  const toast = useToast();
  const openSession = useOpenSession(log);
  const openUnplanned = useOpenUnplanned();
  const act = useSessionActions(log);
  const { mark } = useSessionMutations();
  const [boost, setBoost] = useState(false);
  const isToday = date === log.today;
  const hero = useRef<HTMLElement | null>(null);
  // the face from before today's run, for the landing to wait on and play stages 1–2 from (cheap: only when it may be needed)
  const pre = useMemo(() => (isToday && dayFace.kind === 'landed' ? preLandingFace(log, date, minutes) : dayFace), [isToday, dayFace, log, date, minutes]);
  const landing = useStravaLanding({ date, log, face: dayFace, pre, hero });
  const face = landing.show;
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
  /*
   * The tap opens the sheet on its release (§9.4 M7: the body renders on pointerup, the first motion frame is the next one):
   * on touch the click comes a task later (1×: 4–7 ms, 4×: 23–39 ms), which cost the sheet's first frame (§14 27). A touch
   * that came up before the hold, within the hold's slop, not on the ring or the stops line, and that did not land on a
   * moving page (that touch is the pager's: it catches the slide and its click is swallowed) opens here; its click is then
   * skipped. A click with no touch before it (a mouse, Enter, Space, VoiceOver) opens from the click as before.
   */
  const tap = useRef<{ x: number; y: number; moved: boolean; held: boolean; opened: number } | null>(null);
  const onRelease = (e: React.PointerEvent<HTMLElement>) => {
    const p = tap.current;
    if (!p || p.moved || p.held || p.opened || e.pointerType === 'mouse' || isPagerMoving()) return;
    p.opened = performance.now();
    open();
    swallowNextClick();
  };
  const onClickPress = () => {
    const p = tap.current;
    tap.current = null;
    if (p?.opened && performance.now() - p.opened < 1000) return;
    open();
  };
  const share = () => sheet.open({ title: 'Share', body: <ShareSheet data={shareFor(date, lead?.session ?? null, runs, log)} initial={runs.some((r) => r.polyline) ? 'route' : runs.length ? undefined : 'bubble'} /> });
  const setMark = (s: Session, m: SessionMark | null) => mark.mutate({ session: s, mark: m });
  /** The session done by hand (the ring, or Done in the menu): the day's one success for it, the halo blooms. */
  const complete = (s: Session) => {
    markSuccess(s.id);
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

  // the handlers, current on every render, through one stable object (the face layers are memoised)
  const latest = useRef<DeckActions>(null as unknown as DeckActions);
  latest.current = {
    onShare: share,
    onMorning: () => nav.push(morningPath(date), { shared: morningLineId(date) }),
    onOpenNext: () => face.next && openSession(face.next.date, face.next.session),
    onAdjust: () => lead && sheet.open({ eyebrow: label(lead.session), title: 'Miles run', body: <DistanceSheet s={lead.session} /> }),
  };
  const [acts] = useState<DeckActions>(() => ({
    onShare: () => latest.current.onShare(),
    onMorning: () => latest.current.onMorning(),
    onOpenNext: () => latest.current.onOpenNext(),
    onAdjust: () => latest.current.onAdjust(),
  }));
  // while the landing waits and plays stages 1–2, the landed face is already mounted, hidden, under the face from before the
  // run (its layer over it): stage 3 then only swaps two opacities and the card's height, with no face to render (§6.1)
  const st = landing.stage;
  const preShown = st === 'wait' || st === 'fill' || st === 'morph';
  const preLayer = preShown || st === 'grow';
  const main = preLayer ? dayFace : face;
  const name = lead ? `${label(lead.session)}, ${lead.word}` : runs.length ? 'Run' : face.stamp === 'REST' ? 'Rest day' : face.stamp;
  // the ring: the face's own (open, or the check after a hand completion), or the one the landing carries through the FLIP
  const ringLead = lead ?? pre.lead;
  const ringOn = !!ringLead && (landing.ringShown || !!face.ring);
  const ringDone = landing.ring ? landing.stage !== 'wait' && landing.stage !== 'fill' ? true : pre.ring === 'done' : face.ring === 'done';
  return (
    <Pressable
      ref={hero}
      as="div"
      className={`hero aura halo-${face.halo} ${boost || landing.boost ? 'halo-boost' : ''} ${face.tall ? 'is-tall' : ''} ${face.quiet ? 'is-quiet' : ''} ${face.pressable ? 'is-pressable' : ''}`}
      data-face={face.kind}
      data-landing={landing.stage === 'still' ? undefined : landing.stage}
      press={face.pressable ? 'scale' : 'none'}
      ignore={HERO_IGNORE}
      onPress={face.pressable ? onClickPress : undefined}
      onHold={() => {
        if (tap.current) tap.current.held = true;
      }}
      onPointerDown={(e: React.PointerEvent<HTMLElement>) => {
        const ok = face.pressable && e.isPrimary && e.pointerType !== 'mouse' && !(e.target instanceof Element && e.target.closest(HERO_IGNORE)) && !isPagerMoving();
        tap.current = ok ? { x: e.clientX, y: e.clientY, moved: false, held: false, opened: 0 } : null;
      }}
      onPointerMove={(e: React.PointerEvent<HTMLElement>) => {
        const p = tap.current;
        if (p && !p.moved && Math.hypot(e.clientX - p.x, e.clientY - p.y) > HOLD_SLOP_PX) p.moved = true;
      }}
      onPointerUp={face.pressable ? onRelease : undefined}
      onPointerCancel={() => {
        tap.current = null;
      }}
      holdMenu={lead || runs.length ? items : undefined}
      menuLabel={`${name} actions`}
      label={face.pressable ? `${name}. Open` : name}
    >
      <span className="aura-glow" aria-hidden="true" />
      <AnimatePresence initial={false} mode="popLayout">
        <motion.div key={main.key} className="hero-face" data-k={main.kind} initial={{ opacity: 0 }} animate={{ opacity: preShown ? 0 : 1 }} exit={{ opacity: 0 }} transition={crossfade} inert={preShown || undefined} aria-hidden={preShown || undefined}>
          <FaceLayer face={main} numbers={landing.numbers} date={date} log={log} isToday={isToday} now={ph.now} acts={acts} />
        </motion.div>
      </AnimatePresence>
      {preLayer ? (
        <motion.div key="pre" className="hero-face hero-face-pre" data-k={pre.kind} initial={false} animate={{ opacity: preShown ? 1 : 0 }} transition={crossfade}>
          <FaceLayer face={pre} numbers="still" date={date} log={log} isToday={isToday} now={ph.now} acts={acts} />
        </motion.div>
      ) : null}
      {/* a foreground check that found nothing while the session is open past its back time: one quiet repeat at +8 s (§6.1) */}
      {isToday && face.kind === 'open' ? <StravaRetry date={date} /> : null}
      {ringOn && ringLead ? (
        <RingSlot key={ringLead.session.id} leaving={landing.stage === 'draw'}>
          <HoldRing label={`Hold to mark ${label(ringLead.session)} done`} done={ringDone} drive={landing.ring ?? undefined} onComplete={() => complete(ringLead.session)} onTap={open} />
        </RingSlot>
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
  if (p.key !== 'done' && p.key !== 'floor' && date <= log.today) items.push({ label: 'Done', onSelect: () => (haptics.success(), markSuccess(s.id), mark.mutate({ session: s, mark: 'done' })) });
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
        <span className="ss-ring">{<HoldRing size={40} label={`Hold to mark ${label(s)} done`} done={s.mark === 'done' || s.mark === 'floor' ? true : undefined} onComplete={() => (markSuccess(s.id), mark.mutate({ session: s, mark: 'done' }))} onTap={() => openSession(date, s)} />}</span>
      ) : null}
    </Pressable>
  );
});
