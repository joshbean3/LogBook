import { describe, expect, it } from 'vitest';
import { helloGreeting, helloLine, helloName } from './hello';

describe('the assistant\'s greeting', () => {
  it('greets by the hour, and before 5 it is still the evening', () => {
    expect(helloGreeting(0)).toBe('Good evening');
    expect(helloGreeting(4)).toBe('Good evening');
    expect(helloGreeting(5)).toBe('Good morning');
    expect(helloGreeting(11)).toBe('Good morning');
    expect(helloGreeting(12)).toBe('Good afternoon');
    expect(helloGreeting(16)).toBe('Good afternoon');
    expect(helloGreeting(17)).toBe('Good evening');
    expect(helloGreeting(23)).toBe('Good evening');
  });
  it('uses the first word of the name, and none when there is no name', () => {
    expect(helloName('Sam')).toBe('Sam');
    expect(helloName('  Sam   Rivera ')).toBe('Sam');
    expect(helloName('')).toBe('');
    expect(helloName('   ')).toBe('');
    expect(helloName(null)).toBe('');
    expect(helloName(undefined)).toBe('');
  });
  it('says the line whole', () => {
    expect(helloLine('Sam', 7)).toBe('Good morning, Sam.');
    expect(helloLine('Sam Rivera', 13)).toBe('Good afternoon, Sam.');
    expect(helloLine('', 7)).toBe('Good morning.');
    expect(helloLine(null, 20)).toBe('Good evening.');
  });
});
