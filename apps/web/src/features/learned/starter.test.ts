import { describe, expect, it } from 'vitest';
import { ALL_STARTERS, hasOwnWords, isStarterOnly, lineStarter, PLAIN_STARTER } from './starter';

const bike = { kind: 'cross' as const, type: 'Bike', title: null };

describe('the field’s first words', () => {
  it('starts from today’s done session when Fitness is on', () => {
    expect(lineStarter({ fitness: true, session: bike, habit: 'Stretch', goal: 'Call the bank' })).toEqual({ text: 'On the bike today I learned', note: 'From today’s bike' });
    expect(lineStarter({ fitness: true, session: { kind: 'run', type: 'Easy', title: null } })).toEqual({ text: 'On my run today I learned', note: 'From today’s run' });
    expect(lineStarter({ fitness: true, session: { kind: 'lift', type: null, title: 'Lower body' } }).note).toBe('From today’s lift');
    expect(lineStarter({ fitness: true, session: { kind: 'cross', type: null, title: 'Swim 30 min' } }).note).toBe('From today’s swim');
    expect(lineStarter({ fitness: true, session: { kind: 'cross', type: 'Yoga', title: null } }).note).toBe('From today’s workout');
  });

  it('a rest day is not a session to start from', () => {
    expect(lineStarter({ fitness: true, session: { kind: 'rest', type: null, title: null }, habit: 'Stretch' }).note).toBe('From today’s habits');
  });

  it('then a habit done today, then today’s goal, then the plain start', () => {
    expect(lineStarter({ fitness: true, session: null, habit: 'Read 15 min', goal: 'Call the bank' })).toEqual({ text: 'Keeping my habits today I learned', note: 'From today’s habits' });
    expect(lineStarter({ fitness: true, habit: null, goal: 'Call the bank' })).toEqual({ text: 'Working on today’s goal I learned', note: 'From today’s goal' });
    expect(lineStarter({ fitness: true })).toEqual(PLAIN_STARTER);
    expect(lineStarter({ fitness: true, habit: '  ', goal: '' })).toEqual({ text: 'Today I learned', note: null });
  });

  it('never mentions training with Fitness off', () => {
    const words = /\b(run|runs|running|lift|lifting|bike|workout|pool|swim|training|fitness|plan)\b/i;
    for (const session of [bike, { kind: 'run' as const, type: 'Long', title: null }, { kind: 'lift' as const, type: null, title: null }, { kind: 'cross' as const, type: 'Swim', title: null }]) {
      for (const rest of [{}, { habit: 'Stretch' }, { goal: 'Call the bank' }, { habit: 'Stretch', goal: 'Call the bank' }]) {
        const s = lineStarter({ fitness: false, session, ...rest });
        expect(`${s.text} ${s.note ?? ''}`).not.toMatch(words);
      }
    }
    expect(lineStarter({ fitness: false, session: bike })).toEqual(PLAIN_STARTER);
    expect(lineStarter({ fitness: false, session: bike, habit: 'Stretch' }).note).toBe('From today’s habits');
  });

  it('knows the starter alone is not yet a line', () => {
    const s = lineStarter({ fitness: true, session: bike });
    expect(hasOwnWords('', s)).toBe(false);
    expect(hasOwnWords('On the bike today I learned ', s)).toBe(false);
    expect(hasOwnWords('On the bike today I learned that the first ten minutes always lie.', s)).toBe(true);
    expect(hasOwnWords('Rest is training too.', s)).toBe(true);
  });
});

describe('a starter is never a line of its own', () => {
  it('whichever starter it was: the day can change what the field starts with after it was touched', () => {
    // the field was touched while it read "Today I learned", then a habit was checked off: the old starter is still not a line
    const now = lineStarter({ fitness: true, habit: 'Stretch' });
    expect(hasOwnWords('Today I learned', now)).toBe(false);
    expect(hasOwnWords('On my run today I learned ', now)).toBe(false);
    for (const s of ALL_STARTERS) {
      expect(isStarterOnly(s)).toBe(true);
      expect(isStarterOnly(` ${s}  `)).toBe(true);
      expect(isStarterOnly(`${s} x`)).toBe(false);
    }
    expect(isStarterOnly('')).toBe(true);
    expect(isStarterOnly('   \n ')).toBe(true);
    expect(isStarterOnly('x')).toBe(false);
  });

  it('lists every starter the field can show', () => {
    const made = new Set<string>();
    for (const fitness of [true, false])
      for (const session of [null, { kind: 'run' as const }, { kind: 'lift' as const }, { kind: 'cross' as const, type: 'Bike' }, { kind: 'cross' as const, title: 'Swim' }, { kind: 'cross' as const, type: 'Yoga' }, { kind: 'rest' as const }, { kind: 'nap' as never }])
        for (const habit of [null, 'Stretch'])
          for (const goal of [null, 'Call the bank']) made.add(lineStarter({ fitness, session, habit, goal }).text);
    expect([...made].sort()).toEqual([...ALL_STARTERS].sort());
  });

  it('a name of any length or script changes nothing: the starter never prints it', () => {
    for (const name of ['x'.repeat(200), '🔥🔥🔥', 'تمرين', '<b>bold</b>', '\n\n']) {
      const h = lineStarter({ fitness: true, habit: name });
      const g = lineStarter({ fitness: true, goal: name });
      for (const s of [h, g]) {
        expect(ALL_STARTERS).toContain(s.text);
        expect(`${s.text}${s.note ?? ''}`).not.toContain(name.trim() || 'never');
      }
    }
    expect(lineStarter({ fitness: true, habit: '\n\n', goal: ' ' })).toEqual(PLAIN_STARTER);
  });

  it('a session of a kind this build does not know starts the plain way, or from the next thing in the day', () => {
    expect(lineStarter({ fitness: true, session: { kind: 'nap' as never, type: null, title: null } })).toEqual(PLAIN_STARTER);
    expect(lineStarter({ fitness: true, session: { kind: undefined as never }, habit: 'Stretch' }).note).toBe('From today’s habits');
    expect(lineStarter({ fitness: true, session: { kind: 'cross', type: 42 as never, title: {} as never } }).note).toBe('From today’s workout');
  });
});
