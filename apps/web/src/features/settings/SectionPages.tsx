import { useMutation, useQueryClient } from '@tanstack/react-query';
import type * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import { api, ApiError } from '@/api/client';
import type { ProviderConnection, ProviderId, Reminder } from '@logbook/shared';
import type { Bootstrap } from '@/api/types';
import { connectProvider, keys, stravaSyncNow, useBootstrap, useConnectionMutations, useConnections, useNotificationSettings, useNotificationSettingsPatch, useReminderMutations, useReminders, useStravaChecking } from '@/api/queries';
import { markSignedOut } from '@/features/auth/flag';
import { remindersOn, remindersSupported } from '@/features/goals/reminders';
import { haptics, useHapticsEnabled } from '@/lib/haptics';
import { isNative } from '@/lib/native';
import { currentWebPush, disablePush, enablePush, webPushSupported } from '@/lib/sw';
import { Button, PushedBar, Row, useSheet, useToast } from '@/ui';
import { ChangeEmailSheet, ChangePasswordSheet, DeleteStepOne, emailVerifiedOf, exportAll, useEndOtherSessions, useEndSession, useResendVerification, useSessions } from './account';
import { popFav } from '@/features/journal/feel';
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

/** Disconnect asks first: new runs stop landing, the ones here stay. No toast: the row turns back into Connect. */
const DisconnectSheet = ({ provider, name }: { provider: ProviderId; name: string }) => {
  const sheet = useSheet();
  const toast = useToast();
  const { disconnect } = useConnectionMutations();
  return (
    <div className="s-del">
      <p className="s-del-lede">New runs stop landing on Today. The runs already here stay.</p>
      <div className="s-del-actions">
        <Button
          variant="danger"
          block
          disabled={disconnect.isPending}
          onClick={() =>
            disconnect.mutate(provider, {
              onSuccess: () => sheet.close(),
              onError: () => {
                haptics.error();
                toast('Couldn’t disconnect. Try again.');
              },
            })
          }
        >
          {disconnect.isPending ? 'Disconnecting…' : `Disconnect ${name}`}
        </Button>
        <Button variant="quiet" block onClick={() => sheet.close()}>
          Keep it connected
        </Button>
      </div>
    </div>
  );
};

/** One provider's rows: connect, or connected-as with the last sync and Sync now, and an error line when it broke. */
const ProviderRows = ({ c, syncing, onSync }: { c: ProviderConnection; syncing: boolean; onSync: () => void }) => {
  const connect = () => void connectProvider(c.provider).catch(() => undefined);
  const blurb = c.provider === 'strava' ? 'See your runs land on Today.' : 'Runs from your watch, straight to Today.';
  if (!c.connected) return <GoRow title={`Connect ${c.name}`} sub={blurb} onPress={connect} />;
  if (c.status === 'needs_reauth' || c.status === 'revoked') return <GoRow title={`${c.name} stopped syncing`} sub="Reconnect to pick up new runs." value="Reconnect" tone="bad" onPress={connect} />;
  return (
    <>
      <Row title={c.athleteName ? `Connected as ${c.athleteName}` : 'Connected'} sub="New runs land on Today a minute after they sync." className="s-wrap" />
      <Row className="s-sync-row" title="Sync now" sub={syncing ? `Checking ${c.name}…` : ago(c.lastSyncAt) ? `Last synced ${ago(c.lastSyncAt)}` : 'Not synced yet'} onClick={() => (syncing ? undefined : onSync())} />
      {c.error ? <Row className="s-wrap" title="Last sync had a problem" sub={<span className="s-bad">{c.error}</span>} /> : null}
    </>
  );
};

/** /settings/connections: Strava and COROS (connect, the last sync, Sync now, an error line, disconnect) and the heart-rate zones. */
export const ConnectionsPage = (): React.JSX.Element => {
  const boot = useBootstrap();
  const qc = useQueryClient();
  const sheet = useSheet();
  const toast = useToast();
  const checking = useStravaChecking();
  const list = useConnections();
  const { sync } = useConnectionMutations();
  const connections = list.data ?? boot.data?.connections ?? [];
  const configured = connections.filter((c) => c.configured);
  const syncOne = (p: ProviderId) => {
    const fail = () => {
      haptics.error();
      toast(`Couldn’t reach ${p === 'coros' ? 'COROS' : 'Strava'}. Try again when you’re online.`);
    };
    // Strava's own sync keeps the pull-to-refresh bookkeeping; the rest go through the provider route
    if (p === 'strava')
      return void stravaSyncNow(qc, { force: true })
        .then(() => qc.invalidateQueries({ queryKey: keys.bootstrap }))
        .catch(fail);
    sync.mutate(p, { onError: fail });
  };
  return (
    <div className="page s-set s-sub">
      <PushedBar title="Connections" />
      {!configured.length && !list.isPending ? (
        <p className="s-note s-first">This server isn’t set up to connect to Strava or COROS.</p>
      ) : (
        <>
          {configured.map((c) => (
            <SGroup key={c.provider} title={c.name}>
              <ProviderRows c={c} syncing={c.provider === 'strava' ? checking || c.syncing : sync.isPending || c.syncing} onSync={() => syncOne(c.provider)} />
            </SGroup>
          ))}
          {configured.some((c) => c.connected) ? (
            <SGroup title="Disconnect" className="s-sec-quiet">
              {configured
                .filter((c) => c.connected)
                .map((c) => (
                  <Row key={c.provider} className="s-danger" title={`Disconnect ${c.name}`} onClick={() => sheet.open({ eyebrow: 'Connection', title: `Disconnect ${c.name}?`, body: <DisconnectSheet provider={c.provider} name={c.name} /> })} />
                ))}
            </SGroup>
          ) : null}
        </>
      )}
    </div>
  );
};

// ---------- notifications ----------

const whenOf = (r: Reminder) => {
  if (!r.local) return r.fireAtUtc;
  const [y, m, d] = r.local.date.split('-').map(Number) as [number, number, number];
  const day = new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  const repeat = r.rrule ? (r.rrule === 'FREQ=DAILY' ? ', daily' : `, weekly`) : '';
  return `${day} at ${r.local.time}${repeat}${r.source === 'agent' ? ' · from the assistant' : r.source === 'system' ? ' · Logbook' : ''}`;
};

/**
 * /settings/notifications: push on this device (web push in the browser; on the phone the app's token, or its local
 * notifications when the push plugin is not built in), the two reminders Logbook sends on its own, the owner's own
 * reminders (each with a delete), and quiet hours.
 */
export const NotificationsPage = (): React.JSX.Element => {
  const boot = useBootstrap();
  const qc = useQueryClient();
  const toast = useToast();
  const settings = useNotificationSettings();
  const patch = useNotificationSettingsPatch();
  const list = useReminders();
  const { remove } = useReminderMutations();
  const serverCan = !!boot.data?.features.notifications;
  const supported = isNative ? remindersSupported() : webPushSupported();
  const [here, setHere] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (isNative) setHere(remindersOn());
    else void currentWebPush().then((s) => setHere(!!s));
  }, []);
  const toggle = async (on: boolean) => {
    if (busy) return;
    setBusy(true);
    try {
      if (on) {
        const out = await enablePush();
        if (out === 'on') {
          setHere(true);
          haptics.drop();
        } else if (out === 'denied') toast('Notifications are blocked for Logbook in your browser settings.');
        else if (out === 'server_off') toast('This server has no push keys yet (VAPID_PUBLIC_KEY).');
        else if (out === 'unsupported') toast(isNative ? 'Notifications aren’t available here.' : 'Install Logbook to the home screen first.');
        else toast('Couldn’t turn notifications on. Try again.');
      } else {
        await disablePush();
        setHere(false);
      }
      void qc.invalidateQueries({ queryKey: keys.bootstrap });
    } finally {
      setBusy(false);
    }
  };
  const quiet = settings.data?.quietHours ?? null;
  const setQuiet = (q: { start: string; end: string } | null) => patch.mutate({ quietHours: q });
  return (
    <div className="page s-set s-sub">
      <PushedBar title="Notifications" />
      <SGroup title="This device">
        <Row
          className="s-wrap"
          title="Notifications on this device"
          sub={!supported ? (isNative ? 'Not available on this build.' : 'Install Logbook to the home screen to get them.') : here ? 'Reminders arrive here.' : isNative || serverCan ? 'Your goal, tomorrow’s run, and your own reminders.' : 'This server can’t send push yet.'}
          right={<Switch on={!!here} label="Notifications on this device" onChange={(on) => void toggle(on)} />}
        />
      </SGroup>
      <SGroup title="From Logbook">
        <Row className="s-wrap" title="Today’s goal is unset" sub="Fifteen minutes after your alarm, while it is." right={<Switch on={settings.data?.goalUnset ?? true} label="Goal reminder" onChange={(on) => patch.mutate({ goalUnset: on })} />} />
        <Row className="s-wrap" title="Tomorrow’s session" sub="At 9 pm: what it is and when you’re out the door." right={<Switch on={settings.data?.tomorrow ?? true} label="Tomorrow reminder" onChange={(on) => patch.mutate({ tomorrow: on })} />} />
      </SGroup>
      <SGroup title="Your reminders">
        {list.isPending ? (
          <Row title=" " sub="Loading…" className="s-wrap" />
        ) : list.data?.length ? (
          list.data.map((r) => (
            <Row
              key={r.id}
              className="s-wrap"
              title={r.title}
              sub={whenOf(r)}
              right={
                <button type="button" className="as-undo" onClick={() => remove.mutate(r.id, { onError: () => toast('Couldn’t remove that. Try again.') })} aria-label={`Delete reminder ${r.title}`}>
                  Delete
                </button>
              }
            />
          ))
        ) : (
          <Row className="s-wrap" title="None yet" sub="Ask the assistant: “remind me to pack my kit at 9 tonight”." />
        )}
      </SGroup>
      <SGroup title="Quiet hours">
        <Row className="s-wrap" title="Quiet hours" sub={quiet ? 'A reminder due in them waits for the end.' : 'Off. Reminders come whenever they are due.'} right={<Switch on={!!quiet} label="Quiet hours" onChange={(on) => setQuiet(on ? { start: '22:00', end: '07:00' } : null)} />} />
        {quiet ? (
          <Row
            title="From"
            right={
              <span className="s-quiet">
                <input className="s-quiet-in" type="time" value={quiet.start} aria-label="Quiet hours start" onChange={(e) => e.target.value && setQuiet({ ...quiet, start: e.target.value })} />
                <span className="s-value">to</span>
                <input className="s-quiet-in" type="time" value={quiet.end} aria-label="Quiet hours end" onChange={(e) => e.target.value && setQuiet({ ...quiet, end: e.target.value })} />
              </span>
            }
          />
        ) : null}
      </SGroup>
    </div>
  );
};

/**
 * The Haptics switch (the Settings root's App group and the App page). Turning it on answers with the feel it turns on, as
 * `toggle` on the apex of the `complete` curve (`hapticAtPeak`, contracts §D.3: never fired straight from the tap; review
 * code F13); turning it off is silent.
 */
export const HapticsRow = (): React.JSX.Element => {
  const [hapticsOn, setHapticsOn] = useHapticsEnabled();
  return (
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
        <HapticsRow />
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

/** "since Oct 3" for the sessions list. */
const since = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

/**
 * /settings/account: the address (Verified, or Not verified with Resend; the row opens Change email), Change password,
 * the sessions (this device marked, Sign out per row, Sign out everywhere else, Sign out), and Delete account (a two-step sheet).
 */
export const AccountPage = (): React.JSX.Element => {
  const boot = useBootstrap();
  const qc = useQueryClient();
  const sheet = useSheet();
  const toast = useToast();
  const sessions = useSessions();
  const endSession = useEndSession();
  const endOthers = useEndOtherSessions();
  const resend = useResendVerification();
  const [resent, setResent] = useState(false);
  // null = the link was never opened; undefined = a cache from before verification existed (nothing to nag about)
  const unverified = emailVerifiedOf(boot.data) === null;
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
  const doResend = () =>
    resend.mutate(undefined, {
      onSuccess: (r) => {
        setResent(true);
        if (r.emailVerifiedAt) qc.setQueryData<Bootstrap>(keys.bootstrap, (b) => (b ? { ...b, user: { ...b.user, emailVerifiedAt: r.emailVerifiedAt } as Bootstrap['user'] } : b));
        toast(r.emailVerifiedAt ? 'Already verified.' : 'A new link is on its way. It works for 24 hours.');
      },
      onError: (e) => {
        haptics.error();
        toast(e instanceof ApiError && e.status === 429 ? 'Three mails an hour is the limit. Check your inbox for the last one.' : 'Couldn’t send the link. Check your connection.');
      },
    });
  const list = sessions.data ?? [];
  const others = list.filter((s) => !s.current);
  const cannot = () => {
    haptics.error();
    toast('Couldn’t sign that device out. Check your connection.');
  };
  return (
    <div className="page s-set s-sub">
      <PushedBar title="Account" />
      <SGroup title="Signed in as">
        <GoRow
          className="s-email-row s-wrap"
          title={boot.data?.user.email ?? ' '}
          sub={unverified ? 'Not verified' : 'Verified'}
          value={
            unverified ? (
              <Button variant="soft" size="sm" disabled={resend.isPending || resent} onClick={doResend}>
                {resent ? 'Sent' : resend.isPending ? 'Sending…' : 'Resend'}
              </Button>
            ) : undefined
          }
          label="Change email"
          onPress={() => sheet.open({ eyebrow: 'Account', title: 'Change email', body: <ChangeEmailSheet onDone={toast} />, sticky: true })}
        />
        <GoRow title="Change password" onPress={() => sheet.open({ eyebrow: 'Account', title: 'Change password', body: <ChangePasswordSheet onDone={toast} />, sticky: true })} />
      </SGroup>
      {/* every device with this account open: this one first, the rest with Sign out; then the two ways out of this one */}
      <SGroup title="Sessions">
        {sessions.isPending ? <Row title=" " sub="Loading…" className="s-wrap" /> : null}
        {list.map((s) => (
          <Row
            key={s.id}
            className="s-wrap"
            title={s.device}
            sub={s.current ? `This device · since ${since(s.createdAt)}` : `Last seen ${ago(s.lastSeenAt) ?? 'a while ago'} · since ${since(s.createdAt)}`}
            right={
              !s.current ? (
                <Button variant="quiet" size="sm" className="s-session-out" disabled={endSession.isPending} onClick={() => endSession.mutate(s.id, { onError: cannot })}>
                  Sign out
                </Button>
              ) : null
            }
          />
        ))}
        {others.length ? (
          <Row
            title={endOthers.isPending ? 'Signing out…' : 'Sign out everywhere else'}
            onClick={() =>
              !endOthers.isPending &&
              endOthers.mutate(undefined, {
                onSuccess: (r) => toast(r.revoked === 1 ? 'Signed out one other device.' : `Signed out ${r.revoked} other devices.`),
                onError: cannot,
              })
            }
          />
        ) : null}
        <Row className="s-signout" title={logout.isPending ? 'Signing out…' : 'Sign out'} onClick={() => !logout.isPending && logout.mutate()} />
      </SGroup>
      <SGroup title="Your account">
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
