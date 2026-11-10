import { describe, expect, it } from 'vitest';
import { rowName } from './format';

describe('rowName', () => {
  it('starts with the printed title', () => {
    expect(rowName('Sam', 'Sam. Your profile')).toBe('Sam. Your profile');
    expect(rowName('Timings', 'Morning routine timings')).toBe('Timings. Morning routine timings');
    expect(rowName('Run days', 'Run days: Tue Thu Sat')).toBe('Run days: Tue Thu Sat');
    expect(rowName('Import', 'Import a file')).toBe('Import a file');
  });
  it('leaves no label alone, and a title that is not words', () => {
    expect(rowName('Sam', undefined)).toBeUndefined();
    expect(rowName(null, 'Plans')).toBe('Plans');
  });
});
