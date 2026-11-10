import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Activity, ChevronRight, CloudUpload, Database, Heart, HeartPulse, Moon, RefreshCw, ShieldCheck, TriangleAlert } from 'lucide-react';
import { HEALTH_HISTORY_DAYS, type HealthStatus } from '@logbook/shared';
import { api } from '@/api/client';
import { healthStatusKey, healthSyncNow, syncErrorWords, useHealthSync } from '@/lib/healthSync';
import { apiOrigin } from '@/lib/native';
import { useEffect, useState } from 'react';
import type * as React from 'react';
import { BevelDial, GlassTile, HealthHero, Hypnogram, MonitorTile, SourceLine, StageTile, TimeChip } from '@/features/health/HealthParts';
import { DISCLAIMER } from '@/lib/copy';
import { haptics } from '@/lib/haptics';
import { Health, healthMode, hm, summarizeNight, type ReadingCheck } from '@/lib/health';
import { LEGAL, openExternal } from '@/lib/siteLinks';
import { Button, Pressable, useSheet, useToast } from '@/ui';
import { HEALTH_READS, HEALTH_READS_LINE, HEALTH_READS_SHORT, HEALTH_REVOKE_PATH, HEALTH_TRUST, importDoneWords, importWords, savedWords } from './healthCopy';
import { rememberHealthDevice } from './healthDevice';
import { SCard } from './parts';
import './appleHealth.css';

/**
 * Apple Health in Settings, Data sources (docs/health/apple-health.md): the source as a device card, connecting as an
 * illustrated sheet, and the reading check (last night and the two heart numbers, read live on the phone). 1.0 reads three
 * things and no more: sleep, heart rate variability and resting heart rate. Every sentence here says only that
 * (healthCopy.ts). Connected, the engine (packages/capacitor-health HealthSync.swift) keeps the account in step.
 */

const accessKey = ['health', 'access'] as const;
/** Whether Apple Health is here, and whether Apple's sheet would still show (Apple never says what was allowed). */
export const useHealthAccess = () =>
  useQuery({
    queryKey: accessKey,
    queryFn: async () => {
      if (!Health) return { available: false, needed: false };
      const { available } = await Health.isAvailable();
      if (!available) return { available, needed: false };
      const { needed } = await Health.needsAuthorization();
      return { available, needed };
    },
    staleTime: 30_000,
  });

const agoWords = (iso: string | null | undefined) => {
  if (!iso) return null;
  const m = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60_000));
  return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 24 * 60 ? `${Math.round(m / 60)} h ago` : new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(iso));
};
const monthOf = (detail?: string) => {
  const t = detail ? Date.parse(detail) : NaN;
  return Number.isNaN(t) ? null : new Date(t);
};

/** The account's Apple Health connection on the server: what has arrived, and the devices. */
export const useHealthServerStatus = () => useQuery({ queryKey: healthStatusKey, queryFn: () => api<HealthStatus>('/apple-health/status'), staleTime: 30_000 });
/** This phone's engine: connected here, waiting uploads, still importing. */
const deviceKey = ['health', 'device'] as const;
const useHealthDevice = () => useQuery({ queryKey: deviceKey, queryFn: () => (Health ? Health.status() : Promise.resolve(null)), enabled: !!Health, staleTime: 5_000 });

/** A row inside the device card: icon tile, words, value, chevron. */
const CardRow = ({ icon: Icon, title, sub, value, onPress, tone }: { icon: typeof Moon; title: string; sub?: string; value?: string; onPress?: () => void; tone?: 'orange' }) => {
  const inner = (
    <>
      <span className={`ah-row-ic ${tone === 'orange' ? '' : 'is-navy'}`} aria-hidden="true">
        <Icon size={16} strokeWidth={2.2} />
      </span>
      <span className="ah-row-text">
        <span className="ah-row-title">{title}</span>
        {sub ? <span className="ah-row-sub">{sub}</span> : null}
      </span>
      {value ? <span className="ah-row-value">{value}</span> : null}
      {onPress ? <ChevronRight size={18} className="ah-chev" aria-hidden="true" /> : null}
    </>
  );
  return onPress ? (
    <Pressable className="ah-row" press="dim" onPress={onPress} label={`${title}${value ? `: ${value}` : ''}`}>
      {inner}
    </Pressable>
  ) : (
    <div className="ah-row">{inner}</div>
  );
};

/**
 * The Apple Health section of Data sources: the source as a device card. Before connecting: Connect. Connected on this
 * phone: when it last synced (or the month being read), Sync, what has been saved to the account and the reading check.
 * Disconnect sits at the foot of the card whenever the account holds a connection.
 */
export const AppleHealthGroup = (): React.JSX.Element => {
  const sheet = useSheet();
  const qc = useQueryClient();
  const access = useHealthAccess();
  const server = useHealthServerStatus();
  const device = useHealthDevice();
  const sync = useHealthSync();
  const openConnect = () => sheet.open({ title: 'Apple Health', body: <ConnectPanel /> });
  const openCheck = () => sheet.open({ title: 'Reading check', detent: 'large', body: <ReadingCheckPanel /> });
  const web = healthMode === 'web';
  const unavailable = !web && access.data && !access.data.available;
  const s = server.data;
  const connectedHere = !web && !!device.data?.connected && !!s?.connected;
  const connectedElsewhere = !!s?.connected && !connectedHere;
  const running = sync.phase === 'running' || sync.phase === 'importing';
  const importMonth = monthOf(sync.detail);

  let status: React.ReactNode;
  if (web && s?.connected) status = agoWords(s.lastSyncAt) ? `Connected on iPhone · synced ${agoWords(s.lastSyncAt)}` : 'Connected on iPhone · not synced yet';
  else if (web) status = 'Connects from the Logbook app on your iPhone';
  else if (unavailable) status = 'Not available on this device';
  else if (connectedHere && sync.phase === 'importing') status = importWords(importMonth);
  else if (connectedHere && running) status = 'Syncing…';
  else if (connectedHere && sync.phase === 'error') status = syncErrorWords(sync.detail);
  else if (connectedHere) status = agoWords(s?.lastSyncAt ?? device.data?.lastSyncAt) ? `Synced ${agoWords(s?.lastSyncAt ?? device.data?.lastSyncAt)}` : 'Not synced yet';
  // the account holds readings but this phone is not sending any (signed in again, or connected from another iPhone)
  else if (connectedElsewhere) status = 'Not connected on this iPhone';
  else status = HEALTH_READS_SHORT;
  // the dot says readings are arriving: from this phone, or (seen from the web) from the iPhone
  const live = connectedHere || (web && connectedElsewhere);

  const saved = s ? savedWords(s) : null;

  return (
    <SCard title="Apple Health" className="ah-sec" foot={connectedHere ? `Syncs when you open Logbook and when you pull down on Today. ${HEALTH_TRUST}` : HEALTH_TRUST}>
      <div className="ah-device">
        {/* a plain heart glyph, not a look-alike of Apple's app icon (copy-legal-27); Apple's own icon can go here once supplied */}
        <span className="ah-app" aria-hidden="true">
          <Heart size={24} strokeWidth={2.2} />
        </span>
        <span className="ah-device-text">
          <span className="ah-device-name">Apple Health</span>
          <span className={`ah-device-status ${live ? 'is-on' : ''} ${running ? 'is-running' : ''}`}>
            {live ? <i aria-hidden="true" /> : null}
            {status}
          </span>
        </span>
        {web || unavailable ? null : connectedHere ? (
          <Button size="sm" className="ah-device-btn" disabled={running} onClick={() => void healthSyncNow(qc, 'manual', true)}>
            {running ? 'Syncing' : 'Sync'}
          </Button>
        ) : (
          <Button size="sm" className="ah-device-btn" onClick={openConnect}>
            Connect
          </Button>
        )}
      </div>
      {s?.connected && saved ? <CardRow icon={Database} title="Saved to your Logbook account" sub={saved.sub} value={saved.since ?? undefined} /> : null}
      {connectedHere && (device.data?.pending ?? 0) > 0 && sync.phase !== 'running' ? <CardRow icon={CloudUpload} title={`${device.data!.pending} upload${device.data!.pending === 1 ? '' : 's'} waiting`} sub="Saved on this phone. They send when Logbook is back online." /> : null}
      {connectedHere && (device.data?.deadLetter ?? 0) > 0 ? <CardRow icon={TriangleAlert} tone="orange" title={`${device.data!.deadLetter} upload${device.data!.deadLetter === 1 ? '' : 's'} not saved`} sub="Logbook couldn’t save them. The rest keep syncing." /> : null}
      {!web && !unavailable && (connectedHere || (access.data && !access.data.needed)) ? <CardRow icon={Activity} title="Reading check" sub="Last night and your heart numbers, read live" onPress={openCheck} /> : null}
      {/* offered whenever the account holds a connection, also when this phone (or the web) is not the one sending: the
          readings on the server are the person's to delete from anywhere */}
      {s?.connected ? (
        <Pressable className="ah-disconnect" press="dim" onPress={() => sheet.open({ title: 'Disconnect Apple Health?', body: <DisconnectPanel /> })} label="Disconnect Apple Health">
          Disconnect Apple Health
        </Pressable>
      ) : null}
    </SCard>
  );
};

/**
 * Connecting: the illustrated hero, the three things Logbook reads and where they are kept, then Apple's own sheet. With
 * access asked, the phone is connected to the account and the first import starts.
 */
const ConnectPanel = (): React.JSX.Element => {
  const sheet = useSheet();
  const qc = useQueryClient();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const connect = async () => {
    if (!Health) return;
    setBusy(true);
    try {
      await Health.requestAuthorization();
      await qc.invalidateQueries({ queryKey: accessKey });
      const r = await api<{ token: string; deviceId?: string }>('/apple-health/connect', { method: 'POST', json: { deviceName: 'iPhone', historyDays: HEALTH_HISTORY_DAYS } });
      await Health.connect({ token: r.token, apiOrigin, historyDays: HEALTH_HISTORY_DAYS });
      rememberHealthDevice(r.deviceId);
      await Promise.all([qc.invalidateQueries({ queryKey: deviceKey }), qc.invalidateQueries({ queryKey: healthStatusKey })]);
      void healthSyncNow(qc, 'import', true);
      haptics.success();
      sheet.push({ title: 'Apple Health', body: <ImportPanel /> });
    } catch (e) {
      haptics.error();
      toast(e instanceof Error && e.message ? e.message : 'Couldn’t connect Apple Health. Try again.');
    } finally {
      setBusy(false);
    }
  };
  const icons = [Moon, HeartPulse, Heart] as const;
  const tones = ['navy', 'orange', 'columbia'] as const;
  return (
    <div className="ahc">
      <HealthHero />
      <h3 className="ahc-title">Your sleep and your heart, beside your training.</h3>
      <p className="ahc-sub">Logbook reads three things from Apple Health and shows them on Progress.</p>
      <ul className="card ahc-unlocks">
        {HEALTH_READS.map(([title, sub], i) => (
          <li key={title}>
            <GlassTile icon={icons[i]!} tone={tones[i]} size={38} />
            <span>
              <b>{title}</b>
              <span>{sub}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="ahc-note">Readings are saved to your Logbook account on Logbook’s server, so Progress can show them. Logbook reads as much history as you share, up to a year, then keeps up each time you open it.</p>
      {/* pinned to the sheet's foot, so Connect is on screen at 667 pt tall without a scroll (ios-21) */}
      <div className="ahc-actions sheet-foot">
        <Button variant="primary" block onClick={() => void connect()} disabled={busy}>
          {busy ? 'Connecting…' : 'Connect Apple Health'}
        </Button>
        <Button variant="quiet" block onClick={() => sheet.close()}>
          Not now
        </Button>
      </div>
      <p className="ahc-trust">
        <ShieldCheck size={15} aria-hidden="true" />
        <span>{HEALTH_TRUST} Apple asks next what to share. You can change it any time in the Apple Health app.</span>
      </p>
      <p className="ahc-links">
        <button type="button" className="ahc-link" onClick={() => void openExternal(LEGAL.privacy)}>
          Privacy Policy
        </button>
        <button type="button" className="ahc-link" onClick={() => void openExternal(LEGAL.healthPrivacy)}>
          Consumer health data privacy policy
        </button>
      </p>
      <p className="ahc-fine">{DISCLAIMER}</p>
    </div>
  );
};

/** The first import: Apple Health read a month at a time, newest first, with the month on screen. */
const ImportPanel = (): React.JSX.Element => {
  const sheet = useSheet();
  const sync = useHealthSync();
  const month = monthOf(sync.detail);
  const done = sync.phase === 'done' || sync.phase === 'error';
  // the span the account now holds (asked again once the import is done), for the done line
  const qc = useQueryClient();
  const server = useHealthServerStatus();
  useEffect(() => {
    if (sync.phase === 'done') void qc.invalidateQueries({ queryKey: healthStatusKey });
  }, [sync.phase, qc]);
  const since = server.data ? savedWords(server.data).since : null;
  const now = new Date();
  const monthsBack = month ? (now.getFullYear() - month.getFullYear()) * 12 + now.getMonth() - month.getMonth() : 0;
  const pct = done ? 100 : Math.min(96, Math.round(((monthsBack + 0.5) / 12) * 100));
  return (
    <div className="ahc ahi">
      <div className="ahi-dial">
        <BevelDial value={pct} tone="night" size={148} label="Import" />
      </div>
      <h3 className="ahc-title" aria-live="polite">
        {done ? (sync.phase === 'error' ? 'Paused for now.' : 'Apple Health is connected.') : importWords(month)}
      </h3>
      <p className="ahc-sub">
        {done
          ? sync.phase === 'error'
            ? `${syncErrorWords(sync.detail) ?? 'Something stopped the import.'} It picks up where it left off next time.`
            : importDoneWords(since)
          : 'The newest months come first. You can leave this open or close it.'}
      </p>
      <div className="ahc-actions">
        <Button variant={done ? 'primary' : 'default'} block onClick={() => sheet.close()}>
          {done ? 'Done' : 'Keep reading in the background'}
        </Button>
      </div>
    </div>
  );
};

/** Disconnect: stop on this phone first (nothing in flight brings readings back), then delete the server's copy. */
const DisconnectPanel = (): React.JSX.Element => {
  const sheet = useSheet();
  const qc = useQueryClient();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true);
    try {
      await Health?.disconnect();
      await api('/apple-health', { method: 'DELETE' });
      rememberHealthDevice(null);
      await Promise.all([qc.invalidateQueries({ queryKey: healthStatusKey }), qc.invalidateQueries({ queryKey: deviceKey })]);
      haptics.delete();
      sheet.close();
      toast('Apple Health disconnected.');
    } catch {
      haptics.error();
      toast('Couldn’t disconnect. Try again.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="ahc">
      <p className="ahc-sub ahd-lede">Logbook stops reading Apple Health and deletes everything it read from your Logbook account. Nothing in Apple Health changes.</p>
      <p className="ahc-fine ahd-path">Logbook’s access stays until you remove it. {HEALTH_REVOKE_PATH}</p>
      <div className="ahc-actions">
        <Button variant="danger" block onClick={() => void go()} disabled={busy}>
          {busy ? 'Disconnecting…' : 'Disconnect and delete'}
        </Button>
        <Button variant="quiet" block onClick={() => sheet.close()}>
          Keep it connected
        </Button>
      </div>
    </div>
  );
};

// ---------- the reading check ----------
const clock = (iso: string) => new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(new Date(iso));
const when = (iso: string) => {
  const d = new Date(iso);
  if (d.toDateString() === new Date().toDateString()) return clock(iso);
  if (d.toDateString() === new Date(Date.now() - 86_400_000).toDateString()) return `Yesterday ${clock(iso)}`;
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(d);
};
const problem = (error: string | undefined) => (error === 'locked' ? 'Unlock your iPhone, then read again.' : error ? `Couldn’t read it: ${error}` : null);
const NO_DATA = `Nothing from Apple Health. If you expected some, check what Logbook may read. ${HEALTH_REVOKE_PATH}`;

/** Last night on a night-navy card, as Bevel shows its primary sleep: the source, the hypnogram, the stage tiles. */
const NightCard = ({ check }: { check: ReadingCheck }) => {
  const n = summarizeNight(check.sleep ?? []);
  if (!n)
    return (
      <section className="hd-night is-empty" aria-label="Last night">
        <h3 className="hd-night-title">Last night</h3>
        <p className="ahr-night-empty">{problem(check.sleepError) ?? NO_DATA}</p>
      </section>
    );
  const segs = (check.sleep ?? []).filter((s) => s.source === n.source);
  const total = n.asleepSec + n.stages.awake;
  const tiles: Array<[string, string, number]> = n.staged
    ? [
        ['awake', 'Awake', n.stages.awake],
        ['rem', 'REM', n.stages.rem],
        ['core', 'Core', n.stages.core],
        ['deep', 'Deep', n.stages.deep],
      ]
    : [
        ['asleep', 'Asleep', n.stages.asleep],
        ['awake', 'Awake', n.stages.awake],
      ];
  return (
    <section className="hd-night" aria-label="Last night">
      <div className="hd-night-top">
        <h3 className="hd-night-title">Last night</h3>
        <span className="hd-night-total">
          {hm(n.asleepSec)}
          <small>asleep</small>
        </span>
      </div>
      <SourceLine source={n.source} />
      <Hypnogram segments={segs} start={n.start} end={n.end} />
      <div className="hd-night-chips">
        <TimeChip at={n.start} />
        <TimeChip at={n.end} end />
      </div>
      <div className="hd-stages">
        {tiles.map(([stage, label, sec]) => (
          <StageTile key={stage} stage={stage} label={label} sec={sec} total={total} />
        ))}
      </div>
      {n.staged ? null : <p className="ahr-night-empty">This night has no stage detail (an older watch, or a phone).</p>}
    </section>
  );
};

/** Apple Health read live on the phone, saved nowhere by this sheet, to hold up against the Apple Health app. */
export const ReadingCheckPanel = (): React.JSX.Element => {
  const check = useQuery({ queryKey: ['health', 'check'], queryFn: () => Health!.readingCheck(), enabled: !!Health, staleTime: 0, gcTime: 0 });
  const c = check.data;
  const foot = (r?: { at: string }, err?: string) => (r ? when(r.at) : (problem(err) ?? undefined));
  return (
    <div className="ahr">
      {check.isPending ? (
        <div className="ahr-wait">
          <BevelDial value={null} tone="night" size={84} label="Reading" />
          <p>Reading Apple Health…</p>
        </div>
      ) : null}
      {check.isError ? <p className="ahr-note">Couldn’t read Apple Health. Try again.</p> : null}
      {c ? (
        <>
          <NightCard check={c} />
          <div className="ahr-head">
            <h3>Your numbers</h3>
          </div>
          <div className="ahr-tiles">
            <MonitorTile plain icon={HeartPulse} label="HRV" value={c.hrv ? c.hrv.value.toFixed(0) : null} unit="ms" foot={foot(c.hrv, c.hrvError)} />
            <MonitorTile plain icon={Heart} label="Resting HR" value={c.restingHr ? c.restingHr.value.toFixed(0) : null} unit="bpm" foot={foot(c.restingHr, c.restingHrError)} />
          </div>
          <p className="ahr-note">Read just now from Apple Health on this iPhone. They should match the Apple Health app.</p>
        </>
      ) : null}
      <Button block onClick={() => void check.refetch()} disabled={check.isFetching}>
        <RefreshCw size={16} aria-hidden="true" /> {check.isFetching ? 'Reading…' : 'Read again'}
      </Button>
    </div>
  );
};
