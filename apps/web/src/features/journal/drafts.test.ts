import { describe, expect, it } from 'vitest';
import { getDraft, hasDraft, setDraft, subscribeDrafts } from './drafts';

/** contracts §F: the drafts store Today's midnight rule reads (docs/feel.md §5.4). */
describe('drafts', () => {
  it('holds one draft per day, trims for hasDraft and tells subscribers', () => {
    const seen: string[] = [];
    const off = subscribeDrafts(() => seen.push(getDraft('2026-10-23')));
    expect(getDraft('2026-10-23')).toBe('');
    expect(hasDraft('2026-10-23')).toBe(false);
    setDraft('2026-10-23', '   ');
    expect(hasDraft('2026-10-23')).toBe(false);
    setDraft('2026-10-23', 'Two sentences.');
    expect(hasDraft('2026-10-23')).toBe(true);
    expect(hasDraft('2026-10-24')).toBe(false);
    setDraft('2026-10-23', 'Two sentences.');
    expect(seen).toEqual(['   ', 'Two sentences.']);
    off();
    setDraft('2026-10-23', '');
    expect(seen).toHaveLength(2);
    expect(getDraft('2026-10-23')).toBe('');
  });
});
