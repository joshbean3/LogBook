import { buildMorning, fmtDate, morningDayFor, today } from '@logbook/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router';
import { api, ApiError } from '@/api/client';
import { keys, useBootstrap } from '@/api/queries';
import { connectStrava } from '@/features/onboarding/StravaPrimer';
import { DAY_NAME, DAY_SHORT, goalLine, goalLong, hm, isTemplateBlock, paceText, sortDays, weeksUntil } from '@/features/onboarding/model';
import { haptics, useHapticsEnabled } from '@/lib/haptics';
import { isNative } from '@/lib/native';
import { PushedHeader } from '@/ui/headers';
import { Button, Section } from '@/ui/primitives';
import { useSheet } from '@/ui/Sheet';
import { Skeleton } from '@/ui/Skeleton';
import { useToast } from '@/ui/Toast';
import { DeleteStepOne, exportAll } from './account';
import { HabitsPage } from './HabitsPage';
import { HrZonesRow } from './HrZones';
import { SRow, Switch } from './parts';
import { StravaLine } from './StravaLine';
import { TrainingPage, YouPage } from './TrainingPages';
import { useTrainingProfile } from './useProfile';
import './settings.css';

export { StravaLine } from './StravaLine';

type BIP = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };
let deferredInstall: BIP | null = null;
if (typeof window !== 'undefined')
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstall = e as BIP;
  });
const isStandalone = () => matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;

/**
 * Settings (experience §5.7), pushed from the avatar. The root is a tree of grouped edge-to-edge lists; You, Training and
 * Habits push their own pages at /settings/:section.
 */
export default function SettingsView() {
  const { section } = useParams();
  if (section === 'you') return <YouPage />;
  if (section === 'training') return <TrainingPage />;
  if (section === 'habits') return <HabitsPage />;
  if (section) return <Navigate to="/settings" replace />;
  return <SettingsRoot />;
}

/** The Strava sheet: who is connected, when it last synced, Sync now and Disconnect. */
const StravaSheet = () => {
  const boot = useBootstrap();
  const qc = useQueryClient();
  const sheet = useSheet();
  const toast = useToast();
  const s = boot.data?.strava;
  const disconnect = useMutation({
    mutationFn: () => api('/strava/disconnect', { method: 'POST' }),
    onSuccess: () => {
      haptics.delete();
      void qc.invalidateQueries({ queryKey: keys.bootstrap });
      sheet.close();
      toast('Strava disconnected. Your runs stay.');
    },
    onError: () => toast('Couldn’t disconnect. Try again.'),
  });
  return (
    <div className="s-strava">
      <p className="s-note">{s?.athleteName ? `Connected as ${s.athleteName}.` : 'Connected.'} New runs land on Today a minute after they sync, and they stay if you disconnect.</p>
      <StravaLine strava={s ?? null} />
      <div className="s-del-actions">
        <Button variant="quiet" block onClick={() => disconnect.mutate()} disabled={disconnect.isPending}>
          {disconnect.isPending ? 'Disconnecting…' : 'Disconnect Strava'}
        </Button>
      </div>
    </div>
  );
};

function SettingsRoot() {
  const boot = useBootstrap();
  const qc = useQueryClient();
  const nav = useNavigate();
  const toast = useToast();
  const sheet = useSheet();
  const [sp, setSp] = useSearchParams();
  const [hapticsOn, setHapticsOn] = useHapticsEnabled();
  const { profile, block, loaded, stored: hasStored } = useTrainingProfile();
  const [canInstall, setCanInstall] = useState(!!deferredInstall);
  useEffect(() => {
    const fn = (e: Event) => {
      e.preventDefault();
      deferredInstall = e as BIP;
      setCanInstall(true);
    };
    window.addEventListener('beforeinstallprompt', fn);
    return () => window.removeEventListener('beforeinstallprompt', fn);
  }, []);
  // back from the Strava hand-off
  useEffect(() => {
    const s = sp.get('strava');
    if (s === 'connected') {
      haptics.success();
      toast('Connected. Pulling your runs…');
      void qc.invalidateQueries({ queryKey: keys.bootstrap });
      setTimeout(() => void qc.invalidateQueries({ queryKey: ['month'] }), 6000);
      setSp({}, { replace: true });
    } else if (s === 'error') {
      haptics.error();
      toast('Didn’t connect. Try again.');
      setSp({}, { replace: true });
    }
  }, [sp, setSp, toast, qc]);

  // ---------- data ----------
  const fileRef = useRef<HTMLInputElement>(null);
  const [importResult, setImportResult] = useState<{ text: string; bad: boolean } | null>(null);
  const importBundle = useMutation({
    mutationFn: async (file: File) => {
      const text = await file.text();
      let json: unknown;
      try {
        json = JSON.parse(text);
      } catch {
        throw new ApiError('That file isn’t a Logbook export or an old log.', 422);
      }
      return api<{ ok: boolean; imported: Record<string, number> }>('/import', { method: 'POST', json });
    },
    onSuccess: (r) => {
      const parts = Object.entries(r.imported)
        .filter(([, n]) => n)
        .map(([k, n]) => `${n} ${k}`);
      haptics.success();
      setImportResult({ text: parts.length ? `Imported ${parts.join(', ')}.` : 'Nothing new: it was all here already.', bad: false });
      void qc.invalidateQueries();
    },
    onError: (e) => {
      haptics.error();
      setImportResult({ text: e instanceof ApiError && e.status === 422 ? 'That file isn’t a log Logbook can read.' : 'Import didn’t finish. Try again.', bad: true });
    },
  });
  const [exporting, setExporting] = useState<string | null>(null);
  const runExport = async () => {
    if (exporting) return;
    setExporting('Gathering your log…');
    try {
      const r = await exportAll((d, t) => setExporting(`Gathering ${d} of ${t} months…`));
      haptics.success();
      toast(`Saved ${r.name}`);
    } catch {
      haptics.error();
      toast('Export didn’t finish. Check your connection.');
    } finally {
      setExporting(null);
    }
  };

  const logout = useMutation({
    mutationFn: () => api('/auth/logout', { method: 'POST' }),
    onSuccess: () => {
      qc.clear();
      nav('/login', { replace: true });
    },
  });

  const data = boot.data;
  const strava = data?.strava;
  const habits = (data?.habits ?? []).filter((h) => !h.archivedOn).sort((a, b) => a.position - b.position);
  const ms = data?.morningSettings;
  const morning = ms ? buildMorning(morningDayFor([], null, ms), ms) : null;
  const t = today();
  // a block written elsewhere (by hand, by the coach) names itself; one from answers is described by them
  const named = !!block && !isTemplateBlock(block) && !hasStored;
  const race = profile.goal !== 'base' && profile.raceDate && profile.raceDate >= t ? profile.raceDate : null;

  return (
    <div className="page s-set">
      <PushedHeader title="Settings" />

      {/* the one hero: who you are and what you are training for; tap for You */}
      <button type="button" className="s-me halo halo-upcoming" onClick={() => nav('/settings/you')} aria-label={`You: ${data?.user.email ?? ''}. ${goalLine(profile)}. Open`}>
        <span className="caps s-me-eyebrow">{data?.user.email ?? ' '}</span>
        {loaded ? (
          <>
            <span className="s-me-goal display">{named ? block!.name : profile.goal === 'base' ? 'Just running.' : `Training for a ${goalLong(profile.goal).replace(/^H/, 'h').replace(/^M/, 'm')}.`}</span>
            <span className="s-me-sub">
              {race ? `${fmtDate('long', race)} · ${weeksUntil(t, race)} weeks to go` : named ? `Through ${fmtDate('long', block!.end)}` : block ? `${block.name}, through ${fmtDate('md', block.end)}` : 'No plan yet. Build one in Training.'}
            </span>
          </>
        ) : (
          <>
            <Skeleton w="60%" h={34} r="line" />
            <Skeleton w="45%" h={18} r="line" />
          </>
        )}
      </button>

      <Section title="Training" level="primary">
        <div className="list-edge s-list">
          <SRow to="/settings/training" title="Weekly miles" value={loaded ? `${profile.weeklyMiles} mi` : '–'} />
          <SRow to="/settings/training" title="Run days" value={loaded ? (profile.runDays.length > 4 ? `${profile.runDays.length} days a week` : sortDays(profile.runDays).map((d) => DAY_SHORT[d]).join(' · ')) : '–'} />
          <SRow to="/settings/training" title="Long run" value={loaded ? DAY_NAME[profile.longRunDay] : '–'} />
          <SRow to="/settings/training" title="Easy pace" value={ms ? `${paceText(ms.run.pace)} /mi` : '–'} />
        </div>
      </Section>

      <Section title="Morning routine" level="secondary">
        <div className="list-edge s-list">
          <SRow to="/morning?routine=1" title="Wake, run, shower, out the door" sub={ms && morning ? `Up at ${hm(ms.wake)}, out for work at ${hm(morning.leave)}.` : undefined} />
        </div>
      </Section>

      <Section title="Habits" meta={habits.length || undefined} level="secondary">
        <div className="list-edge s-list">
          <SRow
            to="/settings/habits"
            title={habits.length ? habits.slice(0, 3).map((h) => h.name).join(', ') + (habits.length > 3 ? ` and ${habits.length - 3} more` : '') : 'Add your first habit'}
            sub={habits.length ? 'Rename, reorder, archive' : 'Small lights you tap on Today'}
          />
        </div>
      </Section>

      {data?.features.strava ? (
        <Section title="Connections" level="secondary">
          <div className="list-edge s-list">
            {strava?.connected && strava.error ? (
              <SRow className="s-broken" tone="bad" title="Strava stopped syncing" sub="Reconnect to pick up new runs." onPress={() => void connectStrava()} value="Reconnect" />
            ) : strava?.connected ? (
              <SRow title="Strava" sub={strava.athleteName ? `Connected as ${strava.athleteName}` : 'Connected'} onPress={() => sheet.open({ eyebrow: 'Connection', title: 'Strava', body: <StravaSheet /> })} />
            ) : (
              <SRow title="Strava" sub="See your runs land on Today." value="Connect" onPress={() => void connectStrava()} />
            )}
            <HrZonesRow zones={data.zones} connected={!!strava?.connected} />
          </div>
        </Section>
      ) : null}

      <Section title="App" level="secondary">
        <div className="list-edge s-list">
          <SRow
            title="Haptics"
            sub={isNative ? 'A tap you can feel for every tick, lift and done.' : 'On phones that support it. iPhone browsers don’t.'}
            right={
              <Switch
                on={hapticsOn}
                label="Haptics"
                onChange={(on) => {
                  setHapticsOn(on);
                  if (on) haptics.toggle();
                }}
              />
            }
          />
          {!isNative ? (
            isStandalone() ? (
              <SRow title="Installed" sub="You’re running Logbook from the home screen." />
            ) : canInstall ? (
              <SRow
                title="Install Logbook"
                sub="Full screen, and it opens offline."
                value="Install"
                onPress={async () => {
                  if (!deferredInstall) return;
                  await deferredInstall.prompt();
                  const r = await deferredInstall.userChoice;
                  if (r.outcome === 'accepted') setCanInstall(false);
                  deferredInstall = null;
                }}
              />
            ) : (
              <SRow title="Add to Home Screen" sub="In Safari: Share, then Add to Home Screen." />
            )
          ) : null}
        </div>
      </Section>

      <Section title="Data" level="secondary">
        <div className="list-edge s-list">
          <SRow
            title="Import"
            sub={importBundle.isPending ? 'Reading the file…' : importResult ? <span className={importResult.bad ? 's-bad' : ''}>{importResult.text}</span> : 'A Logbook export or your old log, as JSON.'}
            onPress={() => !importBundle.isPending && fileRef.current?.click()}
            label="Import a file"
          />
          <SRow title="Export" sub={exporting ?? 'Everything you’ve logged, as one JSON file.'} onPress={() => void runExport()} label="Export my data" />
        </div>
      </Section>

      <Section title="Account" level="primary">
        <div className="list-edge s-list">
          <SRow title="Sign out" chevron={false} onPress={() => !logout.isPending && logout.mutate()} />
          <SRow
            title="Delete account"
            tone="bad"
            chevron={false}
            onPress={() =>
              sheet.open({
                eyebrow: 'Account',
                title: 'Delete account',
                body: (
                  <DeleteStepOne
                    onExport={() => {
                      sheet.close();
                      void runExport();
                    }}
                  />
                ),
              })
            }
          />
        </div>
      </Section>
      <input ref={fileRef} type="file" accept="application/json,.json" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => e.target.files?.[0] && importBundle.mutate(e.target.files[0])} />
      <p className="s-colophon">
        <span className="caps">Logbook</span>
      </p>
    </div>
  );
}
