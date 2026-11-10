import { describe, expect, it } from 'vitest';
import { firstGrapheme, initialOf, sameName } from './initial';

describe('a habit’s initial', () => {
  it('is the whole first emoji, never half of one', () => {
    expect(initialOf('🧘 Yoga')).toEqual({ text: '🧘', kind: 'emoji' });
    // a skin tone, a joined family and a flag are each one mark
    expect(firstGrapheme('👍🏽 Praise')).toBe('👍🏽');
    expect(firstGrapheme('👨‍👩‍👧 Family dinner')).toBe('👨‍👩‍👧');
    expect(initialOf('🇺🇸 Vote')).toEqual({ text: '🇺🇸', kind: 'emoji' });
    expect(initialOf('❤️ Call mom').kind).toBe('emoji');
  });
  it('tells a digit from a letter', () => {
    expect(initialOf('10,000 steps')).toEqual({ text: '1', kind: 'digit' });
    expect(initialOf('  Read')).toEqual({ text: 'R', kind: 'letter' });
    expect(initialOf('Éire walk')).toEqual({ text: 'É', kind: 'letter' });
  });
  it('is empty for an empty name', () => {
    expect(initialOf('   ').text).toBe('');
  });
});

describe('a name that is taken', () => {
  it('is found whatever its case or outer spaces, and given back as it is written', () => {
    expect(sameName(' meditate ', ['Read', 'Meditate'])).toBe('Meditate');
    expect(sameName('Stretch', ['Read', 'Meditate'])).toBeNull();
    expect(sameName('  ', ['Read'])).toBeNull();
  });
});
