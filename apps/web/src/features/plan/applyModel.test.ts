import { describe, expect, it } from 'vitest';
import { applyChoice, draftMonths, mayDraft, replacedBy, type CalendarLike } from './applyModel';

type Row = { id: string; date: string; mark: 'done' | 'floor' | 'skip' | null };
const calendar = (months: string[], rows: Row[]): CalendarLike => ({
  loaded: (m) => months.includes(m),
  sessionsOn: (d) => rows.filter((r) => r.date === d),
});

describe('the AI plan preview', () => {
  // today is in November; the draft starts in a later month (the default start is next Monday)
  const draft = { start: '2026-12-07', end: '2026-12-20' };
  const rows: Row[] = [
    { id: 'a', date: '2026-12-08', mark: null },
    { id: 'b', date: '2026-12-10', mark: null },
    { id: 'c', date: '2026-12-12', mark: 'done' },
    { id: 'd', date: '2026-12-13', mark: 'skip' },
    { id: 'e', date: '2026-12-21', mark: null },
    { id: 'f', date: '2026-11-30', mark: null },
  ];

  it('needs every month of the draft, not the month on screen', () => {
    expect(draftMonths(draft)).toEqual(['2026-12']);
    expect(draftMonths({ start: '2026-11-30', end: '2027-02-07' })).toEqual(['2026-11', '2026-12', '2027-01', '2027-02']);
  });

  it('does not know the count until the draft’s months are loaded, and offers no button', () => {
    const cal = calendar(['2026-11'], rows);
    expect(replacedBy(cal, draft)).toBeNull();
    expect(applyChoice(replacedBy(cal, draft), false)).toEqual({ primary: null, keep: false });
  });

  it('counts a later month’s sessions as the server does: unmarked ones in range', () => {
    const cal = calendar(['2026-11', '2026-12'], rows);
    expect(replacedBy(cal, draft)).toEqual(['a', 'b']);
    expect(applyChoice(replacedBy(cal, draft), false)).toEqual({ primary: { label: 'Replace 2 sessions', mode: 'replace' }, keep: true });
  });

  it('says Add to my plan, and sends add, only when nothing would be replaced', () => {
    const cal = calendar(['2026-12'], rows.filter((r) => r.mark));
    expect(replacedBy(cal, draft)).toEqual([]);
    expect(applyChoice([], false)).toEqual({ primary: { label: 'Add to my plan', mode: 'add' }, keep: false });
  });

  it('counts one session in the singular, and a revision has no keep', () => {
    expect(applyChoice(['a'], false).primary?.label).toBe('Replace 1 session');
    expect(applyChoice(['a', 'b'], true)).toEqual({ primary: { label: 'Replace 2 sessions', mode: 'replace' }, keep: false });
  });

  it('waits for a draft that spans a month that is still loading', () => {
    const cal = calendar(['2026-12'], rows);
    expect(replacedBy(cal, { start: '2026-12-28', end: '2027-01-10' })).toBeNull();
  });
});

describe('the permission step', () => {
  it('lets a draft go only after the account has answered', () => {
    expect(mayDraft(null)).toBe(false);
    expect(mayDraft(undefined)).toBe(false);
    expect(mayDraft({ at: null })).toBe(false);
    expect(mayDraft({ at: '2026-11-10T09:00:00.000Z' })).toBe(true);
  });
});
