import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, HeartPulse, RefreshCw, Sparkles, Stethoscope, X } from 'lucide-react';
import { useState } from 'react';
import type * as React from 'react';
import { useConsent, useSaveConsent } from '@/features/auth/consent';
import { haptics } from '@/lib/haptics';
import { Health, healthMode, hm, summarizeNight, type HealthReading, type ReadingCheck } from '@/lib/health';
import { Button, Row, useSheet, useToast } from '@/ui';
import { GoRow, SGroup, Tile } from './parts';
import '@/features/auth/privacy.css';
import './appleHealth.css';

/**
 * Apple Health in Settings › Data sources (docs/health/apple-health.md, phase 1): connect (Apple's permission sheet, once),
 * check the reading against the Health app, and the coach's permission to read a health summary. Syncing into the
 * Logbook is phase 2; until then nothing read here is saved anywhere.
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

/** The Apple Health section of Data sources. */
export const AppleHealthGroup = (): React.JSX.Element => {
  const sheet = useSheet();
  const access = useHealthAccess();
  const consent = useConsent();
  const openConsent = () => sheet.open({ eyebrow: 'Privacy', title: 'Let the coach read your health?', body: <HealthConsentPanel /> });
  if (healthMode === 'web')
    return (
      <SGroup title="Apple Health" foot="Apple Health lives on your iPhone, so it connects from the Logbook app there.">
        <Row className="s-wrap has-tile ds-soon" left={<Tile icon={HeartPulse} tone="muted" />} title="Apple Health" sub="Open Logbook on your iPhone to connect." />
      </SGroup>
    );
  if (access.data && !access.data.available)
    return (
      <SGroup title="Apple Health">
        <Row className="s-wrap has-tile ds-soon" left={<Tile icon={HeartPulse} tone="muted" />} title="Apple Health" sub="Apple Health isn’t available on this device." />
      </SGroup>
    );
  const asked = !!access.data && !access.data.needed;
  return (
    <SGroup title="Apple Health" foot={asked ? 'Reading only for now. Syncing it into your Logbook comes next.' : 'Sleep, heart rate, HRV and workouts. Logbook only reads; it never writes to Apple Health.'}>
      {asked ? (
        <>
          <Row
            className="s-wrap has-tile"
            left={<Tile icon={HeartPulse} />}
            title="Apple Health"
            sub="Access asked. Check that the reading matches the Health app."
            right={
              <span className="ds-ok">
                <Check size={16} strokeWidth={2.6} aria-hidden="true" />
                Set up
              </span>
            }
          />
          <GoRow icon={Stethoscope} title="Check the reading" sub="Last night, HRV, resting heart rate, steps" onPress={() => sheet.open({ eyebrow: 'Apple Health', title: 'Reading check', body: <ReadingCheckPanel /> })} />
        </>
      ) : (
        <GoRow icon={HeartPulse} title="Connect Apple Health" sub="Sleep, heart rate, HRV and workouts, read only." onPress={() => sheet.open({ eyebrow: 'Apple Health', title: 'Connect Apple Health', body: <ConnectPanel /> })} />
      )}
      <GoRow icon={Sparkles} title="Coach access" sub="A short health summary, only when you ask." value={consentWord(consent.data?.health)} onPress={openConsent} />
    </SGroup>
  );
};

/** What connecting unlocks, that it only reads, then Apple's sheet; after it, the reading check. */
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
  return (
    <div className="cx">
      <p className="cx-lede">Logbook reads your sleep, heart rate, HRV and workouts to show your recovery, strain and sleep against your own normal.</p>
      <ul className="card ah-unlocks">
        <li>Last night’s sleep, with its stages</li>
        <li>HRV and resting heart rate, against your normal</li>
        <li>Workouts with their heart rate</li>
        <li>Steps and activity through the day</li>
      </ul>
      <p className="ah-note">Read only: Logbook never writes to Apple Health. Apple asks you next which data to share, and you can change it any time in the Health app.</p>
      <Button variant="primary" block onClick={() => void connect()} disabled={busy}>
        {busy ? 'Opening Apple Health…' : 'Connect Apple Health'}
      </Button>
    </div>
  );
};

// ---------- the reading check: raw values to hold up against the Health app ----------
const clock = (iso: string) => new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(new Date(iso));
const when = (iso: string) => {
  const d = new Date(iso);
  const today = new Date();
  const yest = new Date(Date.now() - 86_400_000);
  if (d.toDateString() === today.toDateString()) return clock(iso);
  if (d.toDateString() === yest.toDateString()) return `Yesterday ${clock(iso)}`;
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(d);
};
const NO_DATA = 'No data from Apple Health. If you expected some, check Settings › Health › Data Access & Devices › Logbook.';
const problem = (error: string | undefined) => (error === 'locked' ? 'Unlock your iPhone, then read again.' : error ? `Couldn’t read it: ${error}` : null);

const VitalTile = ({ label, r, unit, digits = 0, error }: { label: string; r?: HealthReading; unit: string; digits?: number; error?: string }) => (
  <div className="tile ah-tile">
    <span className="tile-label">{label}</span>
    {r ? (
      <>
        <span className="tile-value">
          {r.value.toFixed(digits)} <small>{unit}</small>
        </span>
        <span className="ah-tile-foot">
          {when(r.at)} · {r.source}
        </span>
      </>
    ) : (
      <>
        <span className="tile-value is-none">–</span>
        <span className="ah-tile-foot">{problem(error) ?? 'No data yet'}</span>
      </>
    )}
  </div>
);

const NightCard = ({ check }: { check: ReadingCheck }) => {
  const n = summarizeNight(check.sleep ?? []);
  const err = problem(check.sleepError);
  if (!n)
    return (
      <section className="card ah-night is-empty">
        <span className="tile-label">Last night</span>
        <p className="ah-empty">{err ?? NO_DATA}</p>
      </section>
    );
  const parts: Array<[string, number]> = n.staged
    ? [
        ['Core', n.stages.core],
        ['Deep', n.stages.deep],
        ['REM', n.stages.rem],
        ['Awake', n.stages.awake],
      ]
    : [
        ['Asleep', n.stages.asleep],
        ['Awake', n.stages.awake],
      ];
  return (
    <section className="card ah-night" aria-label="Last night">
      <span className="tile-label">Last night</span>
      <p className="ah-night-big">
        {hm(n.asleepSec)} <small>asleep</small>
      </p>
      <p className="ah-night-sub">
        {clock(n.start)} to {clock(n.end)} · {n.source}
      </p>
      <div className="ah-stages">
        {parts.map(([label, sec]) => (
          <span key={label} className="ah-stage">
            <span className="ah-stage-label">{label}</span>
            <span className="ah-stage-value tnum">{hm(sec)}</span>
          </span>
        ))}
      </div>
      {n.staged ? null : <p className="ah-night-foot">This night has no stage detail (an older watch, or a phone).</p>}
    </section>
  );
};

/** The phase 1 proof. Nothing here is saved: it reads Apple Health on the phone and shows it. */
export const ReadingCheckPanel = (): React.JSX.Element => {
  const check = useQuery({ queryKey: ['health', 'check'], queryFn: () => Health!.readingCheck(), enabled: !!Health, staleTime: 0, gcTime: 0 });
  const c = check.data;
  return (
    <div className="cx ah-check">
      {check.isPending ? <p className="ah-note">Reading Apple Health…</p> : null}
      {check.isError ? <p className="ah-note">Couldn’t read Apple Health. Try again.</p> : null}
      {c ? (
        <>
          <NightCard check={c} />
          <div className="tiles">
            <VitalTile label="HRV" r={c.hrv} unit="ms" error={c.hrvError} />
            <VitalTile label="Resting HR" r={c.restingHr} unit="bpm" error={c.restingHrError} />
            <VitalTile label="Respiratory rate" r={c.respiratoryRate} unit="/min" digits={1} error={c.respiratoryRateError} />
            <div className="tile ah-tile">
              <span className="tile-label">Steps today</span>
              {c.stepsToday != null ? (
                <span className="tile-value">{Math.round(c.stepsToday).toLocaleString('en-US')}</span>
              ) : (
                <>
                  <span className="tile-value is-none">–</span>
                  <span className="ah-tile-foot">{problem(c.stepsError) ?? 'No data yet'}</span>
                </>
              )}
            </div>
          </div>
          <p className="ah-note">Compare these with the Health app: they should match. Nothing is saved to your Logbook yet.</p>
        </>
      ) : null}
      <Button block onClick={() => void check.refetch()} disabled={check.isFetching}>
        <RefreshCw size={16} aria-hidden="true" /> {check.isFetching ? 'Reading…' : 'Read again'}
      </Button>
    </div>
  );
};

/**
 * The coach's permission to read a health summary (App Review 5.1.2: say who the AI is and ask first). It names
 * Anthropic, says what goes and what never does, and is saved as `consent.health`. Nothing from Apple Health reaches
 * the coach until it is on (phase 9 builds what it reads).
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
    <div className="cx">
      <p className="cx-lede">When you ask the coach something, Logbook can send Claude, made by Anthropic, a short summary of your health, so the answer fits how you slept and recovered.</p>
      <section className="card pv-list" aria-labelledby="ah-goes">
        <h2 id="ah-goes" className="pv-h">
          What goes
        </h2>
        <ul>
          <li>
            <Check size={16} strokeWidth={2.6} aria-hidden="true" />
            <span>Your recovery, strain and sleep scores.</span>
          </li>
          <li>
            <Check size={16} strokeWidth={2.6} aria-hidden="true" />
            <span>Last night’s sleep, and your HRV, resting heart rate and other vitals against your normal.</span>
          </li>
        </ul>
      </section>
      <section className="card pv-list never" aria-labelledby="ah-never">
        <h2 id="ah-never" className="pv-h">
          Never sent
        </h2>
        <ul>
          <li>
            <X size={16} strokeWidth={2.6} aria-hidden="true" />
            <span>Raw samples or your Apple Health export.</span>
          </li>
          <li>
            <X size={16} strokeWidth={2.6} aria-hidden="true" />
            <span>Workouts the Strava app writes to Apple Health.</span>
          </li>
          <li>
            <X size={16} strokeWidth={2.6} aria-hidden="true" />
            <span>Anything, when you haven’t asked the coach.</span>
          </li>
        </ul>
      </section>
      <p className="ah-note">You can change this any time in Settings › Privacy.</p>
      <div className="ah-choice">
        <Button variant="primary" block onClick={() => choose(true)} disabled={save.isPending}>
          Allow
        </Button>
        <Button variant="quiet" block onClick={() => choose(false)} disabled={save.isPending}>
          Don’t allow
        </Button>
      </div>
    </div>
  );
};
