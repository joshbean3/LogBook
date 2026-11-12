import { isISODate, type Learning } from '@logbook/shared';

/** A write still waiting in the outbox, as far as this file reads it (`OutboxItem`, api/outbox.ts). */
export interface QueuedWrite {
  path: string;
  method: string;
  json?: unknown;
  /** The provisional id of the line a queued create made. */
  tmpId?: string;
  createdAt: string;
  /** Set once the write went on the wire: it may have reached the server with only the answer lost. */
  sentAt?: string;
}

const ONE = /^\/learnings\/([^/?]+)$/;
const RESTORE = /^\/learnings\/([^/?]+)\/restore$/;
const textOf = (json: unknown): string | null => {
  const t = json && typeof json === 'object' ? (json as { text?: unknown }).text : null;
  return typeof t === 'string' && t.trim() ? t : null;
};

/**
 * A list the server has just answered, with the changes still waiting in the outbox laid over it. The server does not
 * know them yet (it was down, busy, or the phone was offline), so its answer alone would take tonight's line off the page
 * while "Waiting to sync" shows, bring back a line that was deleted, or undo an edit. The queue is read in order: a waiting
 * create is a line under its provisional id (on the first page of a list it `fits`), a waiting edit changes the words, a
 * waiting delete removes the line and a waiting Undo of that delete keeps it. A create that went on the wire and whose
 * line the server already has (the answer was lost) is not shown twice. Pure: the caller passes `outbox.peek()`.
 */
export const withQueued = (rows: readonly Learning[], queue: readonly QueuedWrite[], opts: { fits: (l: Learning) => boolean; first: boolean }): Learning[] => {
  let out = [...rows];
  const gone = new Set<string>();
  for (const w of queue) {
    if (!w || typeof w.path !== 'string') continue;
    if (w.method === 'POST' && w.path === '/learnings') {
      const text = textOf(w.json);
      const date = (w.json as { date?: unknown } | null)?.date;
      if (!w.tmpId || !text || !isISODate(date) || !opts.first || out.some((x) => x.id === w.tmpId)) continue;
      const l: Learning = { id: w.tmpId, date, text, createdAt: w.createdAt, editedAt: null };
      if (!opts.fits(l)) continue;
      if (w.sentAt && out.some((x) => !x.id.startsWith('tmp-') && x.date === date && x.text === text)) continue;
      out.push(l);
      continue;
    }
    const restore = w.method === 'POST' ? RESTORE.exec(w.path) : null;
    if (restore) {
      gone.delete(restore[1]!);
      continue;
    }
    const id = ONE.exec(w.path)?.[1];
    if (!id) continue;
    if (w.method === 'DELETE') gone.add(id);
    if (w.method === 'PATCH') {
      const text = textOf(w.json);
      if (text) out = out.map((x) => (x.id === id ? { ...x, text, editedAt: w.createdAt } : x));
    }
  }
  return gone.size ? out.filter((x) => !gone.has(x.id)) : out;
};
