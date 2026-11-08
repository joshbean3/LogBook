import { useMutation, useQueryClient } from '@tanstack/react-query';
import type * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import { api, ApiError } from '@/api/client';
import { useBootstrap } from '@/api/queries';
import { markSignedOut } from '@/features/auth/flag';
import { haptics, useHapticsEnabled } from '@/lib/haptics';
import { isNative } from '@/lib/native';
import { PushedBar, Row, useSheet, useToast } from '@/ui';
import { DeleteStepOne, exportAll } from './account';
import { popFav } from '@/features/journal/feel';
import { Download, House, Mail, Upload, Vibrate, type LucideIcon } from 'lucide-react';
import { ActionPill, GoRow, SGroup, Switch, Tile } from './parts';

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

/**
 * The Haptics switch (the Settings root's App group and the App page). Turning it on answers with the feel it turns on, as
 * `toggle` on the apex of the `complete` curve (`hapticAtPeak`, contracts §D.3: never fired straight from the tap; review
 * code F13); turning it off is silent.
 */
export const HapticsRow = ({ icon }: { icon?: LucideIcon } = {}): React.JSX.Element => {
  const [hapticsOn, setHapticsOn] = useHapticsEnabled();
  return (
    <Row
      className={`s-wrap ${icon ? 'has-tile' : ''}`}
      left={icon ? <Tile icon={icon} /> : undefined}
      title="Haptics"
      sub={isNative ? 'A tap you can feel for a lift, a drop and a done.' : 'On phones that support it. iPhone browsers don’t.'}
      right={
        <Switch
          on={hapticsOn}
          label="Haptics"
          onChange={(on) => {
            setHapticsOn(on);
            if (on) popFav();
          }}
        />
      }
    />
  );
};

/** /settings/app: haptics, and on the web, installing to the home screen. */
export const AppPage = (): React.JSX.Element => {
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
        <HapticsRow icon={Vibrate} />
      </SGroup>
      {!isNative ? (
        <SGroup title="Home screen">
          {isStandalone() ? (
            <Row className="s-wrap has-tile" left={<Tile icon={House} />} title="Installed" sub="You’re running Logbook from the home screen." />
          ) : canInstall ? (
            <GoRow icon={House} title="Install Logbook" sub="Full screen, and it opens offline." onPress={() => void install()} />
          ) : isIosSafari() ? (
            <Row className="s-wrap has-tile" left={<Tile icon={House} />} title="Add to Home Screen" sub="In Safari: Share, then Add to Home Screen." />
          ) : (
            <Row className="s-wrap has-tile" left={<Tile icon={House} />} title="Add to Home Screen" sub="From your browser’s menu, for full screen and offline." />
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
          className="s-wrap s-import-row has-tile"
          left={<Tile icon={Upload} />}
          title="Import"
          sub={importBundle.isPending ? 'Reading the file…' : importResult ? <span className={importResult.bad ? 's-bad' : ''}>{importResult.text}</span> : 'A Logbook export or your old log, as JSON.'}
          onClick={() => !importBundle.isPending && fileRef.current?.click()}
          label="Import a file"
        />
        <Row className="s-wrap s-export-row has-tile" left={<Tile icon={Download} />} title="Export" sub={exporting ?? saved ?? 'Everything you’ve logged, as one JSON file.'} onClick={() => void runExport()} label="Export my data" />
      </SGroup>
      <input ref={fileRef} type="file" accept="application/json,.json" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => e.target.files?.[0] && importBundle.mutate(e.target.files[0])} />
    </div>
  );
};

/** Sign out: the Settings root's action pill and the Account page's. A failure says so in a toast. */
export const useSignOut = () => {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: () => api('/auth/logout', { method: 'POST' }),
    onSuccess: () => markSignedOut(qc),
    onError: () => {
      haptics.error();
      toast('Couldn’t sign out. Check your connection.');
    },
  });
};

/** /settings/account: who is signed in, then Sign out and Delete account (a two-step sheet) as action pills. */
export const AccountPage = (): React.JSX.Element => {
  const boot = useBootstrap();
  const sheet = useSheet();
  const toast = useToast();
  const logout = useSignOut();
  const runExport = () =>
    void exportAll(() => undefined).catch(() => {
      haptics.error();
      toast('Export didn’t finish. Check your connection.');
    });
  return (
    <div className="page s-set s-sub">
      <PushedBar title="Account" />
      {/* who is signed in, then the two ways out as action pills (reference 660), the one that loses everything in red */}
      <SGroup title="Signed in as">
        <Row title={boot.data?.user.email ?? ' '} className="s-email-row has-tile" left={<Tile icon={Mail} />} />
      </SGroup>
      <div className="s-pills">
        <ActionPill className="s-signout" disabled={logout.isPending} onPress={() => logout.mutate()}>
          {logout.isPending ? 'Signing out…' : 'Sign out'}
        </ActionPill>
        <ActionPill
          danger
          className="s-danger"
          onPress={() =>
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
        >
          Delete account
        </ActionPill>
      </div>
    </div>
  );
};
