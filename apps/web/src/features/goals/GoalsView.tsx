import { awaitingReview, currentGoals, shiftDays, type Aim, type GoalLevel } from '@logbook/shared';
import { Bell } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNav } from '@/app/NavController';
import { useBootstrap, useGoals } from '@/api/queries';
import { subscribeToday, useToday } from '@/lib/useToday';
import { dayCaption, NavBar } from '@/ui/NavBar';
import { Button } from '@/ui/primitives';
import { Skeleton, SkeletonGroup } from '@/ui/Skeleton';
import { Stack } from '@/ui/layout';
import { Switch } from '../settings/parts';
import '../settings/settings.css';
import { useNowMinutes } from '../day/useNow';
import { disableReminders, enableReminders, openAppSettings, reminderPermission, remindersOn, remindersSupported, reminderTime } from './reminders';
import { ScoreStrip } from './GoalParts';
import { celebrateOnce } from './game';
import { ReviewRow } from './ReviewRow';
import { GoalsHero } from './GoalsHero';
import { AheadRow, FurtherOut } from './FurtherOut';
import { eveningNow } from './GoalsHero.logic';
import { useCelebrate } from './Celebrate';
import { KSection } from './Kit';
import './goals.css';
import './goalsPage.css';

/** Nearest first: the day, then the week, the month, the year. */
const LEVELS: readonly GoalLevel[] = ['day', 'week', 'month', 'year'];

/**
 * The morning reminder, in its own short section: when it comes, and a switch. Turning it on asks iOS and schedules what is
 * owed at once. When iOS has said no, only the Settings app can change that, so the page says so and opens it. What iOS
 * allows is read again on open and whenever the app comes back, so the switch never shows on while notifications are off.
 */
const Reminders = ({ goals, today }: { goals: Aim[]; today: string }) => {
  const boot = useBootstrap();
  const wake = boot.data?.morningSettings?.wake ?? 7 * 60;
  const [on, setOn] = useState(remindersOn);
  // denied, and the owner wanted them (tried just now, or had them on before Settings turned them off)
  const [blocked, setBlocked] = useState(false);
  useEffect(() => {
    let live = true;
    const check = () =>
      void reminderPermission()
        .then((p) => {
          if (!live) return;
          if (p !== 'granted') {
            if (p === 'denied' && remindersOn()) setBlocked(true);
            setOn(false);
          } else setBlocked(false);
        })
        .catch(() => undefined);
    check();
    const back = () => document.visibilityState === 'visible' && check();
    document.addEventListener('visibilitychange', back);
    return () => {
      live = false;
      document.removeEventListener('visibilitychange', back);
    };
  }, []);
  return (
    <KSection title="Reminders" className="g-rem">
      <ul className="k-rows has-icons">
        <li className="k-row two">
          <span className="icon-tile" aria-hidden="true">
            <Bell size={18} />
          </span>
          <span className="k-row-main">
            <span className="k-row-title">Goal reminders</span>
            <span className="k-row-sub">{reminderTime(wake)}, only on days with no goal</span>
          </span>
          <Switch
            on={on}
            label="Goal reminders"
            onChange={async (next) => {
              if (!next) {
                await disableReminders();
                setBlocked(false);
                return setOn(false);
              }
              const ok = await enableReminders({ goals, today, wake }).catch(() => false);
              setOn(ok);
              setBlocked(!ok && (await reminderPermission().catch(() => 'prompt')) === 'denied');
            }}
          />
        </li>
      </ul>
      {blocked ? (
        <div className="k-card g-rem-off" role="status">
          <p className="k-foot">Notifications are off for Orby. Turn them on in Settings.</p>
          <Button size="sm" className="g-rem-btn" onClick={openAppSettings}>
            Open Settings
          </Button>
        </div>
      ) : null}
    </KSection>
  );
};

/**
 * Goals (the second tab). Today's goal leads as the poster (GoalsHero: the same card and state as Today's). Under it, one
 * quiet card while it has a row: the review owed ("Still open from Mon, Nov 9") and, from 5 pm, tomorrow's goal. Then
 * "Further out": the year, the month and this week as three hills (FurtherOut), whose caption opens tomorrow's goal and
 * next week's. Then the record (History, "Goals kept") and the reminders. Each goal goes through the review when it is
 * set (Locke and Latham's rules), and everything that happens to it is kept.
 */
export default function GoalsView(): React.JSX.Element {
  const today = useToday();
  const nav = useNav();
  const goals = useGoals();
  const minutes = useNowMinutes();
  // the date is polled every 30 s and the clock ticks on the minute: at midnight the clock would read 00:00 against
  // yesterday's date for up to half a minute ("Today’s goal · 24 h left" on a day that is over). Each new minute asks the
  // date store to look again (subscribing reads the clock at once), so the day turns with the minute that turns it
  const minute = Math.floor(minutes);
  useEffect(() => subscribeToday(() => undefined), [minute]);
  const now = new Date(`${today}T00:00:00`).getTime() + minutes * 60e3;
  const list = goals.data ?? [];
  const cur = currentGoals(list, today);

  // today's goal turning done while the tab is open (open → done), never one that loads done: its burst and the moment,
  // once; the week's, month's and year's moments play the same way, without a burst of their own
  const was = useRef<Record<string, string>>({});
  const [hit, setHit] = useState(0);
  const celebrate = useCelebrate();
  const sig = LEVELS.map((l) => `${cur[l]?.id}:${cur[l]?.status}`).join('|');
  useEffect(() => {
    for (const l of LEVELS) {
      const g = cur[l];
      if (!g) continue;
      const before = was.current[g.id];
      was.current[g.id] = g.status;
      if (before === 'open' && g.status === 'done') {
        celebrateOnce(`${g.id}:${g.updatedAt}`, l !== 'day');
        if (l === 'day') setHit(Date.now());
        celebrate(g);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);
  // the quiet card under the poster shows only while it has a row: a review owed, or (in the evening) tomorrow's goal
  const owed = awaitingReview(list, today).length > 0;
  const evening = eveningNow(minutes);

  return (
    <div className="page g-page">
      <NavBar caps={{ cur: dayCaption(today, today) }} title={{ cur: 'Goals' }} gap={16} />
      {goals.isError && !goals.data ? (
        <section className="k-card g-error" role="alert">
          <p className="k-row-title">Goals didn’t load.</p>
          <p className="k-foot">Check the connection, then try again.</p>
          <Button size="sm" className="g-error-btn" onClick={() => void goals.refetch()} disabled={goals.isFetching}>
            Try again
          </Button>
        </section>
      ) : goals.isPending && !goals.data ? (
        // the shape of the tab (the poster, the hills), so it lays out once
        <SkeletonGroup label="Loading goals" className="g-skel">
          <Skeleton h={332} r="card" />
          <Skeleton h={222} r="card" />
        </SkeletonGroup>
      ) : (
        <>
          <Stack className="g-top">
            <GoalsHero today={today} now={now} hit={hit} />
            {owed || evening ? (
              <div className="k-rows has-icons g-follow">
                <ReviewRow today={today} />
                {evening ? <AheadRow level="day" period={shiftDays(today, 1)} name="Tomorrow" /> : null}
              </div>
            ) : null}
            <FurtherOut today={today} now={now} />
          </Stack>
          <KSection title="History" meta="Goals kept" action="See all" actionLabel="See all of the history" onAction={() => nav.push('/goals/history')} className="g-past">
            <ScoreStrip goals={list} today={today} />
          </KSection>
          {remindersSupported() ? <Reminders goals={list} today={today} /> : null}
        </>
      )}
    </div>
  );
}
