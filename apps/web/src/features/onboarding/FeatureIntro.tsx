import { INTRO_KEYS, type IntroKey } from '@logbook/shared';
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type * as React from 'react';
import { useEffect } from 'react';
import { api } from '@/api/client';
import { useBootstrap } from '@/api/queries';
import { useNavState } from '@/app/NavController';
import { Pressable, useSheet } from '@/ui';
import { JournalCard, LearnedCard, WeekCard } from './cards';
import { introDue, type Intros } from './introDue';
import './featureIntro.css';

/**
 * Features introduce themselves the first time they are used (inspiration §6 Onboarding: one sheet with a visual, two lines
 * and how often it updates; references 305, 479, 619). One sheet per feature, once per account:
 *
 * - who: only accounts that went through first run (the payoff enrolls them, user_settings `intros`); an account from before
 *   (the owner's) is not enrolled, so nobody is introduced to a tab they already use;
 * - once: the key is marked on the account (so a second device stays quiet) and on this device (so an offline open does not
 *   ask twice);
 * - when: the tab is shown at its root, nothing pushed over it, no sheet already up, a beat after it paints.
 *
 * `useFeatureIntro(key, ready)` is the reusable part; `FeatureIntros` wires Plan, Learned and Journal from the navigation
 * state, so their views need no change.
 */

export const introsKey = ['intros'] as const;
const useIntros = (enabled: boolean) => useQuery({ queryKey: introsKey, queryFn: () => api<Intros>('/me/intros'), enabled, staleTime: 5 * 60_000 });

const hereKey = (uid: string, key: IntroKey) => `logbook.intro.${uid}.${key}`;
const seenHere = (uid: string, key: IntroKey) => {
  try {
    return localStorage.getItem(hereKey(uid, key)) === '1';
  } catch {
    return false;
  }
};
const markHere = (uid: string, key: IntroKey) => {
  try {
    localStorage.setItem(hereKey(uid, key), '1');
  } catch {
    /* private mode: the account's own mark still holds */
  }
};


/** First run's payoff: this account gets the intros. Answers with the account's list, kept in the cache. */
export const enrollIntros = (qc: QueryClient) =>
  api<Intros>('/me/intros/enroll', { method: 'POST' })
    .then((r) => qc.setQueryData(introsKey, r))
    .catch(() => undefined);

export interface IntroSpec {
  title: string;
  visual: React.ReactNode;
  /** Two lines: what it is, and how it fills or how often it updates. */
  lines: [string, string];
}
export const INTROS: Record<IntroKey, IntroSpec> = {
  plan: {
    title: 'Your plan',
    visual: <WeekCard compact />,
    lines: ['Your runs and lifts, week by week, with the morning on top.', 'Tap a day to change it. The assistant’s changes wait for your OK.'],
  },
  learned: {
    title: 'What I learned',
    visual: <LearnedCard />,
    lines: ['One thing a day, in a line.', 'Kept by month. Some come back later in Remember when.'],
  },
  journal: {
    title: 'Journal',
    visual: <JournalCard />,
    lines: ['How the day went, in your own words.', 'Once a day, an old entry comes back as Remember when.'],
  },
};

const IntroSheet = ({ spec }: { spec: IntroSpec }): React.JSX.Element => {
  const sheet = useSheet();
  return (
    <div className="fi">
      <div className="fi-visual">{spec.visual}</div>
      <p className="fi-line">{spec.lines[0]}</p>
      <p className="fi-line sub">{spec.lines[1]}</p>
      <Pressable className="btn primary block fi-cta" onPress={() => sheet.close()}>
        Continue
      </Pressable>
    </div>
  );
};

/** Open `key`'s intro once, the first time `ready` is true for an enrolled account. */
export const useFeatureIntro = (key: IntroKey, ready: boolean, spec: IntroSpec = INTROS[key]) => {
  const sheet = useSheet();
  const qc = useQueryClient();
  const uid = useBootstrap().data?.user.id;
  const intros = useIntros(!!uid);
  const due = !!uid && introDue(key, intros.data, seenHere(uid, key), ready);
  useEffect(() => {
    if (!due || !uid) return;
    // a beat after the tab paints, so the sheet rises over the page it introduces
    const t = setTimeout(() => {
      if (sheet.isOpen()) return;
      markHere(uid, key);
      qc.setQueryData<Intros>(introsKey, (cur) => ({ seen: [...(cur?.seen ?? []), key] }));
      void api('/me/intros/seen', { method: 'POST', json: { key } }).catch(() => undefined);
      sheet.open({ title: spec.title, body: <IntroSheet spec={spec} /> });
    }, 450);
    return () => clearTimeout(t);
  }, [due, uid, key]); // eslint-disable-line react-hooks/exhaustive-deps
};

/** Plan, Learned and Journal, each the first time it is shown at its root. Mounted once in the framed app. */
export const FeatureIntros = (): null => {
  const s = useNavState();
  const atRoot = (k: IntroKey) => s.active === k && s.tabs[k].stack.length === 0 && s.overlays === 0;
  useFeatureIntro(INTRO_KEYS[0], atRoot(INTRO_KEYS[0]));
  useFeatureIntro(INTRO_KEYS[1], atRoot(INTRO_KEYS[1]));
  useFeatureIntro(INTRO_KEYS[2], atRoot(INTRO_KEYS[2]));
  return null;
};
