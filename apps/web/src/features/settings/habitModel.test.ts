import { describe, expect, it } from 'vitest';
import { atCap, cleanName, HABIT_CAP, habitLine, renameProblem, sameName } from './habitModel';

const list = [
  { id: 'a', name: 'Read' },
  { id: 'b', name: 'Stretch' },
  { id: 'c', name: 'Floss', archivedOn: '2026-11-01' },
];

describe('habit names', () => {
  it('refuses a rename to another live habit’s name, in any case', () => {
    expect(renameProblem('stretch ', list, 'a')).toBe('Stretch is already on Today.');
    expect(renameProblem('Read', list, 'a')).toBeNull();
    expect(renameProblem('Floss', list, 'a')).toBeNull();
    expect(renameProblem('Walk', list, 'a')).toBeNull();
  });
  it('cleans spaces', () => {
    expect(cleanName('  Read   15  min ')).toBe('Read 15 min');
    expect(sameName('READ', list)?.id).toBe('a');
  });
});

describe('the cap', () => {
  it('stops at 12 live habits; archived ones do not count', () => {
    const many = Array.from({ length: HABIT_CAP }, (_, i) => ({ id: `h${i}`, name: `H${i}` }));
    expect(HABIT_CAP).toBe(12);
    expect(atCap(many)).toBe(true);
    expect(atCap(many.slice(1))).toBe(false);
    expect(atCap([...many.slice(1), { id: 'x', name: 'X', archivedOn: '2026-11-01' }])).toBe(false);
  });
});

describe('the Settings row line', () => {
  it('names two habits and counts the rest', () => {
    expect(habitLine(['Meditate'])).toBe('Meditate');
    expect(habitLine(['Meditate', 'Read'])).toBe('Meditate and Read');
    expect(habitLine(['Meditate', 'Read', 'Guitar'])).toBe('Meditate, Read and 1 more');
    expect(habitLine(['Meditate', 'Read', 'A', 'B', 'C', 'D', 'E'])).toBe('Meditate, Read and 5 more');
  });
});
