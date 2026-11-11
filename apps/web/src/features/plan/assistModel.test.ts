import { applyPlanPatch, type BuilderAnswers, type PlanChange } from '@logbook/shared';
import { describe, expect, it } from 'vitest';
import { ApiError, NetworkError } from '@/api/client';
import { ALREADY_SET, ASSIST_LINES, assistFailure, assistSaid, cannotWords, changeWords, flashKeys, reasonWords, setLine } from './assistModel';

const T = '2026-11-11';
const answers: BuilderAnswers = { goal: 'base', weeks: 8, runDays: ['mon', 'wed', 'fri', 'sat', 'sun'], longRunDay: 'sat', weeklyMiles: 20, peakMiles: null, soon: false, startDate: null, race: true, raceDay: 'sun' };
const plain = (s: string | null) => (s ?? '').replace(/ /g, ' ');
const none = { dropped: [], cannot: [], note: null };

describe('the line that says what changed', () => {
  it('reads the owner’s example the way the builder applied it', () => {
    const applied = applyPlanPatch(answers, { runsPerWeek: 4, longRunDay: 'sun', peakMiles: 35 }, T);
    expect(setLine(applied.changes)).toBe('Set 4 run days, long run Sunday, peak up to 35 mi.');
    expect(assistSaid(applied, { ...none, cannot: ['lifts'] })).toEqual({ set: 'Set 4 run days, long run Sunday, peak up to 35 mi.', notes: ['This plan holds runs only. Add lifts on the Plan tab.'] });
  });
  it('names each kind of change in plain words', () => {
    const each: Array<[PlanChange, string]> = [
      [{ field: 'goal', goal: 'half' }, 'goal half marathon'],
      [{ field: 'goal', goal: '10k' }, 'goal 10K'],
      [{ field: 'goal', goal: 'base' }, 'goal just running'],
      [{ field: 'runDays', days: ['mon', 'wed', 'fri'], named: true }, 'runs on Mon, Wed, Fri'],
      [{ field: 'runDays', days: ['mon', 'wed', 'fri'], named: false }, '3 run days'],
      [{ field: 'runDays', days: ['sun'], named: false }, '1 run day'],
      [{ field: 'runDays', days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'], named: true }, 'a run every day'],
      [{ field: 'longRunDay', day: 'sat' }, 'long run Saturday'],
      [{ field: 'weeks', weeks: 12 }, '12 weeks'],
      [{ field: 'raceDate', date: '2027-03-14' }, 'race day Mar 14'],
      [{ field: 'race', on: false }, 'no race day'],
      [{ field: 'race', on: true }, 'a race day'],
      [{ field: 'weeklyMiles', miles: 25 }, '25 mi a week now'],
      [{ field: 'peakMiles', miles: 35 }, 'peak up to 35 mi'],
      [{ field: 'peakMiles', miles: null }, 'the plan’s own peak'],
      [{ field: 'start', date: '2026-11-12', soon: true }, 'start tomorrow'],
      [{ field: 'start', date: '2026-12-21', soon: false }, 'start Dec 21'],
    ];
    for (const [c, words] of each) expect(plain(changeWords(c))).toBe(words);
    expect(setLine([])).toBeNull();
  });
  it('a race day with a length says both the day and the later start', () => {
    const applied = applyPlanPatch({ ...answers, goal: 'half', weeks: 12 }, { weeks: 12, raceDate: '2027-03-14' }, T);
    expect(plain(setLine(applied.changes))).toBe('Set race day Mar 14, start Dec 21.');
  });
  it('says so when nothing needed changing, and never claims a change that did not happen', () => {
    const same = applyPlanPatch(answers, { longRunDay: 'sat', weeklyMiles: 20 }, T);
    expect(assistSaid(same, none)).toEqual({ set: null, notes: [ALREADY_SET] });
    const cannot = applyPlanPatch(answers, {}, T);
    expect(assistSaid(cannot, { ...none, cannot: ['lifts', 'paces'] })).toEqual({ set: null, notes: ['This plan holds runs only. Add lifts on the Plan tab.', 'Paces aren’t set here.'] });
  });
  it('puts the assistant’s own sentence first, then what has no setting, then why a value moved; three at most, each once', () => {
    const applied = applyPlanPatch(answers, { weeksChange: 40, peakMiles: 5 }, T);
    const said = assistSaid(applied, { dropped: [{ reason: 'weeks_max', value: 30 }, { reason: 'race_past' }], cannot: ['workouts'], note: 'Rest if it hurts.' });
    expect(said.set).toBe('Set 30 weeks, peak up to 20 mi.');
    expect(said.notes).toEqual(['Rest if it hurts.', 'The plan picks each week’s workouts.', 'A plan runs 30 weeks at most.']);
  });
  it('has a sentence for every reason and every topic, with no dash and no British spelling', () => {
    const reasons = ['weeks_min', 'weeks_max', 'miles_min', 'miles_max', 'peak_max', 'peak_below_now', 'runs_min', 'runs_max', 'keep_one_day', 'race_past', 'race_too_soon', 'race_too_far', 'race_needs_distance', 'race_weeks_fit', 'start_past', 'start_too_far', 'bad_value'] as const;
    const all = [...reasons.map((reason) => reasonWords({ reason, value: 9 })), ...cannotWords(['lifts', 'cross', 'paces', 'workouts', 'other']), ...cannotWords(['cross']), ALREADY_SET, ...Object.values(ASSIST_LINES)];
    for (const s of all) {
      expect(s).toMatch(/^[A-Z].*\.$/);
      expect(s).not.toMatch(/[—–]|\bAI\b|coach|\bbot\b|colour|centre/);
    }
    expect(reasonWords({ reason: 'race_weeks_fit', value: 9 })).toBe('Only 9 weeks fit before race day.');
    expect(cannotWords(['cross'])).toEqual(['This plan holds runs only.']);
    expect(cannotWords([])).toEqual([]);
  });
});

describe('which controls show the change', () => {
  it('lists each control once, top to bottom; a race day also moves the weeks', () => {
    expect(flashKeys([{ field: 'longRunDay', day: 'sun' }, { field: 'runDays', days: ['sun'], named: false }, { field: 'goal', goal: 'half' }])).toEqual(['goal', 'days']);
    expect(flashKeys([{ field: 'raceDate', date: '2027-03-14' }, { field: 'start', date: '2026-12-21', soon: false }])).toEqual(['weeks', 'start', 'race']);
    expect(flashKeys([{ field: 'peakMiles', miles: 35 }, { field: 'weeklyMiles', miles: 22 }, { field: 'weeks', weeks: 9 }])).toEqual(['weeks', 'miles', 'peak']);
    expect(flashKeys([])).toEqual([]);
  });
});

describe('a request that did not go through', () => {
  const failed = (status: number, code: string | null = null) => assistFailure(new ApiError('server words that are never shown', status, code));
  it('asks for permission instead of a line when the account has not answered', () => {
    expect(failed(403, 'consent_required')).toEqual({ kind: 'consent' });
  });
  it('says nothing after Stop', () => {
    expect(failed(499, 'cancelled')).toEqual({ kind: 'stopped' });
  });
  it('has one plain line for each failure, with Try again where the same words can work', () => {
    expect(assistFailure(new NetworkError())).toEqual({ kind: 'line', line: ASSIST_LINES.offline, retry: true });
    expect(failed(503, 'claude_busy')).toEqual({ kind: 'line', line: ASSIST_LINES.busy, retry: true });
    expect(failed(503, 'claude_not_configured')).toEqual({ kind: 'line', line: ASSIST_LINES.unavailable, retry: true });
    expect(failed(429, 'rate_limited')).toEqual({ kind: 'line', line: ASSIST_LINES.limit, retry: true });
    // a few seconds: a request stopped a moment ago is still finishing on the server
    expect(assistFailure(new ApiError('x', 429, 'rate_limited', 5))).toEqual({ kind: 'line', line: ASSIST_LINES.finishing, retry: true });
    // the short window (5 minutes at most) can be tried again; the day's budget cannot, so it has no Try again
    expect(assistFailure(new ApiError('x', 429, 'rate_limited', 240))).toEqual({ kind: 'line', line: ASSIST_LINES.limit, retry: true });
    expect(assistFailure(new ApiError('x', 429, 'rate_limited', 6 * 3600))).toEqual({ kind: 'line', line: ASSIST_LINES.dayLimit, retry: false });
    expect(failed(500, 'internal')).toEqual({ kind: 'line', line: ASSIST_LINES.ours, retry: true });
    expect(failed(502, 'invalid_answer')).toEqual({ kind: 'line', line: ASSIST_LINES.invalid, retry: true });
    expect(failed(504, 'claude_timeout')).toEqual({ kind: 'line', line: ASSIST_LINES.slow, retry: true });
    expect(failed(0, 'timeout')).toEqual({ kind: 'line', line: ASSIST_LINES.slow, retry: true });
    expect(failed(422, 'refused')).toEqual({ kind: 'line', line: ASSIST_LINES.refused, retry: false });
    expect(failed(422, 'validation')).toEqual({ kind: 'line', line: ASSIST_LINES.tooLong, retry: false });
    expect(failed(401, 'unauthenticated')).toEqual({ kind: 'line', line: ASSIST_LINES.signIn, retry: false });
    expect(failed(403, 'forbidden')).toEqual({ kind: 'line', line: ASSIST_LINES.ours, retry: true });
    expect(assistFailure(new Error('a bug'))).toEqual({ kind: 'line', line: ASSIST_LINES.ours, retry: true });
  });
  it('a server that does not have the route yet (404, 405, 501) gets its own line, never a blank', () => {
    for (const status of [404, 405, 501]) expect(failed(status, status === 404 ? 'not_found' : null)).toEqual({ kind: 'line', line: ASSIST_LINES.missing, retry: true });
    expect(ASSIST_LINES.missing).toBe('The assistant can’t shape plans yet. Orby’s server needs an update.');
  });
  it('never shows the server’s own message', () => {
    for (const s of [400, 403, 404, 422, 429, 500, 503]) expect(JSON.stringify(failed(s))).not.toContain('server words');
  });
});
