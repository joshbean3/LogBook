import { DAY_TAG_MAX, DAY_TAG_MIN, dayTagId, dayTagStat, DEFAULT_DAY_TAGS, type DayTagDef, type DayTagsDay, type DayTagStats } from '@logbook/shared';
import { and, eq, sql } from 'drizzle-orm';
import type { DB } from '../db/index.js';
import { dayTags } from '../db/schema.js';
import { ApiError, nowISO } from '../lib/util.js';
import { readSetting, writeSetting } from '../routes/core.js';

/**
 * Day tags (docs/inspiration.md §6 Journal): the list lives in user_settings (`journalTags`, the four defaults until the
 * owner changes it), each day's marks in `day_tags`. Removing a tag from the list keeps its marks, so adding it back brings
 * its history with it.
 */
const KEY = 'journalTags';

export const tagListOf = (db: DB, userId: string): DayTagDef[] => readSetting<DayTagDef[]>(db, userId, KEY) ?? [...DEFAULT_DAY_TAGS];

export const addTag = (db: DB, userId: string, label: string): DayTagDef[] => {
  const id = dayTagId(label);
  if (!id) throw new ApiError(400, 'Use a letter or a number in the name.', 'bad_tag');
  const list = tagListOf(db, userId);
  if (list.some((t) => t.id === id)) return list;
  if (list.length >= DAY_TAG_MAX) throw new ApiError(422, `Up to ${DAY_TAG_MAX} tags.`, 'too_many_tags');
  const next = [...list, { id, label: label.trim() }];
  writeSetting(db, userId, KEY, next);
  return next;
};

export const removeTag = (db: DB, userId: string, id: string): DayTagDef[] => {
  const next = tagListOf(db, userId).filter((t) => t.id !== id);
  writeSetting(db, userId, KEY, next);
  return next;
};

export const dayOf = (db: DB, userId: string, date: string): DayTagsDay => {
  const rows = db.select().from(dayTags).where(and(eq(dayTags.userId, userId), eq(dayTags.date, date))).all();
  return { date, tags: tagListOf(db, userId), values: Object.fromEntries(rows.map((r) => [r.tag, r.value])) };
};

export const markDay = (db: DB, userId: string, date: string, tag: string, value: boolean | null): DayTagsDay => {
  if (!tagListOf(db, userId).some((t) => t.id === tag)) throw new ApiError(404, 'No tag by that name', 'no_tag');
  const where = and(eq(dayTags.userId, userId), eq(dayTags.date, date), eq(dayTags.tag, tag));
  if (value === null) db.delete(dayTags).where(where).run();
  else
    db.insert(dayTags)
      .values({ userId, date, tag, value, updatedAt: nowISO() })
      .onConflictDoUpdate({ target: [dayTags.userId, dayTags.date, dayTags.tag], set: { value, updatedAt: nowISO() } })
      .run();
  return dayOf(db, userId, date);
};

/**
 * Whether runs carry an effort rating yet: the `effort` column on training_sessions arrives with the effort check-in. Until
 * it exists (or while no run has one) the effect is never computed, only the counts toward it.
 */
const hasEffortColumn = (db: DB) => {
  try {
    const cols = db.all<{ name: string }>(sql`pragma table_info(training_sessions)`);
    return cols.some((c) => c.name === 'effort');
  } catch {
    return false;
  }
};

/** Each day's run effort (the average when a day has more than one rated run). */
export const runEffortByDate = (db: DB, userId: string): Map<string, number> => {
  if (!hasEffortColumn(db)) return new Map();
  const rows = db.all<{ date: string; effort: number }>(
    sql`select date, avg(effort) as effort from training_sessions where user_id = ${userId} and kind = 'run' and deleted_at is null and effort is not null group by date`,
  );
  return new Map(rows.filter((r) => typeof r.effort === 'number').map((r) => [r.date, r.effort]));
};

export const statsOf = (db: DB, userId: string): DayTagStats => {
  const marks = db.select().from(dayTags).where(eq(dayTags.userId, userId)).all();
  const effort = runEffortByDate(db, userId);
  const tags = tagListOf(db, userId).map((def) =>
    dayTagStat(
      def,
      marks.filter((m) => m.tag === def.id),
      effort,
    ),
  );
  return { tags, effort: effort.size > 0, min: DAY_TAG_MIN };
};
