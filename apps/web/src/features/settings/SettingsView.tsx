import { buildMorning, fmtDate, morningDayFor } from '@logbook/shared';
import { useQueryClient } from '@tanstack/react-query';
import type * as React from 'react';
import { Activity, CalendarDays, ClipboardList, Database, Gauge, HeartPulse, House, Mail, Route, ShieldCheck, Sparkles, Sunrise, Timer, User, Vibrate } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useNav } from '@/app/NavController';
import { keys, useBootstrap } from '@/api/queries';
import { DAY_NAME, DAY_SHORT, goalLine, hm, isTemplateBlock, paceText, sortDays } from '@/features/onboarding/model';
import { useOpenRoutineEditor } from '@/features/morning/RoutineEditor';
import { haptics } from '@/lib/haptics';
import { isNative } from '@/lib/native';
import { LogoMark, PushedBar } from '@/ui';
import { zoneLine } from './HrZones';
import { ago } from './format';
import { ActionPill, GoRow, SGroup } from './parts';
import { stravaGuide, useConnectionSheet } from './DataSources';
import { HapticsRow, useSignOut } from './SectionPages';
import { useConsent } from '@/features/auth/consent';
import { useAppVersion } from './version';
import { useTrainingProfile } from './useProfile';
import './settings.css';

/** Strava's hand-off comes back to `/settings?strava=…` (the API's landing): read once per page load. */
let stravaReturnRead = false;
const useStravaReturn = () => {
  const qc = useQueryClient();
  const nav = useNav();
  const openGuide = useConnectionSheet();
  useEffect(() => {
    if (stravaReturnRead) return;
    stravaReturnRead = true;
    const s = new URLSearchParams(window.location.search).get('strava');
    // read once: the parameter leaves the address (the top entry, in place), so a reload does not answer twice (review code F10)
    if (s) nav.replace('/settings');
    if (s === 'connected') {
      // the Connections row answers ("Connected"); the runs follow a sync later
      void qc.invalidateQueries({ queryKey: keys.bootstrap });
      setTimeout(() => void qc.invalidateQueries({ queryKey: ['month'] }), 6000);
    } else if (s === 'error') {
      // what to check, then Connect again (the connection page's failure sheet), never a toast that vanishes
      haptics.error();
      openGuide(stravaGuide(false), 'failed');
    }
  }, [qc, nav]); // eslint-disable-line react-hooks/exhaustive-deps
};

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
  const { profile, block, loaded, stored: hasStored, source } = useTrainingProfile();
  useStravaReturn();
  const go = (section: string) => () => nav.push(`/settings/${section}`);
  // the push's commit draws the whole page, bar and every group, so it is whole on the slide's first frame (review feel
  // F4, review 2 feel N1) and nothing arrives once it has landed (review 3 code N2 / feel R3-2: a group held for "below
  // the fold" was on screen at 390 × 844 and popped in on the landing frame). The groups past Morning routine are four
  // short rows: their render is measured in the push's first frame (fix-3.md)
  const pageRef = useRef<HTMLDivElement>(null);

  const data = boot.data;
  const user = data?.user;
  const strava = data?.strava;
  const habits = (data?.habits ?? []).filter((h) => !h.archivedOn).sort((a, b) => a.position - b.position);
  const ms = data?.morningSettings;
  const morning = ms ? buildMorning(morningDayFor([], null, ms), ms) : null;
  // a block written elsewhere (by hand, by the coach) names itself; one from answers is described by them
  const named = !!block && !isTemplateBlock(block) && !hasStored;
  const dash = '–';
  const days = loaded ? (profile.runDays.length > 5 ? `${profile.runDays.length} a week` : sortDays(profile.runDays).map((d) => DAY_SHORT[d]).join(' ')) : dash;
  const zones = zoneLine(data?.zones);
  const consent = useConsent();
  const version = useAppVersion();
  const signOut = useSignOut();

  return (
    <div ref={pageRef} className="page s-set s-root">
      <PushedBar title="Settings" />

      <SGroup title="You">
        {/* the email is the Account row's title; with no name, this row asks for one instead of showing the email twice
            (review 3 feel R3-7) */}
        <GoRow icon={User} title={user?.name || 'Add your name'} sub={loaded ? (named ? `${block!.name}, through ${fmtDate('md', block!.end)}` : goalLine(profile)) : ' '} onPress={go('you')} label={`You: ${user?.name || 'add your name'}`} />
      </SGroup>

      <SGroup title="Training">
        {source === 'none' && loaded ? (
          <GoRow icon={CalendarDays} title="Build a plan" sub="Pick your days and miles. Logbook writes the weeks." onPress={go('training')} />
        ) : (
          <>
            <GoRow icon={Gauge} title={source === 'block' ? 'This week' : 'Starting miles'} value={loaded ? `${profile.weeklyMiles} mi` : dash} onPress={go('training')} />
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
        <GoRow icon={Timer} title="Easy pace" value={ms ? `${paceText(ms.run.pace)} /mi` : dash} onPress={go('training')} />
        <GoRow icon={ClipboardList} title="Plans" value={block?.name ?? (loaded ? 'None' : dash)} onPress={go('plans')} className="s-plans-row" label={`Plans${block ? `: ${block.name}` : ''}`} />
      </SGroup>

      <SGroup title="Habits">
        <GoRow
          icon={Sparkles}
          title={habits.length ? habits.slice(0, 3).map((h) => h.name).join(', ') + (habits.length > 3 ? ` and ${habits.length - 3} more` : '') : 'Add your first habit'}
          sub={habits.length ? 'Rename, reorder, archive' : 'Small lights you tap on Today'}
          value={habits.length || undefined}
          onPress={go('habits')}
        />
      </SGroup>

      <SGroup title="Morning routine">
        <GoRow icon={Sunrise} title="Timings" sub={ms && morning ? `Up at ${hm(ms.wake)}, out for work at ${hm(morning.leave)}.` : 'Wake, run, shower, out the door'} onPress={() => openRoutine()} className="s-routine-row" label="Morning routine timings" />
      </SGroup>

      <SGroup title="Data sources">
        <GoRow
          icon={Activity}
          title="Strava"
          sub={
            !data?.features.strava
              ? 'Not available on this Logbook yet.'
              : strava?.connected && strava.error
                ? 'Stopped syncing. Reconnect to pick up new runs.'
                : strava?.connected
                  ? [strava.athleteName ? `Connected as ${strava.athleteName}` : 'Connected', ago(strava.lastSyncAt) ? `synced ${ago(strava.lastSyncAt)}` : null].filter(Boolean).join(', ')
                  : 'See your runs land on Today.'
          }
          value={data?.features.strava ? (strava?.connected && strava.error ? 'Fix' : strava?.connected ? undefined : 'Connect') : undefined}
          tone={strava?.connected && strava.error ? 'bad' : undefined}
          onPress={go('connections')}
        />
        <GoRow icon={HeartPulse} title="Apple Health" sub="Not yet available." onPress={go('connections')} />
        {zones ? <GoRow icon={Gauge} title="Heart-rate zones" sub={zones} onPress={go('connections')} /> : null}
      </SGroup>

      <SGroup title="Privacy">
        <GoRow icon={ShieldCheck} title="Assistant access" sub="What the assistant may read, and what it never sees." value={consent.data ? (consent.data.training ? 'On' : 'Off') : undefined} onPress={go('privacy')} />
      </SGroup>

      <SGroup title="App">
        {/* one tap, not a page with one switch on it (review feel F13); the App page keeps it with the Home screen rows */}
        <HapticsRow icon={Vibrate} />
        {isNative ? null : <GoRow icon={House} title="Home screen" sub="Full screen, and it opens offline." onPress={go('app')} />}
      </SGroup>

      <SGroup title="Data">
        <GoRow icon={Database} title="Import and export" sub="Your log, as one JSON file." onPress={go('data')} />
      </SGroup>

      <SGroup title="Account">
        {/* not "Account" twice (the group's title and the row's, review feel F13); the email is the title, so it has the
            row's width and is whole at 320 (review 2 feel N9) */}
        <GoRow icon={Mail} title={user?.email ?? ' '} sub="Signed in" onPress={go('account')} className="s-acct-row" label={`Account: signed in as ${user?.email ?? ''}`} />
      </SGroup>

      <div className="s-pills">
        <ActionPill className="s-signout" disabled={signOut.isPending} onPress={() => signOut.mutate()}>
          {signOut.isPending ? 'Signing out…' : 'Sign out'}
        </ActionPill>
      </div>

      <p className="s-colophon">
        <span className="s-wordmark">
          <LogoMark size={22} color="var(--ink)" />
          <span className="display">Logbook</span>
        </span>
        <span className="s-version">{version}</span>
      </p>
    </div>
  );
}
