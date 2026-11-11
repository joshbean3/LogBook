/**
 * The words on the Progress hero: the headline at rest (the range's total, or this week against its plan), the readout
 * while one bucket is read (its dates, its number and what it was made of), and what VoiceOver hears for each bucket.
 * Running reads in miles and runs, strength in lift sessions and sets. Pure functions over the buckets, so the card and
 * its tests agree. History is never graded against a plan here: the plan is only said for what is still ahead.
 */
import type { ISODate } from '@logbook/shared';
import { plural } from './data';
import { lbShort, miShort } from './hero';
import { bucketDates, bucketTitle, rangeContext, UNIT_WORD, usualOver, type BucketUnit, type LiftBucket, type RangeSpan, type RunBucket } from './ranges';

export interface Readout {
  /** The number, large. */
  big: string;
  /** Its unit and context, beside it. */
  context: string;
  /** One line under it. */
  take: string;
}
const runsWord = (n: number) => `${n} ${plural(n, 'run')}`;
const setsWord = (n: number) => `${n} ${plural(n, 'set')}`;
/** A mean to one decimal, whole when it is whole ("1.4", "2"). */
const mean1 = (v: number) => String(Math.round(v * 10) / 10);
/** The readout as one sentence, for a screen reader. */
export const readoutWords = (r: Readout) => `${r.big} ${r.context}. ${r.take}.`;

// ---------- running ----------
/** This week in words, under the 1W headline: against its plan while it has one, else beside last week. */
export const weekTakeaway = (w: RunBucket, last: RunBucket | null) => {
  if (w.planned <= 0) return last && !last.missing && last.done > 0 ? `${miShort(last.done)} mi last week` : 'No runs planned this week';
  if (w.done + 0.05 >= w.planned) return 'This week’s plan is done';
  const behind = w.plannedPast - w.done;
  return behind > 0.05 ? `${miShort(behind)} mi behind plan this week` : `On plan, ${miShort(w.planned - w.done)} mi to go`;
};

/** The running headline at rest. `week` is this week whatever the range; `byWeek` reads this week against its plan (1W). */
export const runRest = (span: RangeSpan, buckets: RunBucket[], week: RunBucket, last: RunBucket | null, today: ISODate, byWeek: boolean, firstWeek = false): Readout => {
  if (byWeek)
    return {
      big: miShort(week.done),
      context: week.planned > 0 ? `of ${miShort(week.planned)} mi · ${week.runs} of ${week.plannedRuns} ${plural(week.plannedRuns, 'run')}` : `mi · ${runsWord(week.runs)}`,
      take: firstWeek ? 'Your weeks draw here as you go.' : weekTakeaway(week, last),
    };
  const live = buckets.filter((b) => !b.missing);
  const total = live.reduce((s, b) => s + b.done, 0);
  const runs = live.reduce((s, b) => s + b.runs, 0);
  const usual = span.unit === 'day' ? null : usualOver(buckets);
  return {
    big: miShort(total),
    context: `mi ${rangeContext(span, today)}`,
    take: usual ? `${miShort(usual.mean)} mi a ${UNIT_WORD[span.unit]} on average` : runs ? runsWord(runs) : 'No runs in this range',
  };
};

/** One running bucket while it is read: its miles, its dates and its runs; what is planned for a bucket still ahead. */
export const runAt = (unit: BucketUnit, b: RunBucket, today: ISODate): Readout => {
  const dates = bucketDates(unit, b, today);
  if (b.future) return b.ahead > 0 ? { big: miShort(b.ahead), context: 'mi planned', take: dates } : { big: '0', context: 'mi', take: `${dates} · Nothing planned` };
  return {
    big: miShort(b.done),
    context: b.current && unit !== 'day' ? 'mi so far' : 'mi',
    take: `${dates} · ${runsWord(b.runs)}${b.current && b.ahead > 0 ? ` · ${miShort(b.ahead)} mi to go` : ''}`,
  };
};

/** What VoiceOver hears for one running bucket. */
export const runWords = (unit: BucketUnit, b: RunBucket, today: ISODate) => {
  const name = bucketTitle(unit, b, today);
  if (b.missing) return `${name}: not loaded yet`;
  if (b.future) return b.ahead > 0 ? `${name}: ${miShort(b.ahead)} miles planned` : `${name}: nothing planned`;
  return `${name}: ${miShort(b.done)} miles, ${runsWord(b.runs)}${b.current && b.ahead > 0 ? `, ${miShort(b.ahead)} miles still planned` : ''}`;
};

// ---------- strength ----------
/** What a stretch of lifting was made of: "18 sets · 9,270 lb"; bodyweight sets have no pounds. */
const madeOf = (b: Pick<LiftBucket, 'sets' | 'volume'>) => `${setsWord(b.sets)}${b.volume > 0 ? ` · ${lbShort(b.volume)} lb` : ''}`;

/** The strength headline at rest: this week against its plan (1W), else the range's sessions and its usual week. */
export const liftRest = (span: RangeSpan, buckets: LiftBucket[], week: LiftBucket, today: ISODate, byWeek: boolean): Readout => {
  if (byWeek) {
    const unit = plural(week.planned || week.done, 'session');
    return {
      big: String(week.done),
      context: week.planned > 0 ? `of ${week.planned} ${unit} this week` : `${unit} this week`,
      take: week.sets ? `${setsWord(week.sets)}${week.volume > 0 ? `, ${lbShort(week.volume)} lb moved` : ''}` : 'No sets yet',
    };
  }
  const total = buckets.reduce((s, b) => s + (b.missing ? 0 : b.done), 0);
  const usual = span.unit === 'day' ? null : usualOver(buckets);
  return {
    big: String(total),
    context: `${plural(total, 'session')} ${rangeContext(span, today)}`,
    take: usual ? `${mean1(usual.mean)} a ${UNIT_WORD[span.unit]} on average` : total ? madeOf({ sets: buckets.reduce((s, b) => s + b.sets, 0), volume: buckets.reduce((s, b) => s + b.volume, 0) }) : 'No lifts in this range',
  };
};

/** One strength bucket while it is read: its sessions, its dates and what they were made of. */
export const liftAt = (unit: BucketUnit, b: LiftBucket, today: ISODate): Readout => {
  const dates = bucketDates(unit, b, today);
  if (b.future) return b.ahead > 0 ? { big: String(b.ahead), context: `${plural(b.ahead, 'session')} planned`, take: dates } : { big: '0', context: 'sessions', take: `${dates} · Nothing planned` };
  const made = b.sets ? madeOf(b) : b.done ? 'No sets logged' : 'No lifts';
  return {
    big: String(b.done),
    context: `${plural(b.done, 'session')}${b.current && unit !== 'day' ? ' so far' : ''}`,
    take: `${dates} · ${made}${b.current && b.ahead > 0 ? ` · ${b.ahead} to go` : ''}`,
  };
};

/** What VoiceOver hears for one strength bucket. */
export const liftWords = (unit: BucketUnit, b: LiftBucket, today: ISODate) => {
  const name = bucketTitle(unit, b, today);
  if (b.missing) return `${name}: not loaded yet`;
  if (b.future) return b.ahead > 0 ? `${name}: ${b.ahead} lift ${plural(b.ahead, 'session')} planned` : `${name}: nothing planned`;
  return `${name}: ${b.done} lift ${plural(b.done, 'session')}${b.sets ? `, ${setsWord(b.sets)}` : ''}${b.current && b.ahead > 0 ? `, ${b.ahead} still planned` : ''}`;
};
