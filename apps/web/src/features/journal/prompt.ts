import { dayPhase, label, monthOf, sessionKey, today as todayISO, type LocalNow, type MorningDayOverride, type MorningSettings, type Session } from '@logbook/shared';
import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router';
import type { AppSnapshot } from '@/api/snapshot';
import { useLog } from '../log/useLog';

/** Miles as a runner says them: "5.02 mi", "6 mi". */
const miles = (m: number) => `${Math.round(m * 100) / 100} mi`;

/**
 * The fake clock for screenshots and QA: `?at=19:30` on a local or dev build. Never on a deployed build, so a shared link
 * can't change what a real day says.
 */
const devClock = () => import.meta.env.DEV || (typeof location !== 'undefined' && /^(localhost|127\.|\[::1\])/.test(location.hostname));
export const parseAt = (search: string): number | null => {
  if (!devClock()) return null;
  const m = /(?:^|[?&])at=(\d{1,2}):(\d{2})/.exec(search);
  if (!m) return null;
  const mins = Number(m[1]) * 60 + Number(m[2]);
  return mins >= 0 && mins < 1440 ? mins : null;
};

/** Now, as the day phase wants it, re-read each minute. Honours `?at=HH:MM` on dev builds. */
export const useNow = (): LocalNow => {
  const { search } = useLocation();
  const at = parseAt(search);
  const read = (): LocalNow => {
    const d = new Date();
    return { date: todayISO(), minutes: at ?? d.getHours() * 60 + d.getMinutes() };
  };
  const [now, setNow] = useState(read);
  useEffect(() => {
    setNow(read());
    const iv = setInterval(() => setNow(read()), 60_000);
    return () => clearInterval(iv);
  }, [at]); // eslint-disable-line react-hooks/exhaustive-deps
  return now;
};

export interface PromptContext {
  snap: AppSnapshot;
  date: string;
  now: LocalNow;
  settings?: MorningSettings | null;
  override?: Partial<MorningDayOverride> | null;
}

/**
 * The composer's placeholder, built from the day (docs/experience.md §5.5, §6): numbers first, then one plain question.
 * "Speed 5 done, 5.02 mi. How did it feel?" · "Rest day. What did you do with it?"
 * Every word comes from the one status source (`dayPhase` → `sessionKey`), so it never contradicts the hero.
 */
export const dayPrompt = ({ snap, date, now, settings, override }: PromptContext): string => {
  const ph = dayPhase(now, { date, snapshot: snap, settings, override });
  const runs = snap.runsOn(date);
  const ran = runs.reduce((a, r) => a + (r.miles || 0), 0);
  const p = ph.primary;
  if (p && p.session.kind !== 'rest') {
    const name = label(p.session);
    const dist = p.session.kind === 'run' && ran > 0 ? `, ${miles(ran)}` : '';
    switch (p.key) {
      case 'done':
        return `${name} done${dist}. How did it feel?`;
      case 'floor':
        return `${name} at the floor${dist}. Still a day kept. How was it?`;
      case 'skipped':
        return `${name} skipped. How are you feeling?`;
      case 'missed':
        return `${name} didn’t happen. What got in the way?`;
      case 'planned':
        return `${name} planned. What do you want from it?`;
      case 'today':
        if (ph.phase === 'morning') return `${name} today. What do you want from it?`;
        if (ph.phase === 'out') return `Out on ${name}. Two sentences when you’re back.`;
        if (ph.phase === 'evening') return `${name} still open. Two sentences, then sleep.`;
        return `${name} still to come. What’s on your mind?`;
      default:
        break;
    }
  }
  // nothing planned (or only rest): a run that happened anyway, any other activity, or a rest day
  if (runs.length) return `${runs[0]!.name}, ${miles(ran)}. How did it feel?`;
  const other = snap.activitiesOn(date)[0];
  if (other) return `${other.name} done. How did it feel?`;
  return 'Rest day. What did you do with it?';
};

/** The day's prompt as a hook, for any composer (Journal, Today's "Close the day"). Pass the date the composer writes to. */
export const useDayPrompt = (date: string) => {
  const log = useLog([monthOf(date)]);
  const now = useNow();
  const settings = log.boot?.morningSettings ?? null;
  const override = log.snap.morningOverride(date);
  return useMemo(() => dayPrompt({ snap: log.snap, date, now, settings, override }), [log.snap, date, now, settings, override]);
};

/**
 * The stamp a journal day wears when it had a run: the kept run session's name ("Easy 6"), else the recorded run's
 * name ("Afternoon Run"). Null on a day without one.
 */
export const runStamp = (snap: AppSnapshot, date: string): string | null => {
  const kept = snap.sessionsOn(date).find((s: Session) => s.kind === 'run' && ['done', 'floor'].includes(sessionKey(snap, date, s)));
  if (kept) return label(kept);
  const run = snap.runsOn(date)[0];
  return run ? run.name : null;
};
