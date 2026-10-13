import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { api, ApiError } from '@/api/client';
import { isNative } from '@/lib/native';
import { keys, useBootstrap } from '@/api/queries';
import { ChevronRight } from 'lucide-react';
import { Button, Chip, Group, PageHeader, Row } from '@/ui/primitives';
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

/** A caps eyebrow: the section head of this screen. */
const Sec = ({ title }: { title: string }) => (
  <div className="s-sec">
    <span className="caps">{title}</span>
  </div>
);

/** The account hand-off. In the browser it is a plain link; in the app it opens the system browser and the callback deep-links back. */
const connectNative = async () => {
  try {
    const { url } = await api<{ url: string }>('/strava/connect-url');
    const { Browser } = await import('@capacitor/browser');
    await Browser.open({ url, presentationStyle: 'popover' });
  } catch {
    /* the toast from the status refetch covers it */
  }
};
const ConnectStrava = ({ className, children }: { className: string; children: React.ReactNode }) => {
  if (!isNative)
    return (
      <a className={className} href="/api/strava/connect">
        {children}
      </a>
    );
  return (
    <button type="button" className={className} onClick={connectNative}>
      {children}
    </button>
  );
};
/** The verb at the right of a whole-row action, with the chevron that says the row goes somewhere. */
const Verb = ({ children }: { children: React.ReactNode }) => (
  <>
    <span className="lrow-verb">{children}</span>
    <ChevronRight size={16} className="lrow-chev" aria-hidden="true" />
  </>
);

export default function SettingsView() {
  const boot = useBootstrap();
  const qc = useQueryClient();
  const nav = useNavigate();
  const toast = useToast();
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
      toast('Connected. Pulling your runs…');
      void qc.invalidateQueries({ queryKey: keys.bootstrap });
      setTimeout(() => void qc.invalidateQueries({ queryKey: ['month'] }), 6000);
      setSp({}, { replace: true });
    } else if (s === 'error') {
      toast('Didn’t connect. Try again.');
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

      {features?.strava ? (
        <>
          <Sec title="Account" />
          <Group>
            {strava?.connected ? (
              <>
                <Row title="Run sync" sub={strava.athleteName ? `Connected as ${strava.athleteName}` : 'Connected'} right={<Chip kind="done">Connected</Chip>} />
                {strava.error ? <Row title="Last sync failed" sub="Reconnect to try again." /> : null}
                <div className="lrow s-actions">
                  <Button variant="quiet" onClick={() => disconnect.mutate()} disabled={disconnect.isPending}>
                    Disconnect
                  </Button>
                  <ConnectStrava className="btn quiet">Reconnect</ConnectStrava>
                </div>
              </>
            ) : (
              isNative ? (
                <Row title="Run sync" sub="Not connected" onClick={() => void connectNative()} label="Run sync, not connected. Connect" right={<Verb>Connect</Verb>} />
              ) : (
                <Row title="Run sync" sub="Not connected" href="/api/strava/connect" label="Run sync, not connected. Connect" right={<Verb>Connect</Verb>} />
              )
            )}
          </Group>
        </>
      ) : null}

      {features?.claude ? (
        <>
          <Sec title="Coach" />
          <Group>
            <Row title="Plan builder and coach’s read" sub="Builds plans from a PDF, text or a description, and reads each run." right={<Chip kind="done">On</Chip>} />
          </Group>
        </>
      ) : null}

      <Sec title="Data" />
      <Group>
        <Row title="Import" sub="From your old log" onClick={() => !importBundle.isPending && fileRef.current?.click()} label="Import from your old log. Choose a file" right={importBundle.isPending ? <Verb>Importing…</Verb> : <ChevronRight size={16} className="lrow-chev" aria-hidden="true" />} />
        <input ref={fileRef} type="file" accept="application/json,.json" className="sr-only" onChange={(e) => e.target.files?.[0] && importBundle.mutate(e.target.files[0])} />
        {importResult ? (
          <div className="lrow">
            <span className={`s-result ${importFailed ? 'bad' : ''}`}>{importResult}</span>
          </div>
        ) : null}
      </Group>

      {/* Add to Home Screen means nothing inside the app itself; the web keeps it */}
      {!isNative ? (
        <>
          <Sec title="Install" />
          <Group>
            {isStandalone() ? (
              <Row title="Installed" sub="You’re running the installed app." right={<Chip kind="done">On this phone</Chip>} />
            ) : canInstall ? (
              <Row
                title="Add to Home Screen"
                sub="Opens full-screen and works offline."
                label="Add to Home Screen. Install"
                onClick={async () => {
                  if (!deferredInstall) return;
                  await deferredInstall.prompt();
                  const r = await deferredInstall.userChoice;
                  if (r.outcome === 'accepted') setCanInstall(false);
                  deferredInstall = null;
                }}
                right={<Verb>Install</Verb>}
              />
            ) : (
              <Row title="Add to Home Screen" sub="From the browser’s share menu." />
            )}
          </Group>
        </>
      ) : null}

      <Group className="s-out-group">
        <Row className="s-out" title="Sign out" onClick={() => !logout.isPending && logout.mutate()} />
      </Group>
    </div>
  );
}
