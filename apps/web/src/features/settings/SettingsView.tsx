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
import { PushedBar, useToast } from '@/ui';
import { useBodyFade, useBodyReady } from '@/features/journal/feel';
import { zoneLine } from './HrZones';
import { GoRow, SGroup } from './parts';
import { HapticsRow } from './SectionPages';
import { useTrainingProfile } from './useProfile';
import './settings.css';

/** Strava's hand-off comes back to `/settings?strava=…` (the API's landing): read once per page load. */
let stravaReturnRead = false;
const useStravaReturn = () => {
  const qc = useQueryClient();
  const toast = useToast();
  const nav = useNav();
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
      haptics.error();
      toast('Didn’t connect to Strava. Try again.');
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
  const openRoutine = useOpenRoutineEditor();
  const { profile, block, loaded, stored: hasStored, source } = useTrainingProfile();
  useStravaReturn();
  const go = (section: string) => () => nav.push(`/settings/${section}`);
  // the push draws the bar; the eight groups follow as a deferred render that never holds the slide (review feel F4)
  const ready = useBodyReady();
  const pageRef = useRef<HTMLDivElement>(null);
  useBodyFade(pageRef, ready);
  if (!ready)
    return (
      <div className="page s-set s-root">
        <PushedBar title="Settings" />
      </div>
    );

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

  return (
    <div ref={pageRef} className="page s-set s-root">
      <PushedBar title="Settings" />

      <SGroup title="You">
        <GoRow title={user?.name || user?.email || ' '} sub={loaded ? (named ? `${block!.name}, through ${fmtDate('md', block!.end)}` : goalLine(profile)) : ' '} onPress={go('you')} label={`You: ${user?.name || user?.email || ''}`} />
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
        <GoRow title="Plans" value={block?.name ?? (loaded ? 'None' : dash)} onPress={go('plans')} className="s-plans-row" label={`Plans${block ? `: ${block.name}` : ''}`} />
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

      {data?.features.strava ? (
        <SGroup title="Connections">
          <GoRow
            title="Strava"
            sub={strava?.connected && strava.error ? 'Stopped syncing. Reconnect to pick up new runs.' : strava?.connected ? (strava.athleteName ? `Connected as ${strava.athleteName}` : 'Connected') : 'See your runs land on Today.'}
            value={strava?.connected && strava.error ? 'Reconnect' : strava?.connected ? undefined : 'Connect'}
            tone={strava?.connected && strava.error ? 'bad' : undefined}
            onPress={go('connections')}
          />
          {zones ? <GoRow title="Heart-rate zones" sub={zones} onPress={go('connections')} /> : null}
        </SGroup>
      ) : null}

      <SGroup title="App">
        {/* one tap, not a page with one switch on it (review feel F13); the App page keeps it with the Home screen rows */}
        <HapticsRow />
        {isNative ? null : <GoRow title="Home screen" sub="Full screen, and it opens offline." onPress={go('app')} />}
      </SGroup>

      <SGroup title="Data">
        <GoRow title="Import and export" sub="Your log, as one JSON file." onPress={go('data')} />
      </SGroup>

      <SGroup title="Account">
        {/* not "Account" twice (the group's title and the row's, review feel F13): who is signed in, on the right */}
        <GoRow title="Signed in as" value={user?.email} onPress={go('account')} className="s-acct-row" label={`Account: signed in as ${user?.email ?? ''}`} />
      </SGroup>

      <p className="s-colophon">
        <span className="caps">Logbook</span>
      </p>
    </div>
  );
}
