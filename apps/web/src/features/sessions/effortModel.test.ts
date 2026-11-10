import { describe, expect, it } from 'vitest';
import { effortColor, effortLine, effortOf, effortWord, valueAt } from './effortModel';

describe('effort words', () => {
  it('says a number with its word and a plain line', () => {
    expect(effortLine(6)).toBe('6 · Steady: could talk in short sentences');
    expect(effortLine(10)).toBe('10 · All out: nothing left at the end');
    expect(effortWord(1)).toBe('Very easy');
    expect(effortLine(0)).toBe('');
  });
  it('reads only whole numbers from 1 to 10', () => {
    expect(effortOf(6)).toBe(6);
    for (const bad of [0, 11, 5.5, '6', null, undefined]) expect(effortOf(bad)).toBeNull();
  });
  it('runs from Columbia Blue at 1 to orange at 10', () => {
    expect(effortColor(1)).toBe('#cbe8f8');
    expect(effortColor(10)).toBe('#1b4870');
    expect(effortColor(5)).not.toBe(effortColor(6));
  });
});

describe('the dial', () => {
  const at = (deg: number) => valueAt(Math.cos((deg * Math.PI) / 180) * 50, Math.sin((deg * Math.PI) / 180) * 50);
  it('puts 1 at the lower left, 10 at the lower right and the middle at the top', () => {
    expect(at(152)).toBe(1);
    expect(at(28)).toBe(10);
    expect(at(265)).toBe(5); // straight up (270) is the boundary between 5 and 6
    expect(at(275)).toBe(6);
  });
  it('holds an end when the finger slides into the gap under the dial', () => {
    expect(at(80)).toBe(10);
    expect(at(100)).toBe(1);
    expect(valueAt(0, 0)).toBeNull();
  });
});
