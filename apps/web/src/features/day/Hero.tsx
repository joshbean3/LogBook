import { clock, isAutoStatus, isSkipMark, label, num, type ISODate, type PhaseSession } from '@logbook/shared';
import { useQueryClient } from '@tanstack/react-query';
import { ChevronRight } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import type * as React from 'react';
import { lazy, memo, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useNav } from '@/app/NavController';
import { fetchCoachRead, useStravaChecking } from '@/api/queries';
import { CHECKING_MAX_MS, CHECKING_MIN_MS } from '@/lib/gesture';
import { fadeIn, fadeOut } from '@/lib/motion';
import { AuraStat, Card, Mark, Row, StatStrip } from '@/ui/primitives';
import { Pressable } from '@/ui/Pressable';
import { markSeenToday } from '@/ui/useFirstToday';
import type { ContextMenuItem } from '@/ui/ContextMenu';
import type { Log } from '../log/useLog';
import { connectStrava, useStravaPrimer } from '../onboarding';
import { useSessionActions } from '../sessions/actions';
import { useOpenSession, useOpenUnplanned } from '../sessions/SessionCard';
import { setCoachShown, useCoachShown } from './coachShown';
import { coachSentence, heroOf, milesText, phaseOf, secondOf, type HeroWords } from './faces';
import { useIsLive } from './live';
import { LandingRoute } from './RunLanding';
import { useFaceMinutes } from './useDeferred';

export const morningPath = (date: ISODate) => `/today/${date}/morning`;
/** Pointers that start on these are not the card's: the status line and the caption own their press. */
const HERO_IGNORE = '.hero-status, .hero-caption';
/** The hold menu's four, in the order they are reached for (the sheet, a tap away, has the rest). */
const MENU_ORDER = ['Done', 'Not done', 'Floor', 'Clear floor', 'Skip', 'Put it back', 'Move', 'Edit'];
// the plan builder is rare (a few days a block) and heavy: loaded when its caption is first tapped for
const PlanEndCaption = lazy(() => import('./PlanEndCaption'));

/** `Checking Strava…` while a non-quiet `/strava/sync` runs, for at least `CHECKING_MIN_MS` and at most `CHECKING_MAX_MS`. */
const useCheckingLine = () => {
  const checking = useStravaChecking();
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
    setHold(true);
    const t = setTimeout(() => {
      since.current = 0;
      setHold(false);
    }, Math.max(0, CHECKING_MIN_MS - (performance.now() - since.current)));
    return () => clearTimeout(t);
  }, [checking]);
  return (checking && !capped) || (hold && !capped);
};

/** The one status line: its words change with the clock and Strava; a tap pushes This morning when the morning is known. */
const StatusLine = ({ text, live, onMorning }: { text: string; live: boolean; onMorning: (() => void) | null }) => {
  const checking = useCheckingLine() && live;
  const shown = checking ? 'Checking Strava…' : text;
  const body = (
    <AnimatePresence initial={false} mode="popLayout">
      <motion.span key={shown} className="hero-status-in" initial={{ opacity: 0 }} animate={{ opacity: 1, transition: fadeIn }} exit={{ opacity: 0, transition: fadeOut }}>
        {shown}
        {onMorning ? <ChevronRight size={14} aria-hidden="true" /> : null}
      </motion.span>
    </AnimatePresence>
  );
  if (!onMorning) return <span className="hero-status">{body}</span>;
  return (
    <Pressable className="hero-status is-link" press="dim" onPress={onMorning} label={`${shown}. Open this morning`}>
      {body}
    </Pressable>
  );
};

/** The run's numbers (DISTANCE · PACE · TIME), the route and the coach's one sentence, once a run has landed. */
const Landed = ({ w, date, live }: { w: HeroWords; date: ISODate; live: boolean }) => {
  const L = w.landed!;
  const fresh = useCoachShown(date, w.lead ? w.lead.session.id : 'run');
  const coach = coachSentence(L.coach ?? fresh);
  return (
    <>
      <StatStrip className="hero-stats">
        <AuraStat label="Distance" value={milesText(L.miles)} unit="mi" />
        {L.paceSec ? <AuraStat label="Pace" value={clock(L.paceSec)} unit="/mi" /> : null}
        {L.sec ? <AuraStat label="Time" value={clock(L.sec)} /> : null}
      </StatStrip>
      {L.polyline ? <LandingRoute polyline={L.polyline} drawKey={live ? L.drawKey : null} date={date} /> : null}
      {coach ? <p className="hero-coach">{coach}</p> : null}
    </>
  );
};

/**
 * The coach's one sentence: once per matched run, when the month has no read for that date and session, the client asks
 * `POST /coach/read`; the answer joins the month's payload in place and shows from `coachShown`. Nothing waits for it.
 */
const useCoachRead = (date: ISODate, log: Log, w: HeroWords, live: boolean) => {
  const qc = useQueryClient();
  const sessionId = w.lead?.session.id ?? null;
  const want = live && date === log.today && log.features.claude && !!w.landed && !w.landed.coach;
  const k = `coach-${date}-${sessionId ?? 'run'}`;
  useEffect(() => {
    if (!want) return;
    let seen = false;
    try {
      seen = localStorage.getItem(`logbook.seen.${k}.${log.today}`) === '1';
    } catch {
      seen = true;
    }
    if (seen) return;
    markSeenToday(k);
    fetchCoachRead(qc, date, sessionId)
      .then((r) => setCoachShown(date, r.key || (sessionId ?? 'run'), r.text))
      .catch(() => undefined);
  }, [want, k]); // eslint-disable-line react-hooks/exhaustive-deps
};

/** The second session of a two-session day: a 60 row under the hero's words, with its own Mark; tap → its sheet. */
const SecondRow = ({ date, log, p }: { date: ISODate; log: Log; p: PhaseSession }) => {
  const openSession = useOpenSession(log);
  const act = useSessionActions(log);
  const s = p.session;
  const sub = [s.kind === 'run' && s.miles ? `${num(s.miles)} mi` : s.minutes ? `${s.minutes} min` : null, p.key === 'today' ? 'Planned' : p.word].filter(Boolean).join(' · ');
  const items = menuOf(act.menuItems(date, s));
  return (
    <Pressable as="div" className="hero-second" press="surface" ignore=".mark-hit" onPress={() => openSession(date, s)} holdMenu={items.length ? items : undefined} menuLabel={`${label(s)} actions`} label={`${label(s)}, ${sub}. Open`}>
      <Row title={label(s)} sub={sub} right={<SessionMark date={date} log={log} p={p} />} />
    </Pressable>
  );
};

/** The four the hold menu holds, from the session's full list. */
const menuOf = (all: ContextMenuItem[]): ContextMenuItem[] => {
  const picked = MENU_ORDER.map((l) => all.find((i) => i.label === l)).filter((i): i is ContextMenuItem => !!i);
  return picked.slice(0, 4);
};

/** A session's Mark: its status from `status.ts`; a tap marks it done, takes a hand mark back, or puts a skipped one back. */
const SessionMark = ({ date, log, p }: { date: ISODate; log: Log; p: PhaseSession }) => {
  const act = useSessionActions(log);
  const s = p.session;
  const auto = isAutoStatus(log.snap, date, s);
  const can = date <= log.today && !auto;
  const onClick = () => {
    if (!can) return;
    if (s.mark === 'done' || s.mark === 'floor') act.clear(s);
    else if (isSkipMark(s.mark)) act.skip(s);
    else act.done(s);
  };
  const word = p.status === 'done' || p.status === 'floor' ? `${p.word}. ${auto ? '' : 'Not done'}`.trim() : p.status === 'skipped' ? 'Skipped. Put it back' : `Mark ${label(s)} done`;
  return <Mark status={p.status} onClick={can ? onClick : undefined} disabled={!can} label={word} haptic="success" />;
};

/**
 * The workout (docs/system.md §5): one `Card hero` with the halo, the same layout every day and every hour. A caps eyebrow,
 * the session's name as the stamp, the plan in the serif, one status line whose words follow the clock and Strava, the
 * numbers and the route once a run has landed, and one control: the Mark at the right. Tap the card for the session sheet;
 * hold it for Done · Floor · Skip · Move. A second session is a row under the words; a rest day says what is next.
 */
export const Hero = memo(function Hero({ date, log }: { date: ISODate; log: Log }): React.JSX.Element {
  const minutes = useFaceMinutes();
  const ph = useMemo(() => phaseOf(log, date, minutes), [log, date, minutes]);
  const w = useMemo(() => heroOf(log, date, ph), [log, date, ph]);
  const nav = useNav();
  const live = useIsLive(date);
  const openSession = useOpenSession(log);
  const openUnplanned = useOpenUnplanned();
  const act = useSessionActions(log);
  const primer = useStravaPrimer();
  useCoachRead(date, log, w, live);
  const lead = w.lead;
  const s = lead?.session ?? null;
  const second = useMemo(() => secondOf(ph, lead), [ph, lead]);
  const pressable = !!s || w.runs.length > 0;
  const open = () => {
    if (s) openSession(date, s, { fromHero: true });
    else if (w.runs.length) openUnplanned(date, w.runs, log);
  };
  const items = s ? menuOf(act.menuItems(date, s)) : [];
  const name = s ? `${label(s)}, ${lead!.word}` : w.runs.length ? 'Run' : 'Rest day';
  // the Strava row: once, quietly, while Strava is not connected and nothing has ever landed in the months on this page
  const noRuns = date === log.today && primer.show && !log.snap.runsOn(date).length;
  const caption = w.caption;
  return (
    <Card className={`hero halo halo-${w.halo}`} data-hero={w.key} aria-label={name}>
      <div className="hero-top">
        <Pressable
          as="div"
          className="hero-main"
          press={pressable ? 'dim' : 'none'}
          ignore={HERO_IGNORE}
          onPress={pressable ? open : undefined}
          holdMenu={items.length ? items : undefined}
          menuLabel={`${name} actions`}
          label={pressable ? `${name}. Open` : name}
        >
          <span className="caps hero-eyebrow">{w.eyebrow}</span>
          <span className="stamp hero-stamp">{w.stamp}</span>
          <span className="serif hero-sub">{w.sub}</span>
          {w.status ? <StatusLine text={w.status} live={live} onMorning={w.morning ? () => nav.push(morningPath(date)) : null} /> : null}
          {caption ? (
            <Suspense fallback={<span className="hero-caption">{caption}</span>}>
              <PlanEndCaption log={log} text={caption} />
            </Suspense>
          ) : null}
        </Pressable>
        {w.mark && lead ? (
          <span className="hero-mark">
            <SessionMark date={date} log={log} p={lead} />
          </span>
        ) : w.mark ? (
          <span className="hero-mark">
            <Mark status={w.mark} disabled label={`${name}, logged`} />
          </span>
        ) : null}
      </div>
      {w.landed ? <Landed w={w} date={date} live={live} /> : null}
      {second && lead ? <SecondRow date={date} log={log} p={second} /> : null}
      {noRuns ? (
        <Row className="hero-row" title="Connect Strava to log runs automatically" right={<ChevronRight size={16} className="lrow-chev" aria-hidden="true" />} onClick={() => void connectStrava()} label="Connect Strava to log runs automatically" />
      ) : null}
    </Card>
  );
});
