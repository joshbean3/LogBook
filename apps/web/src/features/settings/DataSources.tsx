import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Activity, Check, CircleHelp, RefreshCw } from 'lucide-react';
import type * as React from 'react';
import { api } from '@/api/client';
import { keys, stravaSyncNow, useBootstrap, useStravaChecking } from '@/api/queries';
import { connectStrava } from '@/features/onboarding/StravaPrimer';
import { haptics } from '@/lib/haptics';
import { Button, Pressable, PushedBar, Row, useSheet, useToast } from '@/ui';
import { ago } from './format';
import { AppleHealthGroup } from './AppleHealth';
import { HrZonesRow } from './HrZones';
import { ActionPill, GoRow, SGroup, Tile } from './parts';
import './dataSources.css';


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

/** Disconnect asks first: new runs stop landing, the ones here stay. No toast: the Strava row turns back into Connect. */
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

/**
 * /settings/connections, "Data sources": where runs and health numbers come from. Strava (connected as whom, when it last
 * synced, Sync now, how it connects, the zones it brings, Disconnect behind a confirm) and Apple Health (connect, the
 * reading check, the coach's permission). The route keeps its old name so links and Strava's return still land here.
 */
export const DataSourcesPage = (): React.JSX.Element => {
  const boot = useBootstrap();
  const qc = useQueryClient();
  const sheet = useSheet();
  const toast = useToast();
  const openGuide = useConnectionSheet();
  const checking = useStravaChecking();
  const s = boot.data?.strava;
  const can = !!boot.data?.features.strava;
  const synced = ago(s?.lastSyncAt);
  const sync = () =>
    stravaSyncNow(qc, { force: true })
      .then(() => qc.invalidateQueries({ queryKey: keys.bootstrap }))
      .catch(() => {
        haptics.error();
        toast('Couldn’t reach Strava. Try again when you’re online.');
      });
  return (
    <div className="page s-set s-sub">
      <PushedBar title="Data sources" />
      <SGroup title="Strava" foot={can && s?.connected ? 'A run can take a minute to arrive after Strava has it.' : 'Where your runs come from.'}>
        {!can ? (
          <Row className="s-wrap has-tile" left={<Tile icon={Activity} tone="muted" />} title="Strava" sub="Not available on this Logbook yet." />
        ) : s?.connected && s.error ? (
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
        {can && s?.connected ? <GoRow className="s-how-row" icon={CircleHelp} title="How it connects" sub="The steps, and what to check if runs stop." onPress={() => openGuide(stravaGuide(true))} /> : null}
        <HrZonesRow zones={boot.data?.zones ?? null} connected={!!s?.connected} />
      </SGroup>

      <AppleHealthGroup />

      {can && s?.connected ? (
        <div className="s-pills">
          <ActionPill danger className="s-danger" onPress={() => sheet.open({ eyebrow: 'Connection', title: 'Disconnect Strava?', body: <DisconnectSheet /> })}>
            Disconnect Strava
          </ActionPill>
        </div>
      ) : null}
    </div>
  );
};
