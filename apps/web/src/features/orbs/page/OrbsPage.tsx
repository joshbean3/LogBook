import { countLine, daysBetween, fmt, isBigMoment, mondayLine, parseISO, RULES, ruleLine } from '@logbook/shared';
import type * as React from 'react';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { SectionBoundary } from '@/app/ErrorBoundary';
import { useNav } from '@/app/NavController';
import { GoRow } from '@/features/settings/parts';
import { useFitness } from '@/lib/prefs';
import { useToday } from '@/lib/useToday';
import { PushedBar } from '@/ui/NavBar';
import { PageSection } from '@/ui/layout';
import { Poster, PosterScene } from '@/ui/poster';
import { usePop } from '@/ui/PushedLayer';
import { useSheet } from '@/ui/Sheet';
import { useToast } from '@/ui/Toast';
import { ChallengeRows } from '../challenge/ChallengeRows';
import { markSeen, newKeys, setSwitches, useCount, useLevelInfo, useNewCount, useOrbsStore, useOrbsToday, useOrbsTotal, useWeekTarget } from '../store';
import { Keepsakes } from './Keepsakes';
import { isEmpty, keepsakesOf, levelBand, levelProgress, linesOf, longDate, newRows, nextKeepsake, notStarted, num, orbs, paidOn } from './model';
import { OrbsSwitchRows } from './Switches';
import { useLeaveWhenOff } from './useLeaveWhenOff';
import { WeekMarks } from './WeekMarks';
import { Lines } from './Lines';
import '@/features/settings/settings.css';
import './orbs.css';

/** The small sheet behind "Today": the day's Orbs line by line, and under them what was paid once today. */
const TodaySheet = ({ date }: { date: string }): React.JSX.Element | null => {
  const s = useOrbsStore();
  const fitness = useFitness();
  if (!s) return null;
  const lines = linesOf(s, date, fitness);
  const paid = paidOn(s, date);
  return (
    <div className="orp-today-sheet">
      {lines.length ? <Lines lines={lines} /> : null}
      {paid.length ? (
        <>
          <h3 className="orp-choice-head">Also today</h3>
          <Lines lines={paid} />
        </>
      ) : null}
      <p className="lb-foot">{`The day’s Orbs follow what is done until ${num(RULES.close.tapHour)} in the morning. Untick something and its Orb leaves with it.`}</p>
    </div>
  );
};

/** The sheet behind a week goal's "New" row. */
const GoalSheet = ({ n }: { n: number }): React.JSX.Element => (
  <div className="orp-today-sheet">
    <Lines lines={[{ key: 'goal', label: 'Week goal', n, gem: 'goal:week' }]} />
    <p className="lb-foot">{`A week goal pays ${num(RULES.goal.base)} Orbs times ${num(RULES.goal.reach.week)}, once, when you mark it done.`}</p>
  </div>
);

/**
 * The Orbs page (`/orbs`, pushed over Today): what has been earned, in the order the eye should take it.
 *
 *   1. The bar: Back, "Orbs".
 *   2. The poster: the total with its unit, an Apricot sun standing at the progress to the next level on the dotted way,
 *      the band "LEVEL 5" over "216 to level 6"; then, on Paper, this week's seven marks and one line of fact.
 *   3. One inset group, only while it has rows: today's Orbs, anything new that is not a keepsake, the challenges.
 *   4. Keepsakes: earned ones only, and one dashed ring for what comes next.
 *   5. "How Orbs work" and the switches.
 *
 * Before the first Orb it is the poster at rest with one sentence, the rule, and the last group: no grid, no zero.
 * With Orbs off it is not a place: it leaves for Today.
 */
export default function OrbsPage(): React.JSX.Element {
  const on = useLeaveWhenOff();
  const nav = useNav();
  const pop = usePop();
  const sheet = useSheet();
  const toast = useToast();
  const today = useToday();
  const fitness = useFitness();
  const total = useOrbsTotal();
  const level = useLevelInfo();
  const count = useCount();
  const todayOrbs = useOrbsToday();
  const target = useWeekTarget();
  const store = useOrbsStore();
  // the "New" rows change with the store; the count is the primitive that says when
  const newCount = useNewCount();
  const fresh = useMemo(() => new Set(newKeys()), [store, newCount]); // eslint-disable-line react-hooks/exhaustive-deps

  // the switch on this page: the page leaves first and Orbs go off once it has gone, so its numbers do not blink out
  // under the finger. If it has not left in a moment, the switch is applied anyway (and the page takes itself off)
  const [leavingOff, setLeavingOff] = useState(false);
  const pendingOff = useRef(false);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      // really gone (a strict-mode remount sets the flag again before this runs)
      setTimeout(() => {
        if (mounted.current) return;
        if (pendingOff.current) {
          pendingOff.current = false;
          setSwitches({ on: false });
        }
      }, 0);
    };
  }, []);
  const switchOrbs = (v: boolean) => {
    if (v) return setSwitches({ on: true });
    pendingOff.current = true;
    setLeavingOff(true);
    toast('Orbs are off. Turn them on again in Settings.', { label: 'Undo', fn: () => ((pendingOff.current = false), setSwitches({ on: true })) });
    pop();
    setTimeout(() => {
      if (!pendingOff.current) return;
      pendingOff.current = false;
      setSwitches({ on: false });
    }, 1200);
  };

  // what was shown as "New" and is not a moment still waiting for its own screen is seen once the page has been left
  const shown = useRef<string[]>([]);
  shown.current = [...fresh].filter((k) => !isBigMoment(k));
  useEffect(
    () => () => {
      const keys = shown.current;
      setTimeout(() => {
        if (!mounted.current) for (const k of keys) markSeen(k);
      }, 0);
    },
    [],
  );

  // the last group needs no store: it is the way forward whatever else the page can show
  const last = (
    <PageSection className="orp-set-sec" aria-label="How Orbs work and the switches">
      <div className="group s-group">
        <OrbsSwitchRows place="page" onHow={() => nav.push('/orbs/how')} onOrbs={switchOrbs} orbsShown={!leavingOff} />
      </div>
    </PageSection>
  );
  if (!on) {
    return (
      <div className="page orp-page">
        <PushedBar title="Orbs" />
      </div>
    );
  }
  // this phone has no store yet (a new sign-in, Reset, a reinstall: it is taken from the account or rebuilt once the
  // network answers, and offline that can be a while). Never a blank page: the bar, How Orbs work and the switches, and
  // nothing the page cannot know yet (no total, no "first Orb")
  if (!store) {
    return (
      <div className="page orp-page">
        <PushedBar title="Orbs" />
        {last}
      </div>
    );
  }

  const empty = isEmpty(total);
  const waiting = notStarted(store, today);
  const band = levelBand(level);
  const line = countLine(count);
  const monday = count.today === 0 && count.days > 0 ? mondayLine(target) : null;
  const keeps = empty ? [] : keepsakesOf(store, fitness);
  const rows = empty ? [] : newRows(store, [...fresh]);
  const starts = waiting ? (daysBetween(today, store.startedOn) <= 6 ? fmt.dowLong.format(parseISO(store.startedOn)) : fmt.md.format(parseISO(store.startedOn))) : '';
  const week =
    count.days > 0 ? (
      <div className="orp-count">
        <WeekMarks marks={count.marks} today={count.today} />
        {monday ? <p className="orp-monday">{monday}</p> : null}
        {line ? (
          <p className="orp-line">
            {line.split(' · ').map((part, i, all) => (
              <Fragment key={part}>
                {i ? ' ' : null}
                <span className="orp-line-part">{i < all.length - 1 ? `${part} ·` : part}</span>
              </Fragment>
            ))}
          </p>
        ) : null}
      </div>
    ) : null;

  return (
    <div className="page orp-page">
      <PushedBar title="Orbs" />
      {empty ? (
        <Poster className="orp-poster" label={waiting ? `Orbs start ${starts}` : 'Your first Orb is one thing away'} title={waiting ? `Orbs start ${starts}` : 'Your first Orb is one thing away'} meta={waiting ? longDate(store.startedOn, today) : undefined} scene={<PosterScene progress={0} />} band={{ label: 'The rule', words: ruleLine(target) }}>
          {week}
        </Poster>
      ) : (
        <Poster
          className="orp-poster is-count"
          label={`${orbs(total)}. Level ${num(level.level)}.`}
          titleAs="p"
          title={
            <>
              <span className="orp-total">{num(total)}</span> <span className="orp-unit">{total === 1 ? 'Orb' : 'Orbs'}</span>
            </>
          }
          scene={<PosterScene progress={levelProgress(level)} />}
          band={{ label: band.label, words: band.words }}
        >
          {week}
        </Poster>
      )}

      {empty ? null : (
        <div className="group s-group orp-now">
          {todayOrbs > 0 ? <GoRow title="Today" value={orbs(todayOrbs)} label={`Today, ${orbs(todayOrbs)}. What earned them`} onPress={() => sheet.open({ eyebrow: longDate(today, today), title: `${orbs(todayOrbs)} today`, body: <TodaySheet date={today} /> })} /> : null}
          {rows.map((r) => (
            <GoRow
              key={r.key}
              title={r.title}
              sub="New"
              value={orbs(r.n)}
              label={`${r.title}, ${orbs(r.n)}. New`}
              onPress={() => {
                markSeen(r.key);
                sheet.open({ eyebrow: longDate(r.on, today), title: r.title, body: <GoalSheet n={r.n} /> });
              }}
            />
          ))}
          {/* the challenge rows read the app's caches: if they ever fail to draw, the page keeps everything else */}
          <SectionBoundary name="orbs.challenge" resetKey={today}>
            <ChallengeRows scope="page" />
          </SectionBoundary>
        </div>
      )}

      {keeps.length ? (
        <PageSection title="Keepsakes" className="orp-keeps-sec">
          <SectionBoundary name="orbs.keepsakes" resetKey={today}>
            <Keepsakes items={keeps} next={nextKeepsake(store, today)} fresh={fresh} />
          </SectionBoundary>
        </PageSection>
      ) : null}

      {last}
    </div>
  );
}
