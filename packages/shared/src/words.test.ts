import { describe, expect, it } from 'vitest';
import { act, sess, snapOf } from './fixtures.js';
import { morningDayFor, MORNING_DEFAULTS } from './morning.js';
import { dayPhase } from './phase.js';
import { STATUS_WORD } from './sessions.js';
import { dayKey, dayStatus, dayWord, heroSession, sessionKey, sessionStatus, sessionWord, STATUS_WORDS, statusKey } from './status.js';
import type { DayStatus, SessionStatus } from './types.js';

/**
 * Audit §2.1: the Today hero and the Training row disagreed on the same session.
 * The hero (DayView.tsx `Hero`) took `dayStatus(snap, date)` (the whole day) and printed it under the run's title;
 * the row (SessionCard.tsx `SessionRow`) took `sessionStatus(snap, date, s)` (that session). On a day where one
 * session counted and another didn't, the day rolls up to Floor while the run itself is Missed.
 */
describe('one status source (audit §2.1)', () => {
  // the owner's Oct 11, seen on Oct 14: Easy 6 planned with nothing recorded, Strength done (two sets logged)
  const easy = sess({ id: 'easy6', date: '2026-10-11', kind: 'run', type: 'Easy', miles: 6, details: 'Easy Miles' });
  const strength = sess({ id: 'str', date: '2026-10-11', kind: 'lift', type: 'Strength', title: 'Strength' });
  const S = snapOf([easy, strength], [], '2026-10-14', { '2026-10-11': 2 });
  const d = '2026-10-11';

  it('reproduces the bug with the calls the web makes today', () => {
    const heroBefore = STATUS_WORD[dayStatus(S, d)]; // DayView Hero: Chip {STATUS_WORD[st]} with st = dayStatus
    const rowBefore = STATUS_WORD[sessionStatus(S, d, easy)]; // SessionRow: Chip {STATUS_WORD[st]} with st = sessionStatus
    expect(heroBefore).toBe('Floor');
    expect(rowBefore).toBe('Missed');
    expect(heroBefore).not.toBe(rowBefore);
  });

  it('sessionWord gives the hero and the row one word for the same session', () => {
    const main = heroSession(S.sessionsOn(d)); // what the hero leads with
    expect(main).toBe(easy);
    expect(sessionWord(S, d, main)).toBe('Missed'); // hero
    expect(sessionWord(S, d, easy)).toBe('Missed'); // row
    expect(sessionWord(S, d, strength)).toBe('Done');
    const ph = dayPhase({ date: '2026-10-14', minutes: 600 }, { date: d, snapshot: S, settings: MORNING_DEFAULTS });
    expect(ph.phase).toBe('past');
    expect(ph.word).toBe('Missed');
    expect(ph.sessions.map((x) => x.word)).toEqual(['Missed', 'Done']);
    // the day as a whole is still a Floor day (the week ring), which is a different object
    expect(dayWord(S, d)).toBe('Floor');
  });

  it('an unplanned run is Bonus in the hero and in its sheet (was BONUS vs DONE)', () => {
    const U = snapOf([], [act('2026-10-12', 3)], '2026-10-14');
    expect(STATUS_WORD[dayStatus(U, '2026-10-12')]).toBe('Bonus'); // old hero
    // the old unplanned sheet passed status 'done' when there was no session (shareDataFor / UnplannedSheet)
    expect(sessionWord(U, '2026-10-12', null)).toBe('Bonus');
    expect(dayWord(U, '2026-10-12')).toBe('Bonus');
  });

  it('a day with nothing planned is Rest everywhere (was Open on Today, Rest on Morning)', () => {
    const E = snapOf([], [], '2026-10-14');
    expect(STATUS_WORD[dayStatus(E, '2026-10-14')] || 'Open').toBe('Open'); // the old hero's fallback
    expect(morningDayFor([], null, MORNING_DEFAULTS).mode).toBe('rest'); // Morning
    expect(sessionWord(E, '2026-10-14', null)).toBe('Rest');
    expect(dayWord(E, '2026-10-14')).toBe('Rest');
    expect(sessionWord(E, '2026-10-14', heroSession([]))).toBe('Rest');
  });

  it('speaks the eight words: Planned, Today, Done, Floor, Missed, Skipped, Rest, Bonus', () => {
    const today = '2026-10-14';
    const list = [
      sess({ id: 'a', date: '2026-10-13', kind: 'run', miles: 5 }),
      sess({ id: 'b', date: today, kind: 'run', miles: 5 }),
      sess({ id: 'c', date: '2026-10-15', kind: 'run', miles: 5 }),
      sess({ id: 'd', date: '2026-10-12', kind: 'run', miles: 5, mark: 'skip' }),
      sess({ id: 'e', date: '2026-10-12', kind: 'lift', mark: 'sick' }),
      sess({ id: 'f', date: '2026-10-11', kind: 'rest' }),
      sess({ id: 'g', date: '2026-10-10', kind: 'run', miles: 10 }),
      sess({ id: 'h', date: '2026-10-09', kind: 'run', miles: 4 }),
    ];
    const S2 = snapOf(list, [act('2026-10-10', 6), act('2026-10-09', 4.2)], today);
    const w = (id: string) => sessionWord(S2, list.find((s) => s.id === id)!.date, list.find((s) => s.id === id)!);
    expect(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map(w)).toEqual(['Missed', 'Today', 'Planned', 'Skipped', 'Skipped', 'Rest', 'Floor', 'Done']);
    expect(Object.values(STATUS_WORDS).sort()).toEqual(['Bonus', 'Done', 'Floor', 'Missed', 'Planned', 'Rest', 'Skipped', 'Today']);
    const all: Array<SessionStatus | DayStatus> = ['done', 'floor', 'skipped', 'missed', 'open', 'upcoming', 'rest', 'bonus', 'empty'];
    for (const st of all) expect(STATUS_WORDS[statusKey(st)]).toBeTruthy();
    expect(sessionKey(S2, today, list[1])).toBe('today');
    expect(dayKey(S2, '2026-10-15')).toBe('planned');
    // the legacy table now says Today too
    expect(STATUS_WORD.open).toBe('Today');
  });

  it('the hero leads with a run that is not skipped, then other training, then anything', () => {
    const lift = sess({ id: 'l', date: '2026-10-14', kind: 'lift' });
    const runSkipped = sess({ id: 'r', date: '2026-10-14', kind: 'run', miles: 4, mark: 'skip' });
    const rest = sess({ id: 'x', date: '2026-10-14', kind: 'rest' });
    expect(heroSession([lift, runSkipped])).toBe(lift);
    expect(heroSession([rest, runSkipped])).toBe(runSkipped);
    expect(heroSession([rest])).toBe(rest);
    expect(heroSession([])).toBeNull();
  });

  it('a skipped run is not on the morning', () => {
    const r = sess({ date: '2026-10-14', kind: 'run', type: 'Easy', miles: 5, mark: 'sick' });
    expect(morningDayFor([r], null, MORNING_DEFAULTS).mode).toBe('rest');
    expect(morningDayFor([r], null, MORNING_DEFAULTS).plan.label).toBe('Easy 5 skipped');
  });
});
