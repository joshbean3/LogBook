import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Activity, Check, CircleHelp, Gauge, RefreshCw } from 'lucide-react';
import type * as React from 'react';
import { useEffect } from 'react';
import { api } from '@/api/client';
import { keys, stravaSyncNow, useBootstrap, useStravaChecking } from '@/api/queries';
import { useNav } from '@/app/NavController';
import { connectStrava } from '@/features/onboarding/StravaPrimer';
import { haptics } from '@/lib/haptics';
import { Button, Pressable, Row, useSheet, useToast } from '@/ui';
import { ago } from './format';
import { HrZonesRow, zoneLine } from './HrZones';
import { ActionPill, GoRow, SGroup, Tile } from './parts';
import './dataSources.css';

/**
 * Everything Settings says and does about Strava, in one module. Nothing else in Settings names Strava: the pages render
 * these only when the build has it (`STRAVA_BUILT`, lib/features.ts), so a release build without Strava carries none of
 * this code or its words.
 */

// ---------- the connection page pattern (inspiration §6 Settings, refs 458–461, 706, 707) ----------

export interface ConnectionGuide {
  /** The source's name, for the sheet's eyebrow. */
  name: string;
  /** The steps sheet's title ("Connect Strava", "How Strava connects"). */
  title: string;
  /** Numbered steps, in order, each one short sentence that starts with a verb. */
  steps: string[];
  /** What to check when it did not work, most likely first. */
  checklist: string[];
  /** The one action: Connect, Reconnect. */
  action: { label: string; onPress: () => void };
}

/** The steps, numbered, with a quiet way to the checklist and the action pinned under them. */
const StepsPanel = ({ guide }: { guide: ConnectionGuide }): React.JSX.Element => {
  const sheet = useSheet();
  return (
    <div className="cx">
      <ol className="cx-steps">
        {guide.steps.map((s, i) => (
          <li key={s}>
            <span className="cx-n stamp" aria-hidden="true">
              {i + 1}
            </span>
            <span>{s}</span>
          </li>
        ))}
      </ol>
      <Pressable className="cx-help" press="dim" onPress={() => sheet.push({ title: 'If it didn’t connect', body: <ChecklistPanel guide={guide} /> })}>
        <CircleHelp size={18} aria-hidden="true" />
        If it didn’t connect
      </Pressable>
      <Pressable className="btn primary block cx-cta" onPress={guide.action.onPress}>
        {guide.action.label}
      </Pressable>
    </div>
  );
};

/** The failure sheet: what to check, then the same action again. */
const ChecklistPanel = ({ guide, lede }: { guide: ConnectionGuide; lede?: string }): React.JSX.Element => (
  <div className="cx">
    {lede ? <p className="cx-lede">{lede}</p> : null}
    <ul className="cx-check">
      {guide.checklist.map((c) => (
        <li key={c}>
          <Check size={16} strokeWidth={2.6} aria-hidden="true" />
          <span>{c}</span>
        </li>
      ))}
    </ul>
    <Pressable className="btn primary block cx-cta" onPress={guide.action.onPress}>
      {guide.action.label}
    </Pressable>
  </div>
);

/** Open a connection's sheet: the numbered steps, or (after a failure) the checklist first. */
export const useConnectionSheet = () => {
  const sheet = useSheet();
  return (guide: ConnectionGuide, mode: 'steps' | 'failed' = 'steps') =>
    sheet.open(
      mode === 'failed'
        ? { eyebrow: guide.name, title: 'It didn’t connect', body: <ChecklistPanel guide={guide} lede="Check these, then try again." /> }
        : { eyebrow: 'Connection', title: guide.title, body: <StepsPanel guide={guide} /> },
    );
};

/** Strava's steps and checklist, in plain words. */
export const stravaGuide = (connected: boolean): ConnectionGuide => ({
  name: 'Strava',
  title: connected ? 'How Strava connects' : 'Connect Strava',
  steps: [connected ? 'Tap Reconnect. Strava opens.' : 'Tap Connect. Strava opens.', 'Sign in to Strava, then tap Authorize.', 'Leave “View data about your activities” on. Logbook reads your runs with it.', 'Come back here. New runs land on Today a minute after they sync.'],
  checklist: ['You tapped Authorize, not Cancel.', '“View data about your activities” was left on.', 'You’re online, and Strava opened in the browser.', 'Still stuck: disconnect here, then connect again.'],
  action: { label: connected ? 'Reconnect Strava' : 'Connect Strava', onPress: () => void connectStrava() },
});

/** Disconnect asks first: the server deauthorizes and deletes what it read from Strava. No toast: the Strava row turns back into Connect. */
const DisconnectSheet = (): React.JSX.Element => {
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
      <p className="s-del-lede">Logbook disconnects from Strava and deletes the runs, laps and heart-rate zones it read from there. Sessions you logged yourself stay.</p>
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

/** Strava's hand-off comes back to `/settings?strava=…` (the API's landing): read once per page load. */
let stravaReturnRead = false;
/** Mounted by the Settings root: answers the return from Strava's own page (connected, or what to check). */
export const StravaReturn = (): null => {
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
  return null;
};

/** The Settings root's rows: Strava (connected as whom, or Connect, or Fix) and the heart-rate zones it brings. */
export const StravaRootRows = ({ onPress }: { onPress: () => void }): React.JSX.Element | null => {
  const data = useBootstrap().data;
  const strava = data?.strava;
  if (!data?.features.strava) return null;
  const zones = zoneLine(data.zones);
  return (
    <>
      <GoRow
        icon={Activity}
        title="Strava"
        sub={
          strava?.connected && strava.error
            ? 'Stopped syncing. Reconnect to pick up new runs.'
            : strava?.connected
              ? [strava.athleteName ? `Connected as ${strava.athleteName}` : 'Connected', ago(strava.lastSyncAt) ? `synced ${ago(strava.lastSyncAt)}` : null].filter(Boolean).join(', ')
              : 'See your runs land on Today.'
        }
        value={strava?.connected && strava.error ? 'Fix' : strava?.connected ? undefined : 'Connect'}
        tone={strava?.connected && strava.error ? 'bad' : undefined}
        onPress={onPress}
      />
      {zones ? <GoRow icon={Gauge} title="Heart-rate zones" sub={zones} onPress={onPress} /> : null}
    </>
  );
};

/**
 * The Strava group of Data sources: connected as whom, when it last synced, Sync now, how it connects, the zones it brings.
 * Shown only while the server has Strava (`features.strava`): an outage hides the group, it never shows a dead row.
 */
export const StravaGroup = (): React.JSX.Element | null => {
  const boot = useBootstrap();
  const qc = useQueryClient();
  const toast = useToast();
  const openGuide = useConnectionSheet();
  const checking = useStravaChecking();
  const s = boot.data?.strava;
  const synced = ago(s?.lastSyncAt);
  if (!boot.data?.features.strava) return null;
  const sync = () =>
    stravaSyncNow(qc, { force: true })
      .then(() => qc.invalidateQueries({ queryKey: keys.bootstrap }))
      .catch(() => {
        haptics.error();
        toast('Couldn’t reach Strava. Try again when you’re online.');
      });
  return (
    <SGroup title="Strava" foot={s?.connected ? 'A run can take a minute to arrive after Strava has it.' : 'Where your runs come from.'}>
      {s?.connected && s.error ? (
        <GoRow icon={Activity} title="Stopped syncing" sub="Reconnect to pick up new runs." value="Fix" tone="bad" onPress={() => openGuide(stravaGuide(true), 'failed')} />
      ) : s?.connected ? (
        <>
          <Row
            className="s-wrap has-tile"
            left={<Tile icon={Activity} />}
            title="Strava"
            sub={s.athleteName ? `As ${s.athleteName}` : 'Your runs land on Today.'}
            right={
              <span className="ds-ok">
                <Check size={16} strokeWidth={2.6} aria-hidden="true" />
                Connected
              </span>
            }
          />
          <Row
            className="s-sync-row has-tile"
            left={<Tile icon={RefreshCw} />}
            title="Sync now"
            sub={checking ? 'Checking Strava…' : synced ? `Last synced ${synced}` : 'Not synced yet'}
            onClick={() => (checking ? undefined : void sync())}
          />
        </>
      ) : (
        <GoRow icon={Activity} title="Connect Strava" sub="Your runs land on Today a minute after they sync." onPress={() => openGuide(stravaGuide(false))} />
      )}
      {s?.connected ? <GoRow className="s-how-row" icon={CircleHelp} title="How it connects" sub="The steps, and what to check if runs stop." onPress={() => openGuide(stravaGuide(true))} /> : null}
      <HrZonesRow zones={boot.data?.zones ?? null} connected={!!s?.connected} />
    </SGroup>
  );
};

/** Disconnect, under every group of the page, behind a confirm. */
export const StravaDisconnectPill = (): React.JSX.Element | null => {
  const boot = useBootstrap();
  const sheet = useSheet();
  if (!boot.data?.features.strava || !boot.data.strava?.connected) return null;
  return (
    <div className="s-pills">
      <ActionPill danger className="s-danger" onPress={() => sheet.open({ eyebrow: 'Connection', title: 'Disconnect Strava?', body: <DisconnectSheet /> })}>
        Disconnect Strava
      </ActionPill>
    </div>
  );
};
