import { registerPlugin } from '@capacitor/core';
import { isNative } from './native';

/**
 * Apple Health, through Logbook's own Capacitor plugin (packages/capacitor-health, docs/health/apple-health.md).
 *
 * Phase 1: ask for access once, and read a few things back raw so they can be checked against the Health app. Inside the
 * iPhone app this is the Swift plugin. In the browser there is no Apple Health: `healthMode` says so, and in development a
 * stand-in returns a fixed night so the screens can be built and looked at.
 */

export type SleepStage = 'in_bed' | 'asleep' | 'awake' | 'core' | 'deep' | 'rem' | 'unknown';
export interface SleepSegment {
  start: string;
  end: string;
  stage: SleepStage;
  /** The app or device that wrote it, as Health names it ("Josh's Apple Watch"). */
  source: string;
  bundle: string;
  /** The hardware ("Watch7,1", "iPhone17,2"); empty when Health does not say. */
  device: string;
}
export interface HealthReading {
  value: number;
  at: string;
  source: string;
  device: string;
}
export interface ReadingCheck {
  available: boolean;
  checkedAt?: string;
  sleep?: SleepSegment[];
  sleepError?: string;
  hrv?: HealthReading;
  hrvError?: string;
  restingHr?: HealthReading;
  restingHrError?: string;
  respiratoryRate?: HealthReading;
  respiratoryRateError?: string;
  stepsToday?: number;
  stepsError?: string;
}
export interface LogbookHealthPlugin {
  isAvailable(): Promise<{ available: boolean }>;
  /** Apple's permission sheet. Resolves whatever was chosen: Apple never says whether reading was allowed. */
  requestAuthorization(): Promise<{ asked: boolean }>;
  /** Whether Apple's sheet would still show (never asked, or types added since). */
  needsAuthorization(): Promise<{ needed: boolean }>;
  readingCheck(): Promise<ReadingCheck>;
}

// ---------- the stand-in (development in the browser only) ----------
const at = (hoursAgo: number) => new Date(Date.now() - hoursAgo * 3_600_000).toISOString();
const seg = (from: number, to: number, stage: SleepStage): SleepSegment => ({ start: at(from), end: at(to), stage, source: 'Josh’s Apple Watch', bundle: 'com.apple.health.watch', device: 'Watch7,1' });
let mockAsked = false;
export const healthMock: LogbookHealthPlugin = {
  isAvailable: async () => ({ available: true }),
  requestAuthorization: async () => {
    mockAsked = true;
    return { asked: true };
  },
  needsAuthorization: async () => ({ needed: !mockAsked }),
  readingCheck: async () => ({
    available: true,
    checkedAt: new Date().toISOString(),
    sleep: [seg(9, 8.6, 'core'), seg(8.6, 7.9, 'deep'), seg(7.9, 6.8, 'core'), seg(6.8, 6.7, 'awake'), seg(6.7, 5.5, 'rem'), seg(5.5, 3.6, 'core'), seg(3.6, 3, 'deep'), seg(3, 2.4, 'rem'), seg(2.4, 2.3, 'awake')],
    hrv: { value: 61.4, at: at(2.5), source: 'Josh’s Apple Watch', device: 'Watch7,1' },
    restingHr: { value: 52, at: at(1), source: 'Josh’s Apple Watch', device: 'Watch7,1' },
    respiratoryRate: { value: 14.8, at: at(3), source: 'Josh’s Apple Watch', device: 'Watch7,1' },
    stepsToday: 4212,
  }),
};

/** Where Apple Health can be reached from here: the iPhone app, the development stand-in, or nowhere (the web). */
export const healthMode: 'native' | 'mock' | 'web' = isNative ? 'native' : import.meta.env.DEV ? 'mock' : 'web';
export const Health: LogbookHealthPlugin | null = healthMode === 'native' ? registerPlugin<LogbookHealthPlugin>('LogbookHealth') : healthMode === 'mock' ? healthMock : null;

// ---------- last night, from raw segments ----------
const ASLEEP: SleepStage[] = ['asleep', 'core', 'deep', 'rem'];
const secs = (s: SleepSegment) => Math.max(0, (Date.parse(s.end) - Date.parse(s.start)) / 1000);

export interface NightSummary {
  source: string;
  /** Asleep, every stage but awake and in bed. */
  asleepSec: number;
  /** From the first segment to the last (for a Watch, which writes no in-bed samples, this is the span of its own). */
  spanSec: number;
  start: string;
  end: string;
  stages: Record<'core' | 'deep' | 'rem' | 'awake' | 'asleep', number>;
  /** True when the night has stage detail (core, deep, rem), not only "asleep". */
  staged: boolean;
}

/**
 * Last night from the raw segments, using one source (Apple Watch first, else the source with the most sleep), so two
 * trackers are never added together (plan §3.6). In-bed samples frame the night but never count as sleep.
 */
export const summarizeNight = (segments: SleepSegment[]): NightSummary | null => {
  if (!segments.length) return null;
  const bySource = new Map<string, SleepSegment[]>();
  for (const s of segments) bySource.set(s.source, [...(bySource.get(s.source) ?? []), s]);
  const asleepOf = (list: SleepSegment[]) => list.filter((s) => ASLEEP.includes(s.stage)).reduce((n, s) => n + secs(s), 0);
  const ranked = [...bySource.entries()].sort(([, a], [, b]) => Number(b.some((s) => s.device.startsWith('Watch'))) - Number(a.some((s) => s.device.startsWith('Watch'))) || asleepOf(b) - asleepOf(a));
  const [source, list] = ranked[0]!;
  const sorted = [...list].sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
  const stages = { core: 0, deep: 0, rem: 0, awake: 0, asleep: 0 };
  for (const s of sorted) if (s.stage in stages) stages[s.stage as keyof typeof stages] += secs(s);
  const start = sorted[0]!.start;
  const end = sorted.reduce((e, s) => (Date.parse(s.end) > Date.parse(e) ? s.end : e), sorted[0]!.end);
  return { source, asleepSec: asleepOf(sorted), spanSec: (Date.parse(end) - Date.parse(start)) / 1000, start, end, stages, staged: stages.core + stages.deep + stages.rem > 0 };
};

/** "7h 12m". */
export const hm = (sec: number) => {
  const m = Math.round(sec / 60);
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
};
