import { describe, expect, it } from 'vitest';
import { voiceHead, voiceLine } from './voice';

describe('voiceLine', () => {
  it('says a fade as a number and a next step', () => {
    expect(voiceLine('Faded: the second half was 16 s/mi slower (8:01–8:40).')).toBe('Second half 16 s/mi slower. Hold back early next time.');
  });
  it('leads with numbers', () => {
    expect(voiceLine('Full distance: 4.0 of 4 mi.')).toBe('4.0 of 4 mi. All of it.');
    expect(voiceLine('Short: 2.1 of 5 mi (42%).')).toBe('2.1 of 5 mi. Short, and it still counts.');
    expect(voiceLine('Easy effort held: averaged 142 bpm (Z2), under the 150 ceiling.')).toBe('142 bpm average (Z2), under the 150 ceiling. Easy, as planned.');
    expect(voiceLine('Threshold effort hit: averaged 168 bpm (Z4). 3 of 4 full miles reached Z3–Z4.')).toBe('168 bpm average (Z4). Right at threshold. 3 of 4 miles in Z3–Z4.');
  });
  it('passes unknown lines through', () => {
    expect(voiceLine('Something new.')).toBe('Something new.');
  });
  it('shortens the head', () => {
    expect(voiceHead('Full distance, effort on target')).toBe('Full distance · on target');
  });
});
