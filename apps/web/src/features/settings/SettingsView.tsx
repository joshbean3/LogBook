import { buildMorning, fmtDate, morningDayFor } from '@logbook/shared';
import { useQueryClient } from '@tanstack/react-query';
import type * as React from 'react';
import { useEffect, useRef } from 'react';
import { useNav } from '@/app/NavController';
import { keys, useBootstrap } from '@/api/queries';
import { DAY_NAME, DAY_SHORT, goalLine, hm, isTemplateBlock, paceText, sortDays } from '@/features/onboarding/model';
import { useOpenRoutineEditor } from '@/features/morning/RoutineEditor';
import { haptics } from '@/lib/haptics';
import { isNative } from '@/lib/native';
import { PushedBar, useSheet, useToast } from '@/ui';
import { AboutYouSheet } from './account';
import { GoRow, SGroup } from './parts';
import { HapticsRow } from './SectionPages';
import { useTrainingProfile } from './useProfile';
import './settings.css';

/** A provider's hand-off comes back to `/settings?strava=…` or `?coros=…` (the API's landing): read once per page load. */
let stravaReturnRead = false;
const useStravaReturn = () => {
  const qc = useQueryClient();
  const toast = useToast();
  const nav = useNav();
  useEffect(() => {
    if (stravaReturnRead) return;
    stravaReturnRead = true;
    const q = new URLSearchParams(window.location.search);
    const provider = (['strava', 'coros'] as const).find((p) => q.get(p));
    const s = provider ? q.get(provider) : null;
    // read once: the parameter leaves the address (the top entry, in place), so a reload does not answer twice (review code F10)
    if (s) nav.replace('/settings');
    if (s === 'connected') {
      // the Connections row answers ("Connected"); the runs follow a sync later
      void qc.invalidateQueries({ queryKey: keys.bootstrap });
      void qc.invalidateQueries({ queryKey: ['connections'] });
      setTimeout(() => void qc.invalidateQueries({ queryKey: ['month'] }), 6000);
    } else if (s === 'error') {
      haptics.error();
      toast(`Didn’t connect to ${provider === 'coros' ? 'COROS' : 'Strava'}. Try again.`);
    }
  }, [qc, toast, nav]);
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
  const sheet = useSheet();
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
  const coros = data?.connections?.find((c) => c.provider === 'coros');
  const habits = (data?.habits ?? []).filter((h) => !h.archivedOn).sort((a, b) => a.position - b.position);
  const ms = data?.morningSettings;
  const morning = ms ? buildMorning(morningDayFor([], null, ms), ms) : null;
  // a block written elsewhere (by hand, by the coach) names itself; one from answers is described by them
  const named = !!block && !isTemplateBlock(block) && !hasStored;
  const dash = '–';
  const days = loaded ? (profile.runDays.length > 5 ? `${profile.runDays.length} a week` : sortDays(profile.runDays).map((d) => DAY_SHORT[d]).join(' ')) : dash;

  return (
    <div ref={pageRef} className="page s-set s-root">
      <PushedBar title="Settings" />

      <SGroup title="You">
        {/* the email is the Account row's title; with no name, this row asks for one instead of showing the email twice
            (review 3 feel R3-7) */}
        <GoRow title={user?.name || 'Add your name'} sub={loaded ? (named ? `${block!.name}, through ${fmtDate('md', block!.end)}` : goalLine(profile)) : ' '} onPress={go('you')} label={`You: ${user?.name || 'add your name'}`} />
        {/* what the assistant reads before it answers (docs/system.md §7); replaces the server's ATHLETE_CONTEXT */}
        <GoRow title="About you, for the assistant" sub={user?.profileNote ? user.profileNote : 'A sentence or two it reads before writing anything.'} onPress={() => sheet.open({ eyebrow: 'You', title: 'About you', body: <AboutYouSheet />, sticky: true })} className="s-wrap" />
      </SGroup>

      <SGroup title="Training">
        {source === 'none' && loaded ? (
          <GoRow title="Build a plan" sub="Pick your days and miles. Logbook writes the weeks." onPress={go('training')} />
        ) : (
          <>
            <GoRow title={source === 'block' ? 'This week' : 'Starting miles'} value={loaded ? `${profile.weeklyMiles} mi` : dash} onPress={go('training')} />
            <GoRow title="Run days" value={days} onPress={go('training')} />
            <GoRow title="Long run" value={loaded ? DAY_NAME[profile.longRunDay] : dash} onPress={go('training')} />
          </>
        )}
        <GoRow title="Easy pace" value={ms ? `${paceText(ms.run.pace)} /mi` : dash} onPress={go('training')} />
        <GoRow title="Plans" value={block?.name ?? (loaded ? 'None' : dash)} onPress={() => nav.go('/plan')} className="s-plans-row" label={`Plans${block ? `: ${block.name}` : ''}`} />
      </SGroup>

      <SGroup title="Habits">
        <GoRow
          title={habits.length ? habits.slice(0, 3).map((h) => h.name).join(', ') + (habits.length > 3 ? ` and ${habits.length - 3} more` : '') : 'Add your first habit'}
          sub={habits.length ? 'Rename, reorder, archive' : 'Small lights you tap on Today'}
          value={habits.length || undefined}
          onPress={go('habits')}
        />
      </SGroup>

      <SGroup title="Morning routine">
        <GoRow title="Timings" sub={ms && morning ? `Up at ${hm(ms.wake)}, out for work at ${hm(morning.leave)}.` : 'Wake, run, shower, out the door'} onPress={() => openRoutine()} className="s-routine-row" label="Morning routine timings" />
      </SGroup>

      {data?.features.strava || data?.features.coros ? (
        <SGroup title="Connections">
          <GoRow
            title="Strava"
            sub={strava?.connected && strava.error ? 'Stopped syncing. Reconnect to pick up new runs.' : strava?.connected ? (strava.athleteName ? `Connected as ${strava.athleteName}` : 'Connected') : 'See your runs land on Today.'}
            value={strava?.connected && strava.error ? 'Reconnect' : strava?.connected ? undefined : 'Connect'}
            tone={strava?.connected && strava.error ? 'bad' : undefined}
            onPress={go('connections')}
          />
          {data?.features.coros ? <GoRow title="COROS" sub={coros?.connected ? (coros.error ? 'Stopped syncing.' : 'Connected') : 'Runs from your watch.'} value={coros?.connected ? undefined : 'Connect'} tone={coros?.connected && coros.error ? 'bad' : undefined} onPress={go('connections')} /> : null}
        </SGroup>
      ) : null}

      <SGroup title="Notifications">
        <GoRow title="Reminders" sub={data?.pushEnabled ? 'On for this account.' : 'Your goal, tomorrow’s run, and your own.'} value={data?.pushEnabled ? 'On' : undefined} onPress={go('notifications')} />
      </SGroup>

      <SGroup title="App">
        {/* one tap, not a page with one switch on it (review feel F13); the App page keeps it with the Home screen rows */}
        <HapticsRow />
        {isNative ? null : <GoRow title="Home screen" sub="Full screen, and it opens offline." onPress={go('app')} />}
      </SGroup>

      <SGroup title="Data">
        <GoRow title="Import and export" sub="Your log, as one JSON file." onPress={go('data')} />
      </SGroup>

      <SGroup title="Account">
        {/* not "Account" twice (the group's title and the row's, review feel F13); the email is the title, so it has the
            row's width and is whole at 320 (review 2 feel N9) */}
        <GoRow title={user?.email ?? ' '} sub="Signed in" onPress={go('account')} className="s-acct-row" label={`Account: signed in as ${user?.email ?? ''}`} />
      </SGroup>

      <p className="s-colophon">
        <span className="caps">Logbook</span>
      </p>
    </div>
  );
}
