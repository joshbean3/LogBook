import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Activity, Check, ChevronRight, CloudUpload, Database, Footprints, HeartPulse, Minus, Moon, Plus, RefreshCw, ShieldCheck, Sparkles, Stethoscope, TriangleAlert, Wind, X } from 'lucide-react';
import { HEALTH_HISTORY_DAYS, type HealthStatus } from '@logbook/shared';
import { api } from '@/api/client';
import { healthStatusKey, healthSyncNow, syncErrorWords, useHealthSync } from '@/lib/healthSync';
import { apiOrigin } from '@/lib/native';
import { useState } from 'react';
import type * as React from 'react';
import { useConsent, useSaveConsent } from '@/features/auth/consent';
import { BevelDial, ConsentHero, GlassTile, HealthHero, Hypnogram, MonitorTile, SourceLine, StageTile, TimeChip } from '@/features/health/HealthParts';
import { haptics } from '@/lib/haptics';
import { Health, healthMode, hm, summarizeNight, type ReadingCheck } from '@/lib/health';
import { Button, Pressable, useSheet, useToast } from '@/ui';
import { SCard } from './parts';
import './appleHealth.css';

/**
 * Apple Health in Settings › Data sources (docs/health/apple-health.md, phase 1), drawn the way Bevel draws its health
 * screens: the source as a device card, connecting as an illustrated sheet, the reading check as last night on a
 * night-navy card with its hypnogram and a Health Monitor of tiles, and the coach's permission with its own hero.
 * Connected, the engine (packages/capacitor-health HealthSync.swift) keeps your Logbook in step with Apple Health.
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

const consentWord = (h: boolean | null | undefined) => (h === true ? 'On' : h === false ? 'Off' : 'Not asked');
const goalWords = (min: number) => `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, '0')}m`;
const agoWords = (iso: string | null | undefined) => {
  if (!iso) return null;
  const m = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60_000));
  return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 24 * 60 ? `${Math.round(m / 60)} h ago` : new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(iso));
};
const monthOf = (detail?: string) => {
  const t = detail ? Date.parse(detail) : NaN;
  return Number.isNaN(t) ? null : new Date(t);
};

/** The account's Apple Health connection on the server: what has arrived, the sleep goal, the devices. */
export const useHealthServerStatus = () => useQuery({ queryKey: healthStatusKey, queryFn: () => api<HealthStatus>('/apple-health/status'), staleTime: 30_000 });
/** This phone's engine: connected here, waiting uploads, still importing. */
const deviceKey = ['health', 'device'] as const;
const useHealthDevice = () => useQuery({ queryKey: deviceKey, queryFn: () => (Health ? Health.status() : Promise.resolve(null)), enabled: !!Health, staleTime: 5_000 });

/** A row inside the device card: icon tile, words, value, chevron. */
const CardRow = ({ icon: Icon, title, sub, value, onPress, tone }: { icon: typeof Moon; title: string; sub?: string; value?: string; onPress?: () => void; tone?: 'orange' }) => {
  const inner = (
    <>
      <span className={`ah-coach-ic ${tone === 'orange' ? '' : 'is-navy'}`} aria-hidden="true">
        <Icon size={16} strokeWidth={2.2} />
      </span>
      <span className="ah-coach-text">
        <span className="ah-coach-title">{title}</span>
        {sub ? <span className="ah-coach-sub">{sub}</span> : null}
      </span>
      {value ? <span className="ah-coach-value">{value}</span> : null}
      {onPress ? <ChevronRight size={18} className="ah-chev" aria-hidden="true" /> : null}
    </>
  );
  return onPress ? (
    <Pressable className="ah-coach" press="dim" onPress={onPress} label={`${title}${value ? `: ${value}` : ''}`}>
      {inner}
    </Pressable>
  ) : (
    <div className="ah-coach">{inner}</div>
  );
};

/**
 * The Apple Health section of Data sources: the source as a device card (as Bevel shows a connected source). Before
 * connecting: Connect. Connected on this phone: when it last synced (or the month being imported), Sync, what has arrived,
 * the sleep goal, the reading check, Coach access, and Disconnect under the card.
 */
export const AppleHealthGroup = (): React.JSX.Element => {
  const sheet = useSheet();
  const qc = useQueryClient();
  const access = useHealthAccess();
  const consent = useConsent();
  const server = useHealthServerStatus();
  const device = useHealthDevice();
  const sync = useHealthSync();
  const openConsent = () => sheet.open({ title: 'Coach access', body: <HealthConsentPanel /> });
  const openConnect = () => sheet.open({ title: 'Apple Health', body: <ConnectPanel /> });
  const openCheck = () => sheet.open({ title: 'Reading check', detent: 'large', body: <ReadingCheckPanel /> });
  const openGoal = (min: number) => sheet.open({ title: 'Sleep goal', body: <SleepGoalPanel initial={min} onDone={() => sheet.close()} /> });
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
  else if (connectedHere && sync.phase === 'importing') status = `Reading history${importMonth ? ` · ${importMonth.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}` : '…'}`;
  else if (connectedHere && running) status = 'Syncing…';
  else if (connectedHere && sync.phase === 'error') status = syncErrorWords(sync.detail);
  else if (connectedHere) status = agoWords(s?.lastSyncAt ?? device.data?.lastSyncAt) ? `Synced ${agoWords(s?.lastSyncAt ?? device.data?.lastSyncAt)}` : 'Not synced yet';
  else status = 'Sleep, heart, HRV and workouts';

  const total = s ? Object.values(s.counts.samples).reduce((a, b) => a + b, 0) : 0;
  const imported = s?.span.from ? `Since ${new Date(`${s.span.from}T12:00:00`).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}` : 'Nothing yet';
  const importedSub = s && (s.counts.days || total || s.counts.workouts) ? `${s.counts.days.toLocaleString('en-US')} days of activity · ${total.toLocaleString('en-US')} readings · ${s.counts.workouts} workouts` : 'It arrives a month at a time, newest first';

  return (
    <SCard
      title="Apple Health"
      className="ah-sec"
      foot={connectedHere ? 'Syncs when you open Logbook and when you pull down on Today. Logbook only reads; it never writes to Apple Health.' : 'Logbook only reads. It never writes to Apple Health, and never sells or shares what it reads.'}
    >
      <div className="ah-device">
        <span className="ah-app" aria-hidden="true">
          <HeartPulse size={24} strokeWidth={2.2} />
        </span>
        <span className="ah-device-text">
          <span className="ah-device-name">Apple Health</span>
          <span className={`ah-device-status ${connectedHere || connectedElsewhere ? 'is-on' : ''} ${running ? 'is-running' : ''}`}>
            {connectedHere || connectedElsewhere ? <i aria-hidden="true" /> : null}
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
      {s?.connected ? <CardRow icon={Database} title="In your Logbook" sub={importedSub} value={imported} /> : null}
      {s?.connected ? <CardRow icon={Moon} title="Sleep goal" sub="What your sleep score measures against" value={goalWords(s.sleepGoalMin ?? 450)} onPress={() => openGoal(s.sleepGoalMin ?? 450)} /> : null}
      {connectedHere && (device.data?.pending ?? 0) > 0 && sync.phase !== 'running' ? <CardRow icon={CloudUpload} title={`${device.data!.pending} upload${device.data!.pending === 1 ? '' : 's'} waiting`} sub="Saved on this phone; they send when Logbook can reach the server." /> : null}
      {connectedHere && (device.data?.deadLetter ?? 0) > 0 ? <CardRow icon={TriangleAlert} tone="orange" title={`${device.data!.deadLetter} upload${device.data!.deadLetter === 1 ? '' : 's'} refused`} sub="The server couldn’t take them. The rest keep syncing." /> : null}
      {!web && !unavailable && (connectedHere || (access.data && !access.data.needed)) ? <CardRow icon={Stethoscope} title="Reading check" sub="Last night and your vitals, read live" onPress={openCheck} /> : null}
      {web || unavailable ? null : <CardRow icon={Sparkles} tone="orange" title="Coach access" sub="A short health summary, only when you ask" value={consentWord(consent.data?.health)} onPress={openConsent} />}
      {connectedHere ? (
        <Pressable className="ah-disconnect" press="dim" onPress={() => sheet.open({ title: 'Disconnect Apple Health?', body: <DisconnectPanel /> })} label="Disconnect Apple Health">
          Disconnect Apple Health
        </Pressable>
      ) : null}
    </SCard>
  );
};

/** Connecting: the illustrated hero, what it unlocks, Apple's sheet; then the sleep goal; then the import. */
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
      haptics.success();
      await qc.invalidateQueries({ queryKey: accessKey });
      sheet.push({ title: 'Sleep goal', body: <SleepGoalPanel initial={450} connecting onDone={() => sheet.push({ title: 'Apple Health', body: <ImportPanel /> })} /> });
    } catch (e) {
      haptics.error();
      toast(e instanceof Error && e.message ? e.message : 'Couldn’t open Apple Health. Try again.');
    } finally {
      setBusy(false);
    }
  };
  const unlocks: Array<[typeof Moon, 'navy' | 'orange' | 'columbia', string, string]> = [
    [Moon, 'navy', 'Last night', 'Your sleep with its stages, and what you need tonight'],
    [HeartPulse, 'orange', 'Your heart', 'HRV and resting heart rate, against your own normal'],
    [Activity, 'columbia', 'Your training', 'Workouts with their heart rate, and the strain they add'],
    [Footprints, 'navy', 'Your day', 'Steps and movement, hour by hour'],
  ];
  return (
    <div className="ahc">
      <HealthHero />
      <h3 className="ahc-title">Your night, your heart and your training, read together.</h3>
      <p className="ahc-sub">Logbook reads a year of Apple Health, then keeps up each time you open it, to show your recovery, strain and sleep against your own normal.</p>
      <ul className="card ahc-unlocks">
        {unlocks.map(([Icon, tone, title, sub]) => (
          <li key={title}>
            <GlassTile icon={Icon} tone={tone} size={38} />
            <span>
              <b>{title}</b>
              <span>{sub}</span>
            </span>
          </li>
        ))}
      </ul>
      <div className="ahc-actions">
        <Button variant="primary" block onClick={() => void connect()} disabled={busy}>
          {busy ? 'Opening Apple Health…' : 'Connect Apple Health'}
        </Button>
        <Button variant="quiet" block onClick={() => sheet.close()}>
          Not now
        </Button>
      </div>
      <p className="ahc-trust">
        <ShieldCheck size={15} aria-hidden="true" />
        <span>
          <b>Read only.</b> Never written to, never sold. Apple asks next which data to share; change it any time in the Health app.
        </span>
      </p>
    </div>
  );
};

/**
 * The sleep goal (decided: asked during connect), as Bevel sets one by hand: a big time between round minus and plus, in
 * quarter hours from 4 to 12 hours. Connecting, Continue saves it with the connection and starts the import.
 */
const SleepGoalPanel = ({ initial, connecting, onDone }: { initial: number; connecting?: boolean; onDone: () => void }): React.JSX.Element => {
  const qc = useQueryClient();
  const toast = useToast();
  const [min, setMin] = useState(initial);
  const [busy, setBusy] = useState(false);
  const step = (d: number) => {
    haptics.select();
    setMin((m) => Math.max(240, Math.min(720, m + d)));
  };
  const go = async () => {
    setBusy(true);
    try {
      if (connecting) {
        const r = await api<{ token: string }>('/apple-health/connect', { method: 'POST', json: { deviceName: 'iPhone', historyDays: HEALTH_HISTORY_DAYS, sleepGoalMin: min } });
        await Health!.connect({ token: r.token, apiOrigin, historyDays: HEALTH_HISTORY_DAYS });
        await qc.invalidateQueries({ queryKey: deviceKey });
        void healthSyncNow(qc, 'import', true);
      } else {
        await api('/apple-health/sleep-goal', { method: 'PUT', json: { sleepGoalMin: min } });
      }
      await qc.invalidateQueries({ queryKey: healthStatusKey });
      haptics.success();
      onDone();
    } catch (e) {
      haptics.error();
      toast(e instanceof Error && e.message ? e.message : 'Couldn’t save that. Try again.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="ahc">
      <h3 className="ahc-title">How much sleep do you want?</h3>
      <p className="ahc-sub">Time asleep, not time in bed. Your sleep score and tonight’s sleep need start from it. Most adults do best on 7 to 9 hours.</p>
      <div className="card ahg-card">
        <button type="button" className="ahg-step" aria-label="Fifteen minutes less" onClick={() => step(-15)} disabled={min <= 240}>
          <Minus size={20} strokeWidth={2.4} />
        </button>
        <span className="ahg-time" aria-live="polite">
          <b className="tnum">
            {Math.floor(min / 60)}:{String(min % 60).padStart(2, '0')}
          </b>
          <small>asleep</small>
        </span>
        <button type="button" className="ahg-step" aria-label="Fifteen minutes more" onClick={() => step(15)} disabled={min >= 720}>
          <Plus size={20} strokeWidth={2.4} />
        </button>
      </div>
      <div className="ahc-actions">
        <Button variant="primary" block onClick={() => void go()} disabled={busy}>
          {busy ? 'Saving…' : connecting ? 'Continue' : 'Save'}
        </Button>
      </div>
      {connecting ? (
        <p className="ahc-trust">
          <Moon size={15} aria-hidden="true" />
          <span>You can change it any time in Settings › Data sources.</span>
        </p>
      ) : null}
    </div>
  );
};

/** The first import: a year of Apple Health read a month at a time, newest first, with the month on screen. */
const ImportPanel = (): React.JSX.Element => {
  const sheet = useSheet();
  const sync = useHealthSync();
  const server = useHealthServerStatus();
  const month = monthOf(sync.detail);
  const done = sync.phase === 'done' || sync.phase === 'error';
  const now = new Date();
  const monthsBack = month ? (now.getFullYear() - month.getFullYear()) * 12 + now.getMonth() - month.getMonth() : 0;
  const pct = done ? 100 : Math.min(96, Math.round(((monthsBack + 0.5) / 12) * 100));
  const s = server.data;
  return (
    <div className="ahc ahi">
      <div className="ahi-dial">
        <BevelDial value={pct} tone="sleep" size={148} label="Import" />
      </div>
      <h3 className="ahc-title">{done ? (sync.phase === 'error' ? 'Paused for now.' : 'Your year is in.') : 'Reading your year…'}</h3>
      <p className="ahc-sub">
        {done
          ? sync.phase === 'error'
            ? `${syncErrorWords(sync.detail) ?? 'Something stopped the import.'} It picks up where it left off next time.`
            : 'Logbook keeps up from here, each time you open it. Your normal ranges appear after 14 nights.'
          : month
            ? `Now reading ${month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}. Recent months come first, so Today fills in right away.`
            : 'Starting with the newest month, so Today fills in right away.'}
      </p>
      {done && s && (s.counts.days || s.counts.workouts) ? (
        <div className="card ahi-counts">
          <span>
            <b className="tnum">{s.counts.days.toLocaleString('en-US')}</b> days
          </span>
          <span>
            <b className="tnum">{Object.values(s.counts.samples).reduce((a, b) => a + b, 0).toLocaleString('en-US')}</b> readings
          </span>
          <span>
            <b className="tnum">{s.counts.workouts}</b> workouts
          </span>
        </div>
      ) : null}
      <div className="ahc-actions">
        <Button variant={done ? 'primary' : 'default'} block onClick={() => sheet.close()}>
          {done ? 'Done' : 'Keep reading in the background'}
        </Button>
      </div>
    </div>
  );
};

/** Disconnect: stop on this phone first (nothing in flight brings data back), then delete the server's copy. */
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
      await Promise.all([qc.invalidateQueries({ queryKey: healthStatusKey }), qc.invalidateQueries({ queryKey: deviceKey })]);
      haptics.delete();
      sheet.close();
      toast('Apple Health disconnected. To remove access too: Settings › Health › Data Access & Devices › Logbook.');
    } catch {
      haptics.error();
      toast('Couldn’t disconnect. Try again.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="ahc">
      <p className="ahc-sub ahd-lede">Logbook stops reading Apple Health and deletes everything it read from your Logbook. Your Apple Health data itself is untouched.</p>
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
const NO_DATA = 'No data from Apple Health. If you expected some, check Settings › Health › Data Access & Devices › Logbook.';

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

/** The phase 1 proof: Apple Health read live on the phone, saved nowhere, to hold up against the Health app. */
export const ReadingCheckPanel = (): React.JSX.Element => {
  const check = useQuery({ queryKey: ['health', 'check'], queryFn: () => Health!.readingCheck(), enabled: !!Health, staleTime: 0, gcTime: 0 });
  const c = check.data;
  const foot = (r?: { at: string }, err?: string) => (r ? when(r.at) : (problem(err) ?? undefined));
  return (
    <div className="ahr">
      {check.isPending ? (
        <div className="ahr-wait">
          <BevelDial value={null} tone="sleep" size={84} label="Reading" />
          <p>Reading Apple Health…</p>
        </div>
      ) : null}
      {check.isError ? <p className="ahr-note">Couldn’t read Apple Health. Try again.</p> : null}
      {c ? (
        <>
          <NightCard check={c} />
          <div className="ahr-head">
            <h3>Health Monitor</h3>
            <span>Learning your normal</span>
          </div>
          <div className="ahr-tiles">
            <MonitorTile icon={HeartPulse} label="HRV" value={c.hrv ? c.hrv.value.toFixed(0) : null} unit="ms" status="learning" foot={foot(c.hrv, c.hrvError)} />
            <MonitorTile icon={HeartPulse} label="Resting HR" value={c.restingHr ? c.restingHr.value.toFixed(0) : null} unit="bpm" status="learning" foot={foot(c.restingHr, c.restingHrError)} />
            <MonitorTile icon={Wind} label="Breathing" value={c.respiratoryRate ? c.respiratoryRate.value.toFixed(1) : null} unit="rpm" status="learning" foot={foot(c.respiratoryRate, c.respiratoryRateError)} />
            <MonitorTile icon={Footprints} label="Steps" value={c.stepsToday != null ? Math.round(c.stepsToday).toLocaleString('en-US') : null} status="learning" foot={c.stepsToday != null ? 'Today so far' : (problem(c.stepsError) ?? undefined)} />
          </div>
          <p className="ahr-note">Compare these with the Health app: they should match. Your normal ranges appear after 14 nights, once syncing starts.</p>
        </>
      ) : null}
      <Button block onClick={() => void check.refetch()} disabled={check.isFetching}>
        <RefreshCw size={16} aria-hidden="true" /> {check.isFetching ? 'Reading…' : 'Read again'}
      </Button>
    </div>
  );
};

/**
 * The coach's permission (App Review 5.1.2: say who the AI is and ask first). It names Anthropic, says what goes and what
 * never does, and is saved as `consent.health`. Nothing from Apple Health reaches the coach until it is on.
 */
export const HealthConsentPanel = (): React.JSX.Element => {
  const consent = useConsent();
  const save = useSaveConsent();
  const sheet = useSheet();
  const toast = useToast();
  const choose = (health: boolean) =>
    save.mutate(
      { training: consent.data?.training ?? true, health },
      {
        onSuccess: () => {
          haptics.select();
          sheet.close();
        },
        onError: () => {
          haptics.error();
          toast('Couldn’t save that. Try again.');
        },
      },
    );
  return (
    <div className="ahc">
      <ConsentHero />
      <h3 className="ahc-title">Let the coach read how you slept and recovered?</h3>
      <p className="ahc-sub">When you ask the coach something, Logbook can send Claude, made by Anthropic, a short summary of your health, so the answer fits the body you woke up in.</p>
      <section className="card ahc-list" aria-label="What goes">
        <h4>What goes</h4>
        <p>
          <i className="is-yes" aria-hidden="true">
            <Check size={12} strokeWidth={3} />
          </i>
          Your recovery, strain and sleep scores
        </p>
        <p>
          <i className="is-yes" aria-hidden="true">
            <Check size={12} strokeWidth={3} />
          </i>
          Last night’s sleep, and your vitals against your normal
        </p>
      </section>
      <section className="card ahc-list" aria-label="Never sent">
        <h4>Never sent</h4>
        <p>
          <i className="is-no" aria-hidden="true">
            <X size={12} strokeWidth={3} />
          </i>
          Raw samples, or your Apple Health export
        </p>
        <p>
          <i className="is-no" aria-hidden="true">
            <X size={12} strokeWidth={3} />
          </i>
          Workouts the Strava app writes to Apple Health
        </p>
        <p>
          <i className="is-no" aria-hidden="true">
            <X size={12} strokeWidth={3} />
          </i>
          Anything, when you haven’t asked
        </p>
      </section>
      <div className="ahc-actions">
        <Button variant="primary" block onClick={() => choose(true)} disabled={save.isPending}>
          Allow
        </Button>
        <Button variant="quiet" block onClick={() => choose(false)} disabled={save.isPending}>
          Don’t allow
        </Button>
      </div>
      <p className="ahc-trust">
        <ShieldCheck size={15} aria-hidden="true" />
        <span>Change it any time in Settings › Privacy.</span>
      </p>
    </div>
  );
};
