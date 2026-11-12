import type { Learning } from '@logbook/shared';
import { describe, expect, it } from 'vitest';
import { withQueued, type QueuedWrite } from './queued';

const line = (id: string, date: string, text: string): Learning => ({ id, date, text, createdAt: `${date}T20:00:00.000Z`, editedAt: null });
const all = { fits: () => true, first: true };
const create = (tmpId: string, date: string, text: string, sentAt?: string): QueuedWrite => ({ path: '/learnings', method: 'POST', json: { date, text }, tmpId, createdAt: `${date}T21:00:00.000Z`, sentAt });

/**
 * A change the server could not take yet waits in the outbox. A list fetched meanwhile does not have it, and used to
 * replace the page's copy: tonight's line left the page while "Waiting to sync" showed, and the field came back empty.
 */
describe('a list answered while changes wait to sync', () => {
  it('keeps a line whose save is still waiting', () => {
    const out = withQueued([line('l1', '2026-11-10', 'Older.')], [create('tmp-a', '2026-11-12', 'The tide comes twice a day.')], all);
    expect(out.map((l) => [l.id, l.date, l.text])).toEqual([
      ['l1', '2026-11-10', 'Older.'],
      ['tmp-a', '2026-11-12', 'The tide comes twice a day.'],
    ]);
  });

  it('only on the first page, and only in a list it belongs to', () => {
    const q = [create('tmp-a', '2026-11-12', 'The tide comes twice a day.')];
    expect(withQueued([], q, { fits: () => true, first: false })).toEqual([]);
    expect(withQueued([], q, { fits: (l) => l.date.startsWith('2026-10-'), first: true })).toEqual([]);
  });

  it('shows the line once when the save reached the server and only its answer was lost', () => {
    const rows = [line('l9', '2026-11-12', 'The tide comes twice a day.')];
    expect(withQueued(rows, [create('tmp-a', '2026-11-12', 'The tide comes twice a day.', '2026-11-12T21:00:01.000Z')], all)).toEqual(rows);
    // never sent (written offline): the same words twice are two lines
    expect(withQueued(rows, [create('tmp-a', '2026-11-12', 'The tide comes twice a day.')], all)).toHaveLength(2);
  });

  it('keeps a waiting edit and a waiting delete', () => {
    const rows = [line('l1', '2026-11-10', 'One.'), line('l2', '2026-11-11', 'Two.')];
    const out = withQueued(
      rows,
      [
        { path: '/learnings/l1', method: 'PATCH', json: { text: 'One, changed.' }, createdAt: '2026-11-12T21:00:00.000Z' },
        { path: '/learnings/l2', method: 'DELETE', createdAt: '2026-11-12T21:00:01.000Z' },
      ],
      all,
    );
    expect(out.map((l) => l.text)).toEqual(['One, changed.']);
    expect(out[0]!.editedAt).toBe('2026-11-12T21:00:00.000Z');
  });

  it('an Undo that is waiting too brings the line back', () => {
    const rows = [line('l2', '2026-11-11', 'Two.')];
    const q: QueuedWrite[] = [
      { path: '/learnings/l2', method: 'DELETE', createdAt: 'a' },
      { path: '/learnings/l2/restore', method: 'POST', createdAt: 'b' },
    ];
    expect(withQueued(rows, q, all)).toEqual(rows);
  });

  it('follows a waiting line through its own edit and delete', () => {
    const q: QueuedWrite[] = [create('tmp-a', '2026-11-12', 'First words.'), { path: '/learnings/tmp-a', method: 'PATCH', json: { text: 'Better words.' }, createdAt: 'b' }];
    expect(withQueued([], q, all).map((l) => l.text)).toEqual(['Better words.']);
    expect(withQueued([], [...q, { path: '/learnings/tmp-a', method: 'DELETE', createdAt: 'c' }], all)).toEqual([]);
  });

  it('ignores what is not a change to a line, and a change in a bad shape', () => {
    const rows = [line('l1', '2026-11-10', 'One.')];
    const q: QueuedWrite[] = [
      { path: '/journal', method: 'POST', json: { date: '2026-11-12', text: 'An entry.' }, tmpId: 'tmp-j', createdAt: 'a' },
      { path: '/learnings', method: 'POST', json: { text: 42 }, tmpId: 'tmp-b', createdAt: 'b' },
      { path: '/learnings', method: 'POST', json: null, tmpId: 'tmp-c', createdAt: 'c' },
      { path: '/learnings/l1', method: 'PATCH', json: {}, createdAt: 'd' },
    ];
    expect(withQueued(rows, q, all)).toEqual(rows);
  });
});
