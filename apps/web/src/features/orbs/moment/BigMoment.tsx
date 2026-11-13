import { chapterNumber, ruleLine, type Aim, type Moment } from '@logbook/shared';
import { useQueryClient } from '@tanstack/react-query';
import { AnimatePresence } from 'motion/react';
import type * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { GoalDoneTitle, MomentPage } from '@/features/goals/Celebrate';
import { useFitness } from '@/lib/prefs';
import { OrbLight } from '@/ui/OrbLight';
import { getOrbs, getSwitches, markSeen, pendingMoments } from '../store';
import { handState, overlaysOpen, popping, subscribeRest } from './index';
import { mayShowBig, momentWords } from './rules';

/** How long after its cause a big moment may still open: past this the hand was never at rest, and it waits for the next. */
const CAUSE_MS = 20_000;
/** Away this long and coming back is an open. */
const AWAY_MS = 30_000;
/** After the Close card's save: its own light and its `success` play first. */
const AFTER_CLOSE_MS = 1400;
const AFTER_OPEN_MS = 900;
const typing = () => {
  const a = document.activeElement;
  return !!a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || (a as HTMLElement).isContentEditable);
};
/** The opening (the sunrise, or its quiet fade) is still over the app. */
const opening = () => !!document.querySelector('.bs');

/**
 * The big moments (spec section 6): a week, month or year goal; weeks in a row 4, 12, 26, 52; days in all 100, 365,
 * 1,000; a chapter. Full screen, with an explicit "Keep going" and no close of its own. One opens only at rest: on the
 * next open of the app or after the Close card's save, never from a routine tap, never over a sheet, never mid-list
 * (`mayShowBig`). The engine holds them to two in any seven days (`pendingMoments`); the rest wait as "New" rows on the
 * Orbs page. Dismissing one marks it seen. With "Show Orbs when you earn them" off none opens.
 */
export const BigMoment = (): React.JSX.Element => {
  const [m, setM] = useState<Moment | null>(null);
  const qc = useQueryClient();
  const fitness = useFitness();
  const showing = useRef(false);
  showing.current = !!m;
  useEffect(() => {
    let cause: { why: 'open' | 'closed-day'; from: number; until: number } | null = null;
    let timer: ReturnType<typeof setInterval> | undefined;
    const stop = () => {
      clearInterval(timer);
      timer = undefined;
      cause = null;
    };
    const look = () => {
      const now = performance.now();
      if (!cause || now > cause.until) return stop();
      if (now < cause.from) return;
      const sw = getSwitches();
      const pending = sw.on && sw.show ? pendingMoments() : [];
      // nothing waiting once the store has been read: this cause is spent
      if (!pending.length && getOrbs() && now > cause.from + 3000) return stop();
      const hand = handState();
      if (!mayShowBig({ pending: pending.length, showing: showing.current, overlays: overlaysOpen(), typing: typing(), touching: hand.touching, quietMs: hand.quietMs, popping: popping(), away: document.hidden || opening(), cause: cause.why })) return;
      stop();
      setM(pending[0]!);
    };
    const arm = (why: 'open' | 'closed-day') => {
      const now = performance.now();
      cause = { why, from: now + (why === 'open' ? AFTER_OPEN_MS : AFTER_CLOSE_MS), until: now + CAUSE_MS };
      if (!timer) timer = setInterval(look, 300);
    };
    arm('open');
    let hiddenAt = 0;
    const vis = () => {
      if (document.hidden) hiddenAt = performance.now();
      else if (hiddenAt && performance.now() - hiddenAt > AWAY_MS) arm('open');
    };
    document.addEventListener('visibilitychange', vis);
    const off = subscribeRest(() => arm('closed-day'));
    return () => {
      stop();
      document.removeEventListener('visibilitychange', vis);
      off();
    };
  }, []);
  const close = () => {
    if (m) markSeen(m.key);
    setM(null);
  };
  let page: React.JSX.Element | null = null;
  if (m) {
    const s = getOrbs();
    const [what, level, period] = m.key.split(':');
    const goalText = what === 'goal' ? qc.getQueryData<Aim[]>(['goals'])?.find((g) => g.level === level && g.period === period)?.text : undefined;
    const w = momentWords(m, { goalText, chapter: s && what === 'chapter' ? chapterNumber(s, m.key) : undefined, fitness, rule: ruleLine(getSwitches().weekTarget) });
    page = (
      <MomentPage key={m.key} label={w.label} disc={w.disc === 'check' ? undefined : w.disc} title={what === 'goal' ? <GoalDoneTitle /> : w.title} line={w.line} quote={w.quote} onClose={close}>
        {w.paid ? (
          <p className="cel-paid">
            <OrbLight size={20} />
            {w.paid}
          </p>
        ) : null}
        {w.facts ? <p className="cel-facts">{w.facts}</p> : null}
      </MomentPage>
    );
  }
  return createPortal(<AnimatePresence>{page}</AnimatePresence>, document.body);
};
