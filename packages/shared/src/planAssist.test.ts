import { describe, expect, it } from 'vitest';
import { applyPlanPatch, builderDates, builderInput, cleanPlanPatch, isEmptyPatch, resizeRunDays, shareableSettings, zClaudeShapeOutput, zPlanAssistRequest, zPlanAssistResult, type BuilderAnswers, type PlanPatch } from './planAssist.js';
import { zTemplateInput, zTemplateRequest } from './schemas.js';
import { buildTemplate, isTemplateSource, TEMPLATE_ASSISTED_SOURCE } from './templates.js';

/** A Wednesday: next Monday is Nov 16, tomorrow is Thursday Nov 12. */
const T = '2026-11-11';
const answers: BuilderAnswers = { goal: 'base', weeks: 8, runDays: ['tue', 'thu', 'sat', 'sun'], longRunDay: 'sun', weeklyMiles: 20, peakMiles: null, soon: false, startDate: null, race: true, raceDay: 'sun' };
const half: BuilderAnswers = { ...answers, goal: 'half', weeks: 12 };
const apply = (a: BuilderAnswers, p: PlanPatch) => applyPlanPatch(a, p, T);
const fields = (r: { changes: Array<{ field: string }> }) => r.changes.map((c) => c.field);
/** Every field of Claude's shape, null: one test sets the few it is about. */
const blank = { goal: null, weeks: null, weeksChange: null, raceDate: null, race: null, runDays: null, addRunDays: null, removeRunDays: null, runsPerWeek: null, runsPerWeekChange: null, longRunDay: null, weeklyMiles: null, weeklyMilesChange: null, peakMiles: null, start: null, startDate: null, cannot: [], note: null };

describe('builderDates and builderInput', () => {
  it('starts next Monday, or tomorrow with a warm-up week, or on a set day', () => {
    expect(builderDates(answers, T)).toEqual({ startDate: '2026-11-16', firstMon: '2026-11-16', raceDate: null });
    expect(builderDates({ ...answers, soon: true }, T)).toEqual({ startDate: '2026-11-12', firstMon: '2026-11-16', raceDate: null });
    expect(builderDates({ ...answers, startDate: '2026-12-21', soon: true }, T).startDate).toBe('2026-12-21');
  });
  it('puts race day in the last week, on the race weekday (Sunday as before)', () => {
    expect(builderDates(half, T).raceDate).toBe('2027-02-07');
    expect(builderDates({ ...half, raceDay: 'sat' }, T).raceDate).toBe('2027-02-06');
    expect(builderDates({ ...half, race: false }, T).raceDate).toBeNull();
  });
  it('sends the peak only when one is set, and builds a plan the template accepts', () => {
    expect(builderInput(half, T)).toEqual({ goal: 'half', weeks: 12, startDate: '2026-11-16', runDays: ['tue', 'thu', 'sat', 'sun'], longRunDay: 'sun', weeklyMiles: 20, raceDate: '2027-02-07' });
    expect(builderInput({ ...half, peakMiles: 30 }, T).peakMiles).toBe(30);
    const t = buildTemplate(builderInput({ ...half, raceDay: 'sat' }, T));
    expect(t.end).toBe('2027-02-06');
    expect(t.sessions.at(-1)).toMatchObject({ date: '2027-02-06', type: 'Race' });
  });
});

describe('the peak ceiling in buildTemplate', () => {
  const peakOf = (a: BuilderAnswers) => Math.max(...buildTemplate(builderInput(a, T)).weeks.map((w) => w.target));
  it('leaves the plan’s own ceiling alone when no peak is given', () => {
    expect(peakOf({ ...answers, weeks: 20 })).toBe(32);
  });
  it('stops the build at a lower peak, and lets it pass the plan’s own ceiling at the same weekly growth', () => {
    expect(peakOf({ ...answers, weeks: 20, peakMiles: 26 })).toBe(26);
    const high = buildTemplate(builderInput({ ...answers, weeks: 20, peakMiles: 40, runDays: ['mon', 'tue', 'thu', 'sat', 'sun'] }, T));
    expect(Math.max(...high.weeks.map((w) => w.target))).toBe(40);
    const builds = high.weeks.filter((w) => w.kind === 'build');
    for (let i = 1; i < builds.length; i++) expect(builds[i]!.target / builds[i - 1]!.target).toBeLessThanOrEqual(1.11);
  });
  it('never drops under week 1, and a peak the weeks cannot reach is simply not reached', () => {
    expect(peakOf({ ...answers, peakMiles: 10 })).toBe(20);
    expect(peakOf({ ...answers, weeks: 4, peakMiles: 60 })).toBeLessThan(26);
  });
});

describe('the template request', () => {
  it('takes a peak and the assisted flag, and still takes a request without them', () => {
    const input = builderInput({ ...half, peakMiles: 35 }, T);
    expect(zTemplateInput.safeParse(input).success).toBe(true);
    expect(zTemplateRequest.parse({ ...input, replace: true, assisted: true })).toMatchObject({ peakMiles: 35, assisted: true, replace: true });
    expect(zTemplateRequest.parse(builderInput(half, T))).not.toHaveProperty('assisted');
    expect(zTemplateInput.safeParse({ ...input, peakMiles: 900 }).success).toBe(false);
    expect(zTemplateInput.safeParse({ ...input, peakMiles: null }).success).toBe(true);
  });
  it('a block the builder wrote is a template block with or without the assistant', () => {
    expect(isTemplateSource('template')).toBe(true);
    expect(isTemplateSource(TEMPLATE_ASSISTED_SOURCE)).toBe(true);
    expect(isTemplateSource('describe')).toBe(false);
    expect(isTemplateSource(null)).toBe(false);
  });
});

describe('the contract', () => {
  it('a request needs a kind and words; settings may be absent, null, or hold nulls', () => {
    expect(zPlanAssistRequest.safeParse({ kind: 'shape', words: '4 runs a week' }).success).toBe(true);
    expect(zPlanAssistRequest.safeParse({ kind: 'shape', words: '4 runs a week', settings: null }).success).toBe(true);
    expect(zPlanAssistRequest.safeParse({ kind: 'shape', words: '  ' }).success).toBe(false);
    expect(zPlanAssistRequest.safeParse({ kind: 'research', words: 'a plan like a famous one' }).success).toBe(false);
    expect(zPlanAssistRequest.safeParse({ kind: 'shape', words: 'x'.repeat(601) }).success).toBe(false);
    expect(zPlanAssistRequest.safeParse({ kind: 'shape', words: 'ok then', settings: shareableSettings(answers, T, { runDays: true, weeklyMiles: true }) }).success).toBe(true);
  });
  it('settings leave out what was read from tracked runs, the long-run day with the run days', () => {
    expect(shareableSettings(half, T, { runDays: false, weeklyMiles: false })).toEqual({ goal: 'half', weeks: 12, runDays: ['tue', 'thu', 'sat', 'sun'], longRunDay: 'sun', weeklyMiles: 20, peakMiles: null, startDate: '2026-11-16', raceDate: '2027-02-07' });
    expect(shareableSettings(half, T, { runDays: true, weeklyMiles: true })).toMatchObject({ runDays: null, longRunDay: null, weeklyMiles: null, goal: 'half', weeks: 12 });
  });
  it('the shape Claude is asked for takes every field as null', () => {
    expect(zClaudeShapeOutput.safeParse(blank).success).toBe(true);
  });
});

describe('cleanPlanPatch', () => {
  const clean = (o: Record<string, unknown>) => cleanPlanPatch({ ...blank, ...o }, T)!;
  it('keeps only what was set: a null field is absent from the patch', () => {
    const r = clean({ runsPerWeek: 4, longRunDay: 'sun' });
    expect(r.patch).toEqual({ runsPerWeek: 4, longRunDay: 'sun' });
    expect(r).toMatchObject({ dropped: [], cannot: [], note: null });
    expect(isEmptyPatch(clean({}).patch)).toBe(true);
    expect(zPlanAssistResult.safeParse({ kind: 'shape', ...r }).success).toBe(true);
  });
  it('clamps numbers to the builder’s limits and says why', () => {
    expect(clean({ weeks: 52 })).toMatchObject({ patch: { weeks: 30 }, dropped: [{ reason: 'weeks_max', value: 30 }] });
    expect(clean({ weeks: 1 })).toMatchObject({ patch: { weeks: 2 }, dropped: [{ reason: 'weeks_min', value: 2 }] });
    expect(clean({ weeklyMiles: 400 })).toMatchObject({ patch: { weeklyMiles: 150 }, dropped: [{ reason: 'miles_max', value: 150 }] });
    expect(clean({ weeklyMiles: 1 })).toMatchObject({ patch: { weeklyMiles: 3 }, dropped: [{ reason: 'miles_min', value: 3 }] });
    expect(clean({ runsPerWeek: 9 })).toMatchObject({ patch: { runsPerWeek: 7 }, dropped: [{ reason: 'runs_max', value: 7 }] });
    expect(clean({ peakMiles: 900 })).toMatchObject({ patch: { peakMiles: 150 }, dropped: [{ reason: 'peak_max', value: 150 }] });
  });
  it('rounds to whole numbers, takes a number in a string, and drops what is not a number', () => {
    expect(clean({ weeklyMiles: 21.6, weeks: '10' }).patch).toEqual({ weeklyMiles: 22, weeks: 10 });
    expect(clean({ weeks: 'a dozen' })).toMatchObject({ patch: {}, dropped: [{ reason: 'bad_value' }] });
  });
  it('an absolute value wins over a change to the same setting; a zero change is nothing', () => {
    expect(clean({ weeks: 10, weeksChange: 2 }).patch).toEqual({ weeks: 10 });
    expect(clean({ weeksChange: 2, weeklyMilesChange: -5, runsPerWeekChange: 1 }).patch).toEqual({ weeksChange: 2, weeklyMilesChange: -5, runsPerWeekChange: 1 });
    expect(clean({ weeksChange: 0, weeklyMilesChange: 0 }).patch).toEqual({});
  });
  it('a peak of zero hands the peak back to the plan', () => {
    expect(clean({ peakMiles: 0 }).patch).toEqual({ peakMiles: null });
    expect(clean({ peakMiles: 35 }).patch).toEqual({ peakMiles: 35 });
  });
  it('reads weekdays whatever their case or length, in week order, and drops a word that is no weekday', () => {
    expect(clean({ runDays: ['Sunday', 'tue', 'THU'], longRunDay: 'Sunday' }).patch).toEqual({ runDays: ['tue', 'thu', 'sun'], longRunDay: 'sun' });
    expect(clean({ addRunDays: ['fri', 'someday'] })).toMatchObject({ patch: { addRunDays: ['fri'] }, dropped: [{ reason: 'bad_value' }] });
    expect(clean({ removeRunDays: [] }).patch).toEqual({});
    expect(clean({ longRunDay: 'weekend' })).toMatchObject({ patch: {}, dropped: [{ reason: 'bad_value' }] });
  });
  it('drops a race or start day that has passed, is today, is no date, or is more than a year out', () => {
    expect(clean({ raceDate: '2027-03-14' }).patch).toEqual({ raceDate: '2027-03-14' });
    expect(clean({ raceDate: '2026-03-14' })).toMatchObject({ patch: {}, dropped: [{ reason: 'race_past' }] });
    expect(clean({ raceDate: T })).toMatchObject({ patch: {}, dropped: [{ reason: 'race_past' }] });
    expect(clean({ raceDate: 'March 14' })).toMatchObject({ patch: {}, dropped: [{ reason: 'bad_value' }] });
    expect(clean({ raceDate: '2028-06-01' })).toMatchObject({ patch: {}, dropped: [{ reason: 'race_too_far' }] });
    expect(clean({ startDate: '2026-11-01' })).toMatchObject({ patch: {}, dropped: [{ reason: 'start_past' }] });
    expect(clean({ startDate: '2026-12-01', start: 'tomorrow' }).patch).toEqual({ startDate: '2026-12-01' });
    expect(clean({ start: 'tomorrow' }).patch).toEqual({ start: 'tomorrow' });
    expect(clean({ start: 'someday' })).toMatchObject({ patch: {}, dropped: [{ reason: 'bad_value' }] });
  });
  it('keeps what the builder cannot do as topics, an unknown one as other, each once', () => {
    expect(clean({ cannot: ['lifts', 'lifts', 'paces', 'hot yoga'] }).cannot).toEqual(['lifts', 'paces', 'other']);
  });
  it('the note is one plain line: no line breaks, no em dash, 240 characters at most', () => {
    expect(clean({ note: '  See a doctor first — not a plan.\nRest today. ' }).note).toBe('See a doctor first, not a plan. Rest today.');
    expect(clean({ note: 'x'.repeat(400) }).note).toHaveLength(240);
    expect(clean({ note: '   ' }).note).toBeNull();
  });
  it('an answer that is not an object is not an answer', () => {
    expect(cleanPlanPatch('four runs', T)).toBeNull();
    expect(cleanPlanPatch(null, T)).toBeNull();
    expect(cleanPlanPatch([{ weeks: 4 }], T)).toBeNull();
  });
  it('takes an answer with fields missing (a model that left some out)', () => {
    expect(cleanPlanPatch({ weeks: 10 }, T)).toEqual({ patch: { weeks: 10 }, dropped: [], cannot: [], note: null });
  });
});

describe('resizeRunDays', () => {
  it('keeps the days when the count is already right', () => {
    expect(resizeRunDays(['tue', 'thu', 'sat', 'sun'], 'sun', 4)).toEqual(['tue', 'thu', 'sat', 'sun']);
  });
  it('adds the day that keeps runs best spread, and keeps every current day', () => {
    expect(resizeRunDays(['tue', 'thu', 'sat', 'sun'], 'sun', 5)).toEqual(['tue', 'wed', 'thu', 'sat', 'sun']);
    expect(resizeRunDays(['tue', 'thu', 'sat', 'sun'], 'sun', 6)).toEqual(['tue', 'wed', 'thu', 'fri', 'sat', 'sun']);
    expect(resizeRunDays(['tue', 'thu', 'sat', 'sun'], 'sun', 7)).toEqual(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']);
    expect(resizeRunDays(['sun'], 'sun', 3)).toEqual(['tue', 'thu', 'sun']);
  });
  it('drops days, never the long-run day, keeping what is left spread out', () => {
    expect(resizeRunDays(['tue', 'thu', 'sat', 'sun'], 'sun', 3)).toEqual(['tue', 'thu', 'sun']);
    expect(resizeRunDays(['tue', 'thu', 'sat', 'sun'], 'sun', 2)).toEqual(['thu', 'sun']);
    expect(resizeRunDays(['tue', 'thu', 'sat', 'sun'], 'sat', 1)).toEqual(['sat']);
    expect(resizeRunDays(['mon', 'wed', 'fri', 'sat', 'sun'], 'sun', 4)).toEqual(['mon', 'wed', 'fri', 'sun']);
  });
  it('holds the count to 1 to 7', () => {
    expect(resizeRunDays(['tue', 'sun'], 'sun', 0)).toEqual(['sun']);
    expect(resizeRunDays(['tue', 'sun'], 'sun', 12)).toHaveLength(7);
  });
});

describe('applyPlanPatch', () => {
  it('changes only what the patch names', () => {
    const r = apply(answers, { runsPerWeek: 4, longRunDay: 'sun' });
    expect(r.next).toEqual(answers);
    expect(r.changes).toEqual([]);
    expect(r.notes).toEqual([]);
    const m = apply(answers, { weeklyMiles: 25 });
    expect(m.next).toEqual({ ...answers, weeklyMiles: 25 });
    expect(m.changes).toEqual([{ field: 'weeklyMiles', miles: 25 }]);
  });
  it('the worked example: 4 runs a week, long run Sunday, peak at 35, race on March 14', () => {
    const from: BuilderAnswers = { ...answers, runDays: ['mon', 'wed', 'fri', 'sat', 'sun'], longRunDay: 'sat' };
    const r = apply(from, { goal: 'half', runsPerWeek: 4, longRunDay: 'sun', peakMiles: 35, raceDate: '2027-03-14' });
    expect(r.next).toMatchObject({ goal: 'half', runDays: ['mon', 'wed', 'fri', 'sun'], longRunDay: 'sun', peakMiles: 35, weeks: 17, race: true, raceDay: 'sun' });
    expect(builderDates(r.next, T).raceDate).toBe('2027-03-14');
    expect(r.changes).toEqual([
      { field: 'goal', goal: 'half' },
      { field: 'runDays', days: ['mon', 'wed', 'fri', 'sun'], named: false },
      { field: 'longRunDay', day: 'sun' },
      { field: 'raceDate', date: '2027-03-14' },
      { field: 'peakMiles', miles: 35 },
    ]);
    expect(r.notes).toEqual([]);
  });
  it('a new goal takes that goal’s usual length, unless weeks or a race day came with it', () => {
    expect(apply(answers, { goal: 'marathon' }).next).toMatchObject({ goal: 'marathon', weeks: 16 });
    expect(apply(answers, { goal: 'marathon', weeks: 20 }).next.weeks).toBe(20);
    expect(fields(apply(answers, { goal: 'marathon' }))).toEqual(['goal', 'weeks']);
    expect(apply(half, { goal: 'half' }).changes).toEqual([]);
  });
  it('weeks: set, changed by a count, and held to 2 to 30 with a reason', () => {
    expect(apply(half, { weeks: 16 }).next.weeks).toBe(16);
    expect(apply(half, { weeksChange: 2 }).next.weeks).toBe(14);
    expect(apply(half, { weeksChange: -11 })).toMatchObject({ next: { weeks: 2 }, notes: [{ reason: 'weeks_min', value: 2 }] });
    expect(apply(half, { weeksChange: 25 })).toMatchObject({ next: { weeks: 30 }, notes: [{ reason: 'weeks_max', value: 30 }] });
  });
  it('a race day sets the weeks and the race weekday, and turns the race on', () => {
    const r = apply({ ...half, race: false }, { raceDate: '2027-03-13' });
    expect(r.next).toMatchObject({ weeks: 17, race: true, raceDay: 'sat' });
    expect(builderDates(r.next, T).raceDate).toBe('2027-03-13');
    expect(r.changes).toEqual([{ field: 'raceDate', date: '2027-03-13' }]);
  });
  it('a race day with a length starts the plan later, so its last week holds the race', () => {
    const r = apply(half, { weeks: 12, raceDate: '2027-03-14' });
    expect(r.next).toMatchObject({ weeks: 12, startDate: '2026-12-21', soon: false, raceDay: 'sun' });
    expect(builderDates(r.next, T)).toEqual({ startDate: '2026-12-21', firstMon: '2026-12-21', raceDate: '2027-03-14' });
    expect(r.changes).toEqual([
      { field: 'raceDate', date: '2027-03-14' },
      { field: 'start', date: '2026-12-21', soon: false },
    ]);
  });
  it('a length that does not fit before race day gives way to the weeks that do, and says so', () => {
    const r = apply(half, { weeks: 20, raceDate: '2027-02-14' });
    expect(r.next).toMatchObject({ weeks: 13, startDate: null });
    expect(r.notes).toEqual([{ reason: 'race_weeks_fit', value: 13 }]);
  });
  it('refuses a race that is too soon, too far, or has no distance, and changes nothing for it', () => {
    expect(apply(half, { raceDate: '2026-11-15' })).toMatchObject({ next: half, changes: [], notes: [{ reason: 'race_too_soon' }] });
    expect(apply(half, { raceDate: '2027-10-10' })).toMatchObject({ next: half, changes: [], notes: [{ reason: 'race_too_far' }] });
    expect(apply(answers, { raceDate: '2027-03-14' })).toMatchObject({ next: answers, changes: [], notes: [{ reason: 'race_needs_distance' }] });
    expect(apply(answers, { race: true })).toMatchObject({ next: answers, notes: [{ reason: 'race_needs_distance' }] });
  });
  it('turns the race off and on', () => {
    expect(apply(half, { race: false })).toMatchObject({ next: { race: false }, changes: [{ field: 'race', on: false }] });
    expect(apply({ ...half, race: false }, { race: true }).changes).toEqual([{ field: 'race', on: true }]);
  });
  it('run days: the whole set, added, taken away, and never none', () => {
    expect(apply(answers, { runDays: ['mon', 'wed', 'fri'] })).toMatchObject({ next: { runDays: ['mon', 'wed', 'fri'], longRunDay: 'fri' }, changes: [{ field: 'runDays', days: ['mon', 'wed', 'fri'], named: true }, { field: 'longRunDay', day: 'fri' }] });
    expect(apply(answers, { addRunDays: ['fri'] }).next.runDays).toEqual(['tue', 'thu', 'fri', 'sat', 'sun']);
    expect(apply(answers, { removeRunDays: ['sat'] }).next.runDays).toEqual(['tue', 'thu', 'sun']);
    expect(apply(answers, { removeRunDays: ['sun'] }).next).toMatchObject({ runDays: ['tue', 'thu', 'sat'], longRunDay: 'sat' });
    expect(apply(answers, { removeRunDays: ['tue', 'thu', 'sat', 'sun'] })).toMatchObject({ next: answers, notes: [{ reason: 'keep_one_day' }] });
    expect(apply(answers, { addRunDays: ['wed'], removeRunDays: ['tue'] }).next.runDays).toEqual(['wed', 'thu', 'sat', 'sun']);
  });
  it('the long-run day joins the run days', () => {
    expect(apply(answers, { longRunDay: 'fri' }).next).toMatchObject({ runDays: ['tue', 'thu', 'fri', 'sat', 'sun'], longRunDay: 'fri' });
    expect(apply(answers, { longRunDay: 'sat' })).toMatchObject({ next: { runDays: answers.runDays, longRunDay: 'sat' }, changes: [{ field: 'longRunDay', day: 'sat' }] });
  });
  it('a count resizes around the long-run day, after any named days', () => {
    expect(apply(answers, { runsPerWeek: 5 })).toMatchObject({ next: { runDays: ['tue', 'wed', 'thu', 'sat', 'sun'] }, changes: [{ field: 'runDays', named: false }] });
    expect(apply(answers, { runsPerWeekChange: -1 }).next.runDays).toEqual(['tue', 'thu', 'sun']);
    expect(apply(answers, { runsPerWeekChange: 9 })).toMatchObject({ next: { runDays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] }, notes: [{ reason: 'runs_max', value: 7 }] });
    expect(apply(answers, { runsPerWeek: 3, longRunDay: 'sat' }).next).toMatchObject({ longRunDay: 'sat', runDays: ['tue', 'thu', 'sat'] });
  });
  it('weekly miles: set, changed, held to 3 to 150', () => {
    expect(apply(answers, { weeklyMilesChange: 5 }).next.weeklyMiles).toBe(25);
    expect(apply(answers, { weeklyMilesChange: -30 })).toMatchObject({ next: { weeklyMiles: 3 }, notes: [{ reason: 'miles_min', value: 3 }] });
    expect(apply(answers, { weeklyMilesChange: 500 })).toMatchObject({ next: { weeklyMiles: 150 }, notes: [{ reason: 'miles_max', value: 150 }] });
  });
  it('the peak never sits under the weekly miles, and null gives it back to the plan', () => {
    expect(apply(answers, { peakMiles: 35 })).toMatchObject({ next: { peakMiles: 35 }, changes: [{ field: 'peakMiles', miles: 35 }] });
    expect(apply(answers, { peakMiles: 12 })).toMatchObject({ next: { peakMiles: 20 }, notes: [{ reason: 'peak_below_now', value: 20 }] });
    expect(apply({ ...answers, peakMiles: 25 }, { weeklyMiles: 30 }).next).toMatchObject({ weeklyMiles: 30, peakMiles: 30 });
    expect(apply({ ...answers, peakMiles: 25 }, { peakMiles: null })).toMatchObject({ next: { peakMiles: null }, changes: [{ field: 'peakMiles', miles: null }] });
  });
  it('the start: tomorrow, next Monday, or a named day after today', () => {
    expect(apply(answers, { start: 'tomorrow' })).toMatchObject({ next: { soon: true, startDate: null }, changes: [{ field: 'start', date: '2026-11-12', soon: true }] });
    expect(apply({ ...answers, soon: true }, { start: 'monday' })).toMatchObject({ next: { soon: false }, changes: [{ field: 'start', date: '2026-11-16', soon: false }] });
    expect(apply(answers, { startDate: '2026-12-01' })).toMatchObject({ next: { startDate: '2026-12-01', soon: false }, changes: [{ field: 'start', date: '2026-12-01', soon: false }] });
    expect(apply(answers, { startDate: T })).toMatchObject({ next: answers, notes: [{ reason: 'start_past' }] });
    expect(apply({ ...answers, startDate: '2026-12-21' }, { start: 'monday' }).next.startDate).toBeNull();
  });
  it('never hands back the same arrays it was given', () => {
    const r = apply(answers, {});
    expect(r.next.runDays).not.toBe(answers.runDays);
    expect(r.next).toEqual(answers);
  });
});
