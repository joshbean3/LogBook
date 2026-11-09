import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Activity, Check, ChevronRight, Footprints, HeartPulse, Moon, RefreshCw, ShieldCheck, Sparkles, Wind, X } from 'lucide-react';
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
 * Syncing into the Logbook is phase 2; until then nothing read here is saved anywhere.
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

/** The Apple Health section of Data sources: a device card (as Bevel shows a connected source) and Coach access under it. */
export const AppleHealthGroup = (): React.JSX.Element => {
  const sheet = useSheet();
  const access = useHealthAccess();
  const consent = useConsent();
  const openConsent = () => sheet.open({ title: 'Coach access', body: <HealthConsentPanel /> });
  const openConnect = () => sheet.open({ title: 'Apple Health', body: <ConnectPanel /> });
  const openCheck = () => sheet.open({ title: 'Reading check', detent: 'large', body: <ReadingCheckPanel /> });
  const web = healthMode === 'web';
  const unavailable = !web && access.data && !access.data.available;
  const asked = !web && !!access.data && !access.data.needed && !unavailable;
  const status = web ? 'Connects from the Logbook app on your iPhone' : unavailable ? 'Not available on this device' : asked ? 'Access asked · reading only for now' : 'Sleep, heart, HRV and workouts';
  return (
    <SCard title="Apple Health" className="ah-sec" foot={asked ? 'Syncing into your Logbook comes next. Until then, the reading check reads live and saves nothing.' : 'Logbook only reads. It never writes to Apple Health, and never sells or shares what it reads.'}>
      <div className="ah-device">
        <span className="ah-app" aria-hidden="true">
          <HeartPulse size={24} strokeWidth={2.2} />
        </span>
        <span className="ah-device-text">
          <span className="ah-device-name">Apple Health</span>
          <span className={`ah-device-status ${asked ? 'is-on' : ''}`}>
            {asked ? <i aria-hidden="true" /> : null}
            {status}
          </span>
        </span>
        {web || unavailable ? null : (
          <Button size="sm" className="ah-device-btn" onClick={asked ? openCheck : openConnect}>
            {asked ? 'Check' : 'Connect'}
          </Button>
        )}
      </div>
      {web || unavailable ? null : (
        <Pressable className="ah-coach" press="dim" onPress={openConsent} label={`Coach access: ${consentWord(consent.data?.health)}`}>
          <span className="ah-coach-ic" aria-hidden="true">
            <Sparkles size={16} strokeWidth={2.2} />
          </span>
          <span className="ah-coach-text">
            <span className="ah-coach-title">Coach access</span>
            <span className="ah-coach-sub">A short health summary, only when you ask</span>
          </span>
          <span className={`ah-coach-value is-${consent.data?.health === true ? 'on' : consent.data?.health === false ? 'off' : 'unset'}`}>{consentWord(consent.data?.health)}</span>
          <ChevronRight size={18} className="ah-chev" aria-hidden="true" />
        </Pressable>
      )}
    </SCard>
  );
};

/** Connecting: the illustrated hero, what it unlocks, Apple's sheet, then the reading check. */
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
      sheet.push({ title: 'Reading check', body: <ReadingCheckPanel /> });
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
      <p className="ahc-sub">Logbook reads Apple Health each morning to show your recovery, strain and sleep against your own normal.</p>
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
