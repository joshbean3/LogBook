import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { api, ApiError } from '@/api/client';
import { isNative } from '@/lib/native';
import { keys, useBootstrap } from '@/api/queries';
import { useTheme } from '@/lib/theme';
import { Button, Chip, Group, PageHeader, Row, SectionHead, Segmented } from '@/ui/primitives';
import { useToast } from '@/ui/Toast';
import './settings.css';

type BIP = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };
let deferredInstall: BIP | null = null;
if (typeof window !== 'undefined')
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstall = e as BIP;
  });

const isStandalone = () => matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);

const Steps = ({ steps }: { steps: string[] }) => (
  <ol>
    {steps.map((s, i) => (
      <li key={i} className="s-step">
        <i aria-hidden="true">{i + 1}</i>
        <span>{s}</span>
      </li>
    ))}
  </ol>
);

/** The Strava hand-off. In Safari it is a plain link; in the app it opens the system browser and the callback deep-links back. */
const ConnectStrava = ({ className, children }: { className: string; children: React.ReactNode }) => {
  if (!isNative) return <a className={className} href="/api/strava/connect">{children}</a>;
  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        try {
          const { url } = await api<{ url: string }>('/strava/connect-url');
          const { Browser } = await import('@capacitor/browser');
          await Browser.open({ url, presentationStyle: 'popover' });
        } catch {
          /* the toast from the status refetch covers it */
        }
      }}
    >
      {children}
    </button>
  );
};

export default function SettingsView() {
  const boot = useBootstrap();
  const qc = useQueryClient();
  const nav = useNavigate();
  const toast = useToast();
  const [theme, setTheme] = useTheme();
  const [sp, setSp] = useSearchParams();
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
  useEffect(() => {
    const s = sp.get('strava');
    if (s === 'connected') {
      toast('Strava connected. Pulling your activities…');
      void qc.invalidateQueries({ queryKey: keys.bootstrap });
      setTimeout(() => void qc.invalidateQueries({ queryKey: ['month'] }), 6000);
      setSp({}, { replace: true });
    } else if (s === 'error') {
      toast(`Strava didn’t connect: ${sp.get('reason') ?? 'unknown error'}`);
      setSp({}, { replace: true });
    }
  }, [sp, setSp, toast, qc]);
  const disconnect = useMutation({
    mutationFn: () => api('/strava/disconnect', { method: 'POST' }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.bootstrap }),
  });
  const fileRef = useRef<HTMLInputElement>(null);
  const [importResult, setImportResult] = useState<string | null>(null);
  const importBundle = useMutation({
    mutationFn: async (file: File) => {
      const text = await file.text();
      let json: unknown;
      try {
        json = JSON.parse(text);
      } catch {
        throw new ApiError('That file isn’t JSON.', 422);
      }
      return api<{ ok: boolean; imported: Record<string, number> }>('/import', { method: 'POST', json });
    },
    onSuccess: (r) => {
      const parts = Object.entries(r.imported).map(([k, n]) => `${n} ${k}`);
      setImportResult(parts.length ? `Imported ${parts.join(', ')}.` : 'Nothing new to import; it was already here.');
      void qc.invalidateQueries();
    },
    onError: (e) => setImportResult(e instanceof Error ? e.message : 'Import failed.'),
  });
  const logout = useMutation({
    mutationFn: () => api('/auth/logout', { method: 'POST' }),
    onSuccess: () => {
      qc.clear();
      nav('/login', { replace: true });
    },
  });
  const strava = boot.data?.strava;
  const features = boot.data?.features;
  const importFailed = importResult ? /failed|isn’t/i.test(importResult) : false;
  return (
    <div className="page s-set">
      <PageHeader title="Settings" sub={boot.data?.user.email} />

      <SectionHead title="Appearance" />
      <Group>
        <div className="lrow">
          <Segmented className="grow" label="Theme" options={[['system', 'Auto'], ['light', 'Light'], ['dark', 'Dark']]} value={theme} onChange={setTheme} />
        </div>
      </Group>

      {features?.strava ? <SectionHead title="Strava" /> : null}
      {features?.strava ? <Group>
        {!features?.strava ? (
          <Row title="Not connected" sub="Not available yet." />
        ) : strava?.connected ? (
          <>
            <Row title="Strava" sub={strava.athleteName ? `Connected as ${strava.athleteName}` : 'Runs, lifts and workouts flow in and mark sessions done.'} right={<Chip kind="done">Connected</Chip>} />
            {strava.error ? <Row title="Last sync failed" sub={strava.error} /> : null}
            <div className="lrow" style={{ justifyContent: 'flex-end', gap: 8, paddingBlock: 8 }}>
              <Button variant="ghost" onClick={() => disconnect.mutate()} disabled={disconnect.isPending}>
                Disconnect
              </Button>
              <ConnectStrava className="btn">Reconnect</ConnectStrava>
            </div>
          </>
        ) : (
          <Row
            title="Not connected"
            sub="Every run marks its session done, with heart rate and splits graded against the plan."
            right={
              <ConnectStrava className="chip-btn">Connect</ConnectStrava>
            }
          />
        )}
      </Group> : null}

      {features?.claude ? (
        <>
          <SectionHead title="Coach" />
          <Group>
            <Row title="Plan builder and coach’s read" sub="Builds plans from a PDF, text or a description, and reads each run." right={<Chip kind="done">On</Chip>} />
          </Group>
        </>
      ) : null}

      <SectionHead title="Install" />
      <Group>
        {isStandalone() ? (
          <Row title="Installed" sub="You’re running the installed app." right={<Chip kind="done">On this phone</Chip>} />
        ) : canInstall ? (
          <Row
            title="Add to home screen"
            sub="Opens full-screen and works offline."
            right={
              <Button
                size="sm"
                variant="primary"
                onClick={async () => {
                  if (!deferredInstall) return;
                  await deferredInstall.prompt();
                  const r = await deferredInstall.userChoice;
                  if (r.outcome === 'accepted') setCanInstall(false);
                  deferredInstall = null;
                }}
              >
                Install
              </Button>
            }
          />
        ) : isIOS() ? (
          <Steps steps={['Tap the Share button in Safari (the square with an arrow).', 'Scroll and tap “Add to Home Screen”.', 'Tap Add. Logbook opens full-screen from your home screen.']} />
        ) : (
          <Steps steps={['Open the browser menu (⋮).', 'Tap “Add to Home screen” or “Install app”.', 'Confirm. Logbook opens like any other app.']} />
        )}
      </Group>

      <SectionHead title="Import" />
      <Group>
        <Row
          title="From the dashboard"
          sub="Habits, plan, logs, Strava history, morning settings, to-dos and favorites. Safe to run more than once."
          right={
            <Button size="sm" variant="soft" disabled={importBundle.isPending} onClick={() => fileRef.current?.click()}>
              {importBundle.isPending ? 'Importing…' : 'Import'}
            </Button>
          }
        />
        <input ref={fileRef} type="file" accept="application/json,.json" className="sr-only" onChange={(e) => e.target.files?.[0] && importBundle.mutate(e.target.files[0])} />
        {importResult ? (
          <div className="lrow">
            <span className="t-sub" style={{ color: importFailed ? 'var(--bad)' : 'var(--ok)' }}>
              {importResult}
            </span>
          </div>
        ) : null}
      </Group>

      <SectionHead title="Account" />
      <Group>
        <Row className="s-out" title="Sign out" onClick={() => !logout.isPending && logout.mutate()} />
      </Group>
    </div>
  );
}
