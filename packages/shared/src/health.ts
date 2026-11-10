import { z } from 'zod';

/**
 * Apple Health, as the phone uploads it and the server keeps it (docs/health/apple-health.md §3.3-3.5).
 *
 * Every row carries Health's own UUID (or user + day + metric for the day sums), so an upload sent twice lands once. The
 * server checks each row on its own: a bad one is dropped and counted, the rest of the batch is kept.
 */

/** Bump when the upload shape changes: the phone resets its anchors and imports again (plan §3.2, decision 11). */
export const HEALTH_PAYLOAD_VERSION = 1;
/** The first import reads this far back unless Settings says otherwise (decided 2026-11-09: a year). */
export const HEALTH_HISTORY_DAYS = 365;
export const HEALTH_MAX_HISTORY_DAYS = 730;
/** A batch is at most this many rows of each kind; the phone splits by bytes well before. */
export const HEALTH_BATCH_LIMIT = 5000;

/**
 * What Logbook takes from Apple Health in 1.0: sleep, heart rate variability and resting heart rate. Nothing else is
 * read on the phone, and the server refuses anything else (422), so the app never holds a reading no screen shows.
 */
export const HEALTH_SAMPLE_TYPES = ['hrv', 'resting_hr'] as const;
export type HealthSampleType = (typeof HEALTH_SAMPLE_TYPES)[number];
/** The unit each type is stored in. */
export const HEALTH_UNITS: Record<HealthSampleType, string> = {
  hrv: 'ms',
  resting_hr: 'bpm',
};
/** The three things in words, for a refusal. */
export const HEALTH_ACCEPTED = 'sleep, heart rate variability and resting heart rate';

/**
 * Day sums (steps, energy, heart rate buckets) as an earlier build uploaded them. No longer accepted: a batch that
 * carries any is refused. The shape stays so old rows and old exports can still be read.
 */
export const HEALTH_DAY_METRICS = ['steps', 'active_kcal', 'basal_kcal', 'exercise_min', 'hr'] as const;
export type HealthDayMetric = (typeof HEALTH_DAY_METRICS)[number];

export const SLEEP_STAGES = ['in_bed', 'asleep', 'awake', 'core', 'deep', 'rem'] as const;
export type SleepStageName = (typeof SLEEP_STAGES)[number];

const zIso = z.string().refine((s) => !Number.isNaN(Date.parse(s)), 'an ISO date-time');
const zUuid = z.string().min(1).max(64);
const zSource = {
  sourceBundle: z.string().max(200).default(''),
  sourceName: z.string().max(200).default(''),
  /** The hardware ("Watch7,1", "iPhone17,2"): how a Watch is told from an iPhone (both use com.apple.health.*). */
  productType: z.string().max(60).nullable().optional(),
};
const zTz = z.string().max(60).nullable().optional();

export const zHealthSample = z.object({
  uuid: zUuid,
  type: z.enum(HEALTH_SAMPLE_TYPES),
  start: zIso,
  end: zIso,
  value: z.number().finite(),
  /** Typed in by hand in the Health app: shown, never used for a baseline. */
  userEntered: z.boolean().optional(),
  tz: zTz,
  ...zSource,
});
export type HealthSample = z.infer<typeof zHealthSample>;

/**
 * One 5-minute heart rate bucket: its index in the day (0-287 on a 24-hour day; more or fewer on a daylight-saving day),
 * how many readings, their average, min and max, and the seconds spent in each 5 bpm band (keyed by the band's lower edge,
 * "120" = 120-124 bpm). Buckets inside a workout are left out: workouts carry their own heart rate.
 */
export const zHrBucket = z.object({
  i: z.number().int().min(0).max(300),
  n: z.number().int().min(1),
  avg: z.number().min(20).max(250),
  min: z.number().min(20).max(250),
  max: z.number().min(20).max(250),
  z: z.record(z.string().regex(/^\d{2,3}$/), z.number().min(0).max(600)),
});
export type HrBucket = z.infer<typeof zHrBucket>;

export const zHealthDay = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  metric: z.enum(HEALTH_DAY_METRICS),
  value: z.number().finite().nullable(),
  /** `steps`: [index, sum] pairs; `hr`: heart rate buckets. */
  buckets: z.union([z.array(z.tuple([z.number().int().min(0).max(300), z.number().min(0)])), z.array(zHrBucket)]).nullable().optional(),
  /** When this day began, in the time zone it was summed in (frozen on the server the first time it arrives). */
  dayStart: zIso,
  tz: z.string().max(60),
});
export type HealthDay = z.infer<typeof zHealthDay>;

export const zSleepSegmentIn = z.object({
  uuid: zUuid,
  start: zIso,
  end: zIso,
  stage: z.enum(SLEEP_STAGES),
  tz: zTz,
  ...zSource,
});
export type SleepSegmentIn = z.infer<typeof zSleepSegmentIn>;

export const zHealthWorkout = z.object({
  uuid: zUuid,
  /** HKWorkoutActivityType in words ("running", "traditionalStrengthTraining"). */
  activity: z.string().max(60),
  start: zIso,
  end: zIso,
  durationSec: z.number().min(0),
  distanceM: z.number().min(0).nullable().optional(),
  energyKcal: z.number().min(0).nullable().optional(),
  avgHr: z.number().min(20).max(250).nullable().optional(),
  maxHr: z.number().min(20).max(250).nullable().optional(),
  /** Heart rate in 5-second steps: [seconds from the start, bpm]. */
  hr: z.array(z.tuple([z.number().min(0), z.number().min(20).max(250)])).max(20000).nullable().optional(),
  tz: zTz,
  ...zSource,
});
export type HealthWorkout = z.infer<typeof zHealthWorkout>;

/** `workout` is still taken so an older phone can report a deletion; there is nothing left for it to delete. */
export const HEALTH_DELETION_KINDS = ['sample', 'sleep', 'workout'] as const;
export const zHealthDeletion = z.object({ uuid: zUuid, kind: z.enum(HEALTH_DELETION_KINDS) });

/**
 * A batch, as the server first reads it: the envelope strictly, the rows loosely (each is checked on its own, so one bad
 * row never costs the others).
 */
export const zHealthBatchEnvelope = z.object({
  batchId: z.string().min(8).max(64),
  payloadVersion: z.number().int().min(1),
  samples: z.array(z.unknown()).max(HEALTH_BATCH_LIMIT).default([]),
  deletions: z.array(z.unknown()).max(HEALTH_BATCH_LIMIT).default([]),
  days: z.array(z.unknown()).max(HEALTH_BATCH_LIMIT).default([]),
  sleep: z.array(z.unknown()).max(HEALTH_BATCH_LIMIT).default([]),
  workouts: z.array(z.unknown()).max(1000).default([]),
});

export const HEALTH_RECONCILE_KINDS = [...HEALTH_SAMPLE_TYPES, 'sleep'] as const;
export const zHealthReconcile = z.object({
  kind: z.enum(HEALTH_RECONCILE_KINDS),
  from: zIso,
  to: zIso,
  uuids: z.array(zUuid).max(50000),
});

export const zHealthConnect = z.object({
  deviceName: z.string().trim().max(80).default('iPhone'),
  historyDays: z.number().int().min(30).max(HEALTH_MAX_HISTORY_DAYS).default(HEALTH_HISTORY_DAYS),
  /** Asked during connect (decided 2026-11-09). */
  sleepGoalMin: z.number().int().min(240).max(720).nullable().optional(),
  /**
   * Which phone this is: its vendor id (`identifierForVendor`), so connecting again from the same phone ends its earlier
   * token. Stored hashed. Without it the server goes by the sign-in the connect came from.
   */
  deviceKey: z.string().trim().min(8).max(100).optional(),
});

export interface HealthStatus {
  connected: boolean;
  connectedAt: string | null;
  lastSyncAt: string | null;
  lastError: string | null;
  historyFrom: string | null;
  sleepGoalMin: number | null;
  /** What has arrived, by kind, so Settings can say "a year of sleep, 312 HRV readings". */
  counts: { samples: Record<string, number>; days: number; sleep: number; workouts: number };
  /** The first and last day with data. */
  span: { from: string | null; to: string | null };
  devices: Array<{ id: string; name: string; lastSeenAt: string | null }>;
}

export interface HealthSyncAnswer {
  stored: { samples: number; deletions: number; days: number; sleep: number; workouts: number };
  dropped: number;
  duplicate?: true;
}

/** The sleep stages that count as time asleep (in bed and awake do not). */
export const ASLEEP_STAGES: readonly SleepStageName[] = ['asleep', 'core', 'deep', 'rem'];
/** `GET /apple-health/daily` answers at most this many days. */
export const HEALTH_DAILY_MAX_DAYS = 400;
/**
 * One day of `GET /apple-health/daily`. `sleepMin`: minutes asleep in the night that ended on this date (sleep that
 * starts from 6 pm the evening before counts toward it). `hrvMs` and `restingHr`: the day's average. Null when Apple
 * Health had nothing for that day.
 */
export interface HealthDailyRow {
  date: string;
  sleepMin: number | null;
  hrvMs: number | null;
  restingHr: number | null;
}
export interface HealthDaily {
  days: HealthDailyRow[];
}
