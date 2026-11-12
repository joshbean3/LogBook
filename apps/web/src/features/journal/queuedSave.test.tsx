import type { JournalEntry } from '@logbook/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MonthBundle } from '@/api/types';

/** What a write does: null is "queued" (offline, a 500, a 429, a timeout), a value is the server's answer. */
let onWrite: (path: string, method: string) => Promise<unknown> = async () => null;
let queue: unknown[] = [];
vi.mock('@/api/outbox', () => ({
  outbox: { peek: () => queue, subscribe: () => () => undefined, size: () => queue.length },
  write: async (path: string, method: string) => onWrite(path, method),
}));

import { keys, useJournalMutations } from '@/api/queries';
import { queuedEntries, withQueuedEntries } from './queries';

type Mutations = ReturnType<typeof useJournalMutations>;
const T = '2026-11-12';
const LIST = ['journal', '', false] as const;
const entry = (id: string, date: string, text: string): JournalEntry => ({ id, date, text, createdAt: `${date}T20:00:00.000Z`, editedAt: null, fav: false });
const month = (journal: JournalEntry[]): MonthBundle => ({ month: '2026-11', sessions: [], checks: [], lifts: [], activities: [], morningDays: {}, journal, coach: [] }) as unknown as MonthBundle;

/** The journal's writes, outside a screen: the hook is rendered once to get them. */
const setup = (journal: JournalEntry[] = []) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity, gcTime: Infinity } } });
  qc.setQueryData(keys.month('2026-11'), month(journal));
  qc.setQueryData(LIST, { entries: journal, more: false });
  let m: Mutations | null = null;
  const Probe = () => {
    m = useJournalMutations();
    return null;
  };
  renderToStaticMarkup(
    <QueryClientProvider client={qc}>
      <Probe />
    </QueryClientProvider>,
  );
  return { qc, m: m as unknown as Mutations };
};
const listed = (qc: QueryClient) => (qc.getQueryData<{ entries: JournalEntry[] }>(LIST)?.entries ?? []).map((e) => e.text);
const inMonth = (qc: QueryClient) => (qc.getQueryData<MonthBundle>(keys.month('2026-11'))?.journal ?? []).map((e) => e.text);

beforeEach(() => {
  onWrite = async () => null;
  queue = [];
});

/**
 * An entry saved while the server could not take it (a 500, a 429, a dropped connection) was queued, and then a refetch
 * replaced the lists with the server's, which did not have it: the entry left the page while it waited to sync.
 */
describe('a journal write that is waiting to sync', () => {
  it('asks for no refetch: the entry stays in the list and the month', async () => {
    const { qc, m } = setup();
    await m.add.mutateAsync({ date: T, text: 'An entry the server cannot take yet.' });
    expect(listed(qc)).toEqual(['An entry the server cannot take yet.']);
    expect(inMonth(qc)).toEqual(['An entry the server cannot take yet.']);
    expect(qc.getQueryState(LIST)?.isInvalidated).toBe(false);
  });

  it('an edit, a delete and an Undo that are waiting stand too', async () => {
    const a = entry('j1', '2026-11-10', 'One.');
    const b = entry('j2', '2026-11-11', 'Two.');
    const { qc, m } = setup([b, a]);
    await m.patch.mutateAsync({ entry: a, text: 'One, changed.' });
    await m.remove.mutateAsync(b);
    expect(listed(qc)).toEqual(['One, changed.']);
    expect(qc.getQueryState(LIST)?.isInvalidated).toBe(false);
    await m.restore.mutateAsync(b);
    expect(listed(qc).sort()).toEqual(['One, changed.', 'Two.']);
    expect(qc.getQueryState(LIST)?.isInvalidated).toBe(false);
  });

  it('refetches once the server has answered', async () => {
    const { qc, m } = setup();
    onWrite = async () => entry('j9', T, 'Saved.');
    await m.add.mutateAsync({ date: T, text: 'Saved.' });
    expect(qc.getQueryState(LIST)?.isInvalidated).toBe(true);
    // a delete the server answers with no body (204) is an answer too
    const { qc: qc2, m: m2 } = setup([entry('j1', T, 'One.')]);
    onWrite = async () => undefined;
    await m2.remove.mutateAsync(entry('j1', T, 'One.'));
    expect(qc2.getQueryState(LIST)?.isInvalidated).toBe(true);
  });
});

describe('the Journal’s list while an entry waits to sync', () => {
  const waiting = { path: '/journal', method: 'POST', json: { date: T, text: 'Written during an outage.' }, tmpId: 'tmp-a', createdAt: `${T}T21:00:00.000Z` };

  it('reads the entries still waiting from the outbox', () => {
    expect(queuedEntries([waiting, { path: '/learnings', method: 'POST', json: { date: T, text: 'A line.' }, tmpId: 'tmp-l', createdAt: 'x' }, { path: '/journal', method: 'POST', json: { text: 5 }, tmpId: 'tmp-b', createdAt: 'x' }, null])).toEqual([
      { id: 'tmp-a', date: T, text: 'Written during an outage.', createdAt: `${T}T21:00:00.000Z`, editedAt: null, fav: false },
    ]);
  });

  it('keeps one on the page when the server’s list comes back without it', () => {
    const server = [entry('j1', '2026-11-10', 'One.')];
    expect(withQueuedEntries(server, [waiting]).map((e) => e.text)).toEqual(['Written during an outage.', 'One.']);
    // already there (the page's own copy): once
    const mine = [entry('tmp-a', T, 'Written during an outage.'), ...server];
    expect(withQueuedEntries(mine, [waiting])).toHaveLength(2);
    // it went on the wire and the server has it (only the answer was lost): once
    expect(withQueuedEntries([entry('j2', T, 'Written during an outage.'), ...server], [{ ...waiting, sentAt: 'x' }])).toHaveLength(2);
    // a delete that is waiting behind it takes it away again
    expect(withQueuedEntries(server, [waiting, { path: '/journal/tmp-a', method: 'DELETE', createdAt: 'y' }]).map((e) => e.id)).toEqual(['j1']);
  });
});
