import { buildMorning, fmtDate, morningDayFor } from '@logbook/shared';
import type * as React from 'react';
import { BookOpenText, CalendarDays, ClipboardList, Compass, Database, FileText, Gauge, Heart, House, Link2, LifeBuoy, Mail, RotateCcw, Route, ScrollText, Send, ShieldCheck, Sunrise, Timer, User, Vibrate } from 'lucide-react';
import { FavoriteIcon, FitnessIcon, HabitIcon, LearnedIcon } from '@/ui/icons';
import { useNavigate } from 'react-router';
import { startReplay } from '@/features/onboarding/replay';
import { TOUR_PATH, tourFrom } from '@/features/onboarding/tour/route';
import { TIPS_AGAIN, tipsStore } from '@/features/tips/tips';
import { useRef } from 'react';
import { useNav } from '@/app/NavController';
import { useBootstrap, useReads } from '@/api/queries';
import { DAY_NAME, DAY_SHORT, goalLine, hm, isTemplateBlock, paceText, sortDays } from '@/features/onboarding/model';
import { useOpenRoutineEditor } from '@/features/morning/RoutineEditor';
import { useConsent } from '@/lib/consent';
import { disclaimer } from '@/lib/copy';
import { setFitness, usePrefs } from '@/lib/prefs';
import { HEALTH_BUILT, STRAVA_BUILT } from '@/lib/features';
import { isNative } from '@/lib/native';
import { LEGAL, openExternal, SUPPORT, SUPPORT_EMAIL } from '@/lib/siteLinks';
import { PushedBar, Row, useToast } from '@/ui';
import { Wordmark } from '@/ui/Brand';
import { GoRow, SGroup, Switch, Tile } from './parts';
import { TodayShowsRows, todayShowsFoot } from './TodayShows';
import { supportMail } from './PrivacyPage';
import { consentShort } from './privacyModel';
import { HapticsRow } from './SectionPages';
import { StravaReturn, StravaRootRows } from './StravaSource';
import { ReminderRows } from './ReminderRow';
import { RATE_URL } from './reminderModel';
import { habitLine } from './habitModel';
import { useAppVersion } from './version';
import { useTrainingProfile } from './useProfile';
import './settings.css';

/**
 * Settings (§8): pushed from Today's avatar only, at depth 1. Eight inset groups; every row pushes its section at
 * `/settings/<section>` (depth 2 over this mounted page), except `Morning routine`, which opens WP3's routine editor as a
 * sheet, and `Plans`, which pushes `/settings/plans` (WP4's PlansPage, a sibling of `/settings/training`, so the stack never
 * exceeds two layers). No row leaves the stack; no avatar on this bar.
 */
export default function SettingsView(): React.JSX.Element {
  const boot = useBootstrap();
  const nav = useNav();
  const openRoutine = useOpenRoutineEditor();
  const { profile, block, loaded, stored: hasStored, noPlan } = useTrainingProfile();
  const go = (section: string) => () => nav.push(`/settings/${section}`);
  const routerNav = useNavigate();
  const toast = useToast();
  // the push's commit draws the whole page, bar and every group, so it is whole on the slide's first frame (review feel
  // F4, review 2 feel N1) and nothing arrives once it has landed (review 3 code N2 / feel R3-2: a group held for "below
  // the fold" was on screen at 390 × 844 and popped in on the landing frame). The groups past Morning routine are four
  // short rows: their render is measured in the push's first frame (fix-3.md)
  const pageRef = useRef<HTMLDivElement>(null);

  const data = boot.data;
  const user = data?.user;
  const habits = (data?.habits ?? []).filter((h) => !h.archivedOn).sort((a, b) => a.position - b.position);
  const ms = data?.morningSettings;
  const morning = ms ? buildMorning(morningDayFor([], null, ms), ms) : null;
  // a block written elsewhere (by hand, by the assistant) names itself; one from answers is described by them
  const named = !!block && !isTemplateBlock(block) && !hasStored;
  const dash = '–';
  const days = loaded ? (profile.runDays.length > 5 ? `${profile.runDays.length} a week` : sortDays(profile.runDays).map((d) => DAY_SHORT[d]).join(' ')) : dash;
  const consent = useConsent();
  const version = useAppVersion();
  // the saved links' count, for the Data group's row (the page itself is the Reads view, pushed over Settings)
  const reads = useReads();
  const rate = RATE_URL;
  // what is switched on (lib/prefs.ts): Fitness as a whole, and Today's sections. With Fitness off this page shows the
  // switch and none of the training rows, and says nothing else about training
  const prefs = usePrefs();
  const fitness = prefs.fitness;

  return (
    <div ref={pageRef} className="page s-set s-root">
      <PushedBar title="Settings" />

      <SGroup title="You">
        {/* the email is the Account row's title; with no name, this row asks for one instead of showing the email twice
            (review 3 feel R3-7) */}
        <GoRow icon={User} title={user?.name || 'Add your name'} sub={!fitness ? user?.email : loaded ? (named ? `${block!.name}, through ${fmtDate('md', block!.end)}` : goalLine(profile)) : ' '} onPress={go('you')} label={`${user?.name || 'Add your name'}. Your profile`} />
      </SGroup>

      {/* what Today draws: a switch a section, no order to arrange. The training card is not here: it follows Fitness */}
      <SGroup title="Today shows" className="s-today-shows" foot={todayShowsFoot(fitness)}>
        <TodayShowsRows />
      </SGroup>

      {/* Fitness: one switch for the whole of it (the tab, the training card, the charts), then its settings while it is on */}
      <SGroup title="Fitness" className="s-fitness">
        <Row className="s-wrap has-tile" left={<Tile icon={FitnessIcon} />} title="Fitness" sub="Training plan, runs and lifts" right={<Switch on={fitness} label="Fitness" onChange={setFitness} />} />
        {!fitness ? null : noPlan && loaded ? (
          <GoRow icon={CalendarDays} title="Build a plan" sub="Your days and miles, then the weeks" label="Build a plan. Pick your days and miles, and Orby writes the weeks" onPress={go('training')} />
        ) : (
          <>
            <GoRow icon={Gauge} title={hasStored ? 'Starting miles' : 'This week'} value={loaded ? `${profile.weeklyMiles} mi` : dash} onPress={go('training')} />
            {/* at 320 the day names give way to a count, rather than an ellipsis that hides the last days */}
            <GoRow
              icon={CalendarDays}
              title="Run days"
              value={
                loaded && profile.runDays.length > 3 && profile.runDays.length <= 5 ? (
                  <>
                    <span className="s-wide">{days}</span>
                    <span className="s-narrow">{profile.runDays.length} a week</span>
                  </>
                ) : (
                  days
                )
              }
              label={loaded ? `Run days: ${days}` : undefined}
              onPress={go('training')}
            />
            <GoRow icon={Route} title="Long run" value={loaded ? DAY_NAME[profile.longRunDay] : dash} onPress={go('training')} />
          </>
        )}
        {fitness ? <GoRow icon={Timer} title="Easy pace" value={ms ? `${paceText(ms.run.pace)} /mi` : dash} onPress={go('training')} /> : null}
        {/* the plan's name on its own line under the title: whole at 320, not an ellipsis */}
        {fitness ? <GoRow icon={ClipboardList} title="Plans" sub={block ? block.name : undefined} value={block ? undefined : loaded ? 'None' : dash} onPress={go('plans')} className="s-plans-row" /> : null}
      </SGroup>

      <SGroup title="Habits">
        {/* the count is the title; two names and how many more on one line under it (layout standard 2.9) */}
        <GoRow
          icon={HabitIcon}
          title={habits.length ? `${habits.length} ${habits.length === 1 ? 'habit' : 'habits'}` : 'Add your first habit'}
          sub={habits.length ? habitLine(habits.map((h) => h.name)) : 'Tiles you tap on Today'}
          onPress={go('habits')}
          className="s-habits-row"
        />
      </SGroup>

      <SGroup title="Morning routine">
        <GoRow icon={Sunrise} title="Timings" sub={ms && morning ? `Up at ${hm(ms.wake)}, leave at ${hm(morning.leave)}` : fitness ? 'Wake, run, shower, out the door' : 'Wake, shower, out the door'} onPress={() => openRoutine()} className="s-routine-row" label="Timings. Morning routine" />
      </SGroup>

      {STRAVA_BUILT && fitness ? <StravaReturn /> : null}
      {HEALTH_BUILT || (STRAVA_BUILT && fitness && data?.features.strava) ? (
        <SGroup title="Data sources">
          {STRAVA_BUILT && fitness ? <StravaRootRows onPress={go('connections')} /> : null}
          {HEALTH_BUILT ? <GoRow icon={Heart} title="Apple Health" sub="Sleep, HRV, resting heart rate" label="Apple Health. Sleep, heart rate variability and resting heart rate" onPress={go('connections')} /> : null}
        </SGroup>
      ) : null}

      <SGroup title="Privacy">
        <GoRow icon={ShieldCheck} title="Assistant access" sub="What the assistant may read" value={consentShort(consent.data)} onPress={go('privacy')} />
      </SGroup>

      <SGroup title="App">
        {/* one tap, not a page with one switch on it (review feel F13); the App page keeps it with the Home screen rows */}
        <HapticsRow icon={Vibrate} />
        <ReminderRows />
        {/* only once the App Store id exists; in the iPhone app the link goes to the App Store, never the review prompt */}
        {rate ? <GoRow icon={FavoriteIcon} title="Rate Orby" sub="Write a review on the App Store" href={isNative ? rate : undefined} onPress={() => void openExternal(rate)} /> : null}
        {isNative ? null : <GoRow icon={House} title="Home screen" sub="Full screen, and it opens offline" onPress={go('app')} />}
        {/* the tour by itself (features/onboarding/tour): it comes back here when it ends */}
        <GoRow icon={Compass} title="How Orby works" sub="A short tour" onPress={() => void routerNav(TOUR_PATH, { state: tourFrom() })} />
        {/* the first-visit tips (features/tips), once more: an action, not a page, so the row has no chevron */}
        <Row
          className="s-go has-tile"
          left={<Tile icon={LearnedIcon} />}
          title={TIPS_AGAIN.title}
          sub={TIPS_AGAIN.sub}
          onClick={() => {
            tipsStore.reset();
            toast(TIPS_AGAIN.done);
          }}
        />
        <GoRow
          icon={RotateCcw}
          title="Replay setup"
          sub="A preview. Nothing changes."
          onPress={() => {
            if (!user) return;
            startReplay(user.id);
            routerNav('/welcome/fitness');
          }}
        />
      </SGroup>

      <SGroup title="Data">
        <GoRow icon={Database} title="Import and export" sub="Your log, as one JSON file" onPress={go('data')} />
        {/* Reads lost its way in with the Library (plan U8, S9): one row on an existing list page, the count as its value */}
        <GoRow icon={Link2} title="Saved links" value={reads.data ? (reads.data.length ? String(reads.data.length) : 'None') : undefined} onPress={() => nav.push('/settings/reads')} />
      </SGroup>

      {/* how to reach the developer and the legal pages; which build this is sits at the very end (the owner reads it to tell
          a stale build) */}
      <SGroup title="About" foot={disclaimer(fitness)}>
        <GoRow icon={LifeBuoy} title="Help and contact" sub="Answers, and how to reach us" onPress={() => void openExternal(SUPPORT)} />
        <GoRow icon={Send} title="Email us" sub={SUPPORT_EMAIL} href={supportMail('Orby help')} label={`Email us at ${SUPPORT_EMAIL}`} />
        <GoRow icon={ScrollText} title="Terms of use" onPress={() => void openExternal(LEGAL.terms)} />
        <GoRow icon={FileText} title="Privacy policy" onPress={() => void openExternal(LEGAL.privacy)} />
        <GoRow icon={BookOpenText} title="Acknowledgments" onPress={() => void openExternal(LEGAL.acknowledgements)} />
      </SGroup>

      <SGroup title="Account">
        {/* not "Account" twice (the group's title and the row's, review feel F13); the email is the title, so it has the
            row's width and is whole at 320 (review 2 feel N9). Sign out and Delete account live on that page, once (S3) */}
        <GoRow icon={Mail} title={user?.email ?? ' '} sub="Signed in" onPress={go('account')} className="s-acct-row" label={`${user?.email ?? 'Account'}. Account, signed in`} />
      </SGroup>

      {/* the colophon: the wordmark, and under it which build this is, a centered footnote (layout standard 2.9) */}
      <p className="s-colophon">
        <span className="s-wordmark">
          <Wordmark width={64} />
        </span>
        <span className="s-version">Version {version}</span>
      </p>
    </div>
  );
}

