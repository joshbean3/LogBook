import { useMutation, useQueryClient } from '@tanstack/react-query';
import type * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import { api, ApiError } from '@/api/client';
import { keys, stravaSyncNow, useBootstrap, useStravaChecking } from '@/api/queries';
import { markSignedOut } from '@/features/auth/flag';
import { connectStrava } from '@/features/onboarding/StravaPrimer';
import { haptics, useHapticsEnabled } from '@/lib/haptics';
import { isNative } from '@/lib/native';
import { Button, PushedBar, Row, useSheet, useToast } from '@/ui';
import { DeleteStepOne, exportAll } from './account';
import { HrZonesRow } from './HrZones';
import { GoRow, SGroup, Switch } from './parts';

// ---------- install (the web app only) ----------
type BIP = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };
let deferredInstall: BIP | null = null;
if (typeof window !== 'undefined')
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstall = e as BIP;
  });
const isStandalone = () => matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
/** Safari on an iPhone or iPad: the one browser where Add to Home Screen is a manual step worth explaining. */
const isIosSafari = () => /iP(hone|ad|od)/.test(navigator.userAgent) && !/CriOS|FxiOS|EdgiOS/.test(navigator.userAgent);

const ago = (iso: string | null | undefined) => {
  if (!iso) return null;
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60e3);
  return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 48 * 60 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} days ago`;
};

/** Disconnect asks first: new runs stop landing, the ones here stay. No toast: the Strava row turns back into Connect. */
const DisconnectSheet = () => {
  const qc = useQueryClient();
  const sheet = useSheet();
  const toast = useToast();
  const disconnect = useMutation({
    mutationFn: () => api('/strava/disconnect', { method: 'POST' }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.bootstrap });
      sheet.close();
    },
    onError: () => {
      haptics.error();
      toast('Couldn’t disconnect. Try again.');
    },
  });
  return (
    <div className="s-del">
      <p className="s-del-lede">New runs stop landing on Today. The runs already here stay.</p>
      <div className="s-del-actions">
        <Button variant="danger" block onClick={() => disconnect.mutate()} disabled={disconnect.isPending}>
          {disconnect.isPending ? 'Disconnecting…' : 'Disconnect Strava'}
        </Button>
        <Button variant="quiet" block onClick={() => sheet.close()}>
          Keep it connected
        </Button>
      </div>
    </div>
  );
};

/** /settings/connections: Strava (connect, its last sync, Sync now, disconnect) and the heart-rate zones it brings. */
export const ConnectionsPage = (): React.JSX.Element => {
  const boot = useBootstrap();
  const qc = useQueryClient();
  const sheet = useSheet();
  const toast = useToast();
  const checking = useStravaChecking();
  const s = boot.data?.strava;
  const can = !!boot.data?.features.strava;
  const sync = () =>
    stravaSyncNow(qc, { force: true })
      .then(() => qc.invalidateQueries({ queryKey: keys.bootstrap }))
      .catch(() => {
        haptics.error();
        toast('Couldn’t reach Strava. Try again when you’re online.');
      });
  return (
    <div className="page s-set s-sub">
      <PushedBar title="Connections" />
      {!can ? (
        <p className="s-note s-first">This server isn’t set up to connect to Strava.</p>
      ) : (
        <>
          <SGroup title="Strava">
            {s?.connected && s.error ? (
              <GoRow title="Strava stopped syncing" sub="Reconnect to pick up new runs." value="Reconnect" tone="bad" onPress={() => void connectStrava()} />
            ) : s?.connected ? (
              <>
                <Row title={s.athleteName ? `Connected as ${s.athleteName}` : 'Connected'} sub="New runs land on Today a minute after they sync." className="s-wrap" />
                <Row
                  className="s-sync-row"
                  title="Sync now"
                  sub={checking ? 'Checking Strava…' : ago(s.lastSyncAt) ? `Last synced ${ago(s.lastSyncAt)}` : 'Not synced yet'}
                  onClick={() => (checking ? undefined : void sync())}
                />
              </>
            ) : (
              <GoRow title="Connect Strava" sub="See your runs land on Today." onPress={() => void connectStrava()} />
            )}
            <HrZonesRow zones={boot.data?.zones ?? null} connected={!!s?.connected} />
          </SGroup>
          {s?.connected ? (
            <SGroup title="Disconnect" className="s-sec-quiet">
              <Row className="s-danger" title="Disconnect Strava" onClick={() => sheet.open({ eyebrow: 'Connection', title: 'Disconnect Strava?', body: <DisconnectSheet /> })} />
            </SGroup>
          ) : null}
        </>
      )}
    </div>
  );
};

/** /settings/app: haptics, and on the web, installing to the home screen. */
export const AppPage = (): React.JSX.Element => {
  const [hapticsOn, setHapticsOn] = useHapticsEnabled();
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
  const install = async () => {
    if (!deferredInstall) return;
    await deferredInstall.prompt();
    const r = await deferredInstall.userChoice;
    if (r.outcome === 'accepted') setCanInstall(false);
    deferredInstall = null;
  };
  return (
    <div className="page s-set s-sub">
      <PushedBar title="App" />
      <SGroup title="Feel">
        <Row
          className="s-wrap"
          title="Haptics"
          sub={isNative ? 'A tap you can feel for a lift, a drop and a done.' : 'On phones that support it. iPhone browsers don’t.'}
          right={
            <Switch
              on={hapticsOn}
              label="Haptics"
              onChange={(on) => {
                setHapticsOn(on);
                // the switch answers with the feel it turns on
                if (on) haptics.toggle();
              }}
            />
          }
        />
      </SGroup>
      {!isNative ? (
        <SGroup title="Home screen">
          {isStandalone() ? (
            <Row className="s-wrap" title="Installed" sub="You’re running Logbook from the home screen." />
          ) : canInstall ? (
            <GoRow title="Install Logbook" sub="Full screen, and it opens offline." onPress={() => void install()} />
          ) : isIosSafari() ? (
            <Row className="s-wrap" title="Add to Home Screen" sub="In Safari: Share, then Add to Home Screen." />
          ) : (
            <Row className="s-wrap" title="Add to Home Screen" sub="From your browser’s menu, for full screen and offline." />
          )}
        </SGroup>
      ) : null}
    </div>
  );
};

const WORDS: Record<string, [string, string]> = { journal: ['journal entry', 'journal entries'], todos: ['to-do', 'to-dos'], links: ['saved link', 'saved links'], reads: ['saved link', 'saved links'], checks: ['habit check', 'habit checks'], quotes: ['quote', 'quotes'], quotePrefs: ['quote preference', 'quote preferences'], morningDays: ['morning', 'mornings'] };

/** /settings/data: Import and Export. Each row answers in its own second line; only a failure raises a toast. */
export const DataPage = (): React.JSX.Element => {
  const qc = useQueryClient();
  const toast = useToast();
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
      return api<{ ok?: boolean; imported?: Record<string, number> }>('/import', { method: 'POST', json });
    },
    onSuccess: (r) => {
      const parts = Object.entries(r.imported ?? {})
        .filter(([, n]) => n)
        .map(([k, n]) => {
          const w = WORDS[k];
          return w ? `${n.toLocaleString()} ${n === 1 ? w[0] : w[1]}` : `${n.toLocaleString()} ${n === 1 ? k.replace(/s$/, '') : k}`;
        });
      setImportResult({ text: parts.length ? `Imported ${parts.join(', ')}.` : 'Nothing new: it was all here already.', bad: false });
      void qc.invalidateQueries();
    },
    onError: (e) => {
      haptics.error();
      setImportResult({ text: e instanceof ApiError && e.status === 422 ? 'That file isn’t a log Logbook can read.' : 'Import didn’t finish. Try again.', bad: true });
    },
  });
  const [exporting, setExporting] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const runExport = async () => {
    if (exporting) return;
    setExporting('Gathering your log…');
    try {
      const r = await exportAll((d, t) => setExporting(t > 1 ? `Gathering ${d} of ${t} months…` : 'Gathering your log…'));
      setSaved(`Saved ${r.name}.`);
    } catch {
      haptics.error();
      toast('Export didn’t finish. Check your connection.');
    } finally {
      setExporting(null);
    }
  };
  return (
    <div className="page s-set s-sub">
      <PushedBar title="Data" />
      <SGroup title="Your log">
        <Row
          className="s-wrap s-import-row"
          title="Import"
          sub={importBundle.isPending ? 'Reading the file…' : importResult ? <span className={importResult.bad ? 's-bad' : ''}>{importResult.text}</span> : 'A Logbook export or your old log, as JSON.'}
          onClick={() => !importBundle.isPending && fileRef.current?.click()}
          label="Import a file"
        />
        <Row className="s-wrap s-export-row" title="Export" sub={exporting ?? saved ?? 'Everything you’ve logged, as one JSON file.'} onClick={() => void runExport()} label="Export my data" />
      </SGroup>
      <input ref={fileRef} type="file" accept="application/json,.json" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => e.target.files?.[0] && importBundle.mutate(e.target.files[0])} />
    </div>
  );
};

/** /settings/account: who is signed in, Sign out, Delete account (a two-step sheet). */
export const AccountPage = (): React.JSX.Element => {
  const boot = useBootstrap();
  const qc = useQueryClient();
  const sheet = useSheet();
  const toast = useToast();
  const logout = useMutation({
    mutationFn: () => api('/auth/logout', { method: 'POST' }),
    onSuccess: () => markSignedOut(qc),
    onError: () => {
      haptics.error();
      toast('Couldn’t sign out. Check your connection.');
    },
  });
  const runExport = () =>
    void exportAll(() => undefined).catch(() => {
      haptics.error();
      toast('Export didn’t finish. Check your connection.');
    });
  return (
    <div className="page s-set s-sub">
      <PushedBar title="Account" />
      <SGroup title="Signed in as">
        <Row title={boot.data?.user.email ?? ' '} className="s-email-row" />
      </SGroup>
      <SGroup title="Leave" className="s-sec-quiet">
        <Row className="s-signout" title={logout.isPending ? 'Signing out…' : 'Sign out'} onClick={() => !logout.isPending && logout.mutate()} />
        <Row
          className="s-danger"
          title="Delete account"
          onClick={() =>
            sheet.open({
              eyebrow: 'Account',
              title: 'Delete account',
              body: (
                <DeleteStepOne
                  onExport={() => {
                    sheet.close();
                    runExport();
                  }}
                />
              ),
            })
          }
        />
      </SGroup>
    </div>
  );
};
