import type { JournalEntry } from '@logbook/shared';
import { describe, expect, it } from 'vitest';
import { cursorOf, HEAD_SIZE, journalOrder, mergeEntries, pagePath, pageUnder, totalOf, type PageParam } from './queries';

const e = (id: string, date: string, createdAt = `${date}T21:00:00.000Z`): JournalEntry => ({ id, date, text: id, createdAt, editedAt: null, fav: false });

/** perf-04: the Journal reads every entry, a page of 200 at a time. */
describe('journal feed helpers', () => {
  it('orders newest day first, newest entry first within a day', () => {
    const l = [e('a', '2026-03-01'), e('b', '2026-03-02', '2026-03-02T08:00:00.000Z'), e('c', '2026-03-02', '2026-03-02T20:00:00.000Z')].sort(journalOrder);
    expect(l.map((x) => x.id)).toEqual(['c', 'b', 'a']);
  });

  it('the cursor is the oldest createdAt of what the server has answered (never a provisional entry)', () => {
    expect(cursorOf([])).toBeNull();
    expect(cursorOf([e('tmp-1', '2026-11-10', '2020-01-01T00:00:00.000Z'), e('a', '2026-11-09'), e('b', '2026-04-24')])).toBe('2026-04-24T21:00:00.000Z');
    // an entry written today for an old day does not hold the cursor at today: it still moves back, so paging ends
    expect(cursorOf([e('a', '2026-11-09'), e('back', '2026-04-20', '2026-11-10T09:00:00.000Z'), e('b', '2026-04-24')])).toBe('2026-04-24T21:00:00.000Z');
  });

  it('merges pages into one list, each entry once, the first list winning', () => {
    const head = [{ ...e('a', '2026-11-09'), fav: true }, e('b', '2026-11-08')];
    const older = [e('a', '2026-11-09'), e('c', '2026-04-01'), e('d', '2026-05-01')];
    const out = mergeEntries(head, older);
    expect(out.map((x) => x.id)).toEqual(['a', 'b', 'd', 'c']);
    expect(out[0]!.fav).toBe(true);
  });

  const days = (n: number) =>
    Array.from({ length: n }, (_, i) => {
      const d = new Date(Date.UTC(2025, 8, 1) + i * 86_400_000).toISOString().slice(0, 10);
      return e(`j${i}`, d);
    });
  /** The feed's own walk: the first page, then `pageUnder` and the next-page rule until the server says there is no more. */
  const walk = (server: (p: PageParam | null) => { entries: JournalEntry[]; more: boolean }) => {
    const head = server(null);
    const start = head.more ? pageUnder(head.entries) : null;
    const pages: Array<{ entries: JournalEntry[]; more: boolean }> = [];
    let next = start;
    while (next && pages.length < 20) {
      const p = server(next);
      pages.push(p);
      const under = pages.flatMap((x) => x.entries);
      const before = cursorOf(under);
      next = p.more && before !== null ? { before: before < start!.before ? before : start!.before, offset: start!.offset + under.length } : null;
    }
    return { feed: mergeEntries(head.entries, ...pages.map((p) => p.entries)), pages };
  };

  it('pages through more than 200 entries with the before cursor and reaches every one', () => {
    // 430 entries, one a day, as the server pages them today (date desc, `before` on createdAt, `offset` ignored)
    const all = days(430).sort(journalOrder);
    const { feed, pages } = walk((p) => {
      const rows = all.filter((x) => !p || x.createdAt < p.before);
      return { entries: rows.slice(0, HEAD_SIZE), more: rows.length > HEAD_SIZE };
    });
    expect(pages).toHaveLength(2);
    expect(feed).toHaveLength(430);
    expect(new Set(feed.map((x) => x.id)).size).toBe(430);
    expect(feed.at(-1)!.date).toBe('2025-09-01');
  });

  it('sends the position too, so a server that pages by it also returns entries written later for an old day', () => {
    // 430 daily entries and one written today for the oldest stretch: `before` alone never reaches it
    const back = e('back', '2025-09-03', '2026-11-10T09:00:00.000Z');
    const all = [...days(430), back].sort(journalOrder);
    const byCursor = walk((p) => {
      const rows = all.filter((x) => !p || x.createdAt < p.before);
      return { entries: rows.slice(0, HEAD_SIZE), more: rows.length > HEAD_SIZE };
    });
    expect(byCursor.feed.some((x) => x.id === 'back')).toBe(false);
    const byPosition = walk((p) => {
      const rows = all.slice(p?.offset ?? 0);
      return { entries: rows.slice(0, HEAD_SIZE), more: rows.length > HEAD_SIZE };
    });
    expect(byPosition.feed).toHaveLength(431);
    expect(byPosition.feed.some((x) => x.id === 'back')).toBe(true);
    expect(pagePath({ before: '2026-04-24T21:00:00.000Z', offset: 200 })).toBe('/journal?q=&fav=0&limit=200&before=2026-04-24T21%3A00%3A00.000Z&offset=200');
  });

  it('knows the real total', () => {
    const page = (n: number, more: boolean, total?: number) => ({ entries: Array.from({ length: n }, (_, i) => e(`j${i}`, '2026-01-01')), more, total });
    expect(totalOf(undefined, 0, false)).toBeNull();
    // everything is in the first page
    expect(totalOf(page(23, false, 23), 23, false)).toBe(23);
    // the server's count, whatever is loaded
    expect(totalOf(page(200, true, 400), 200, true)).toBe(400);
    // an entry added on screen since that answer counts at once; one removed too
    expect(totalOf(page(201, true, 400), 201, true)).toBe(401);
    expect(totalOf(page(199, true, 400), 199, true)).toBe(399);
    // a server that does not send the count: not known until the last page is in
    expect(totalOf(page(200, true), 200, true)).toBeNull();
    expect(totalOf(page(200, true), 430, false)).toBe(430);
  });
});
