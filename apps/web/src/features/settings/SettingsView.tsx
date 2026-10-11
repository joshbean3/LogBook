import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { api, ApiError } from '@/api/client';
import { keys, useBootstrap } from '@/api/queries';
import { useTheme } from '@/lib/theme';
import { Button, Card, CardHead, Note, PageHeader, Segmented } from '@/ui/primitives';
import { useToast } from '@/ui/Toast';

type BIP = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };
let deferredInstall: BIP | null = null;
if (typeof window !== 'undefined')
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstall = e as BIP;
  });

const isStandalone = () => matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);

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
  return (
    <div className="page">
      <PageHeader eyebrow="You" title="Settings" sub={boot.data?.user.email} />
      <Card>
        <CardHead title="Appearance" />
        <Segmented label="Theme" options={[['system', 'Match device'], ['light', 'Light'], ['dark', 'Dark']]} value={theme} onChange={setTheme} className="plan-tabs" />
      </Card>

      <Card>
        <CardHead title="Strava" meta={strava?.connected ? `Connected${strava.athleteName ? ` as ${strava.athleteName}` : ''}` : undefined} />
        {!features?.strava ? (
          <Note kind="info">Strava isn’t configured on this server yet. Add STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET from strava.com/settings/api, then restart.</Note>
        ) : strava?.connected ? (
          <>
            <p className="lead">Runs, lifts and workouts flow in automatically and mark your sessions done. Heart rate and mile splits grade the effort.</p>
            {strava.error ? <Note kind="warn">{strava.error}</Note> : null}
            <div className="row wrap">
              <Button variant="ghost" onClick={() => disconnect.mutate()} disabled={disconnect.isPending}>
                Disconnect
              </Button>
              <a className="btn" href="/api/strava/connect">
                Reconnect
              </a>
            </div>
          </>
        ) : (
          <>
            <p className="lead">Connect Strava and every run marks its session done, with heart rate and splits graded against the plan.</p>
            <a className="btn primary" href="/api/strava/connect" style={{ justifySelf: 'start' }}>
              Connect Strava
            </a>
          </>
        )}
      </Card>

      <Card>
        <CardHead title="Claude" />
        {features?.claude ? <p className="lead">Plan building and the coach’s read are on.</p> : <Note kind="info">Add ANTHROPIC_API_KEY on the server to build plans from a PDF, text or a description, and to get a coach’s read on each run.</Note>}
      </Card>

      <Card>
        <CardHead title="Install on your phone" />
        {isStandalone() ? (
          <Note kind="ok">You’re running the installed app.</Note>
        ) : canInstall ? (
          <>
            <p className="lead">Put Logbook on your home screen. It opens full-screen and works offline.</p>
            <Button
              variant="primary"
              style={{ justifySelf: 'start' }}
              onClick={async () => {
                if (!deferredInstall) return;
                await deferredInstall.prompt();
                const r = await deferredInstall.userChoice;
                if (r.outcome === 'accepted') setCanInstall(false);
                deferredInstall = null;
              }}
            >
              Install Logbook
            </Button>
          </>
        ) : isIOS() ? (
          <ol className="steps">
            <li>Tap the Share button in Safari (the square with an arrow).</li>
            <li>Scroll and tap “Add to Home Screen”.</li>
            <li>Tap Add. Logbook opens full-screen from your home screen.</li>
          </ol>
        ) : (
          <ol className="steps">
            <li>Open the browser menu (⋮).</li>
            <li>Tap “Add to Home screen” or “Install app”.</li>
            <li>Confirm. Logbook opens like any other app.</li>
          </ol>
        )}
      </Card>

      <Card>
        <CardHead title="Import from the dashboard" />
        <p className="lead">Bring over everything from the original Logbook dashboard: habits, plan, logs, Strava history, morning settings, to-dos and favorites. Safe to run more than once.</p>
        <input ref={fileRef} type="file" accept="application/json,.json" className="sr-only" onChange={(e) => e.target.files?.[0] && importBundle.mutate(e.target.files[0])} />
        <Button variant="primary" style={{ justifySelf: 'start' }} disabled={importBundle.isPending} onClick={() => fileRef.current?.click()}>
          {importBundle.isPending ? 'Importing…' : 'Choose export file'}
        </Button>
        {importResult ? <Note kind={/failed|isn’t/i.test(importResult) ? 'bad' : 'ok'}>{importResult}</Note> : null}
      </Card>

      <Card>
        <CardHead title="Account" />
        <Button variant="ghost" style={{ justifySelf: 'start' }} onClick={() => logout.mutate()}>
          Sign out
        </Button>
      </Card>
      <style>{`.steps{display:grid;gap:6px;padding-left:20px;list-style:decimal;color:var(--ink-2);font-size:14.5px}`}</style>
    </div>
  );
}
