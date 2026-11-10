import { z } from 'zod';
import { shiftDays, type ISODate } from './dates.js';

/**
 * How the athlete is training right now, set from the chip on Today and read by Today, Plan and the assistant
 * (docs/inspiration.md §5: a status with an end date that the whole app respects). "training" is the default and is
 * never stored: choosing it clears the status.
 */
export const TRAINING_STATUS_KINDS = ['training', 'taper', 'rest', 'sick', 'injured', 'travel'] as const;
export type TrainingStatusKind = (typeof TRAINING_STATUS_KINDS)[number];

/**
 * The words for each, and what it means for the plan. The lines say what happens to the sessions and nothing about the
 * body: no advice on an illness or an injury, and no claim about either (Logbook is not medical advice).
 */
export const TRAINING_STATUS_INFO: Record<TrainingStatusKind, { label: string; line: string }> = {
  training: { label: 'Training', line: 'On the plan as written.' },
  taper: { label: 'Taper', line: 'Race coming: less volume, keep the sharpness.' },
  rest: { label: 'Rest', line: 'Planned time off. Sessions wait.' },
  sick: { label: 'Sick', line: 'Time off. Sessions wait until you are back.' },
  injured: { label: 'Injured', line: 'Time off. Sessions wait until you are back.' },
  travel: { label: 'Travel', line: 'Away from home. Short and flexible.' },
};

/** A stored status: from the day it was set, through `until` (inclusive), or with no end until changed. */
export const zTrainingStatus = z.object({
  kind: z.enum(TRAINING_STATUS_KINDS),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
});
export type TrainingStatus = z.infer<typeof zTrainingStatus>;

/** PUT /me/status: the kind and how long. "training" clears it. `until` must not be before the request's day. */
export const zTrainingStatusInput = z.object({
  kind: z.enum(TRAINING_STATUS_KINDS),
  until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
});
export type TrainingStatusInput = z.infer<typeof zTrainingStatusInput>;

/** The status in force on `date` ("training" when none applies). */
export const statusOn = (s: TrainingStatus | null | undefined, date: ISODate): TrainingStatusKind =>
  s && s.kind !== 'training' && date >= s.from && (s.until === null || date <= s.until) ? s.kind : 'training';

/** The quick lengths offered in the sheet, as an end day from `today` (null: until changed). */
export const STATUS_LENGTHS = [
  { id: 'today', label: 'Today', days: 0 },
  { id: '3d', label: '3 days', days: 2 },
  { id: '7d', label: 'A week', days: 6 },
  { id: '14d', label: '2 weeks', days: 13 },
  { id: 'open', label: 'Until I change it', days: null },
] as const;
export const untilFor = (today: ISODate, days: number | null): ISODate | null => (days === null ? null : shiftDays(today, days));

/** The statuses that hold the plan's sessions (they wait until you are back); taper and travel change how, not whether. */
export const HOLDING_KINDS: readonly TrainingStatusKind[] = ['sick', 'injured', 'rest'];
/** The holding status on `date`, or null when sessions run as planned. */
export const heldOn = (s: TrainingStatus | null | undefined, date: ISODate): TrainingStatusKind | null => {
  const k = statusOn(s, date);
  return HOLDING_KINDS.includes(k) ? k : null;
};
