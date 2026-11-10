import { z } from 'zod';
import { fmtDate, type ISODate } from './dates.js';

/**
 * "Remember when" (the top of the Journal tab): one past journal entry or learning a day, brought back as a one-line
 * reminder. The server picks it (services/recall.ts) and keeps it for the day; the owner can ask for it more often, ask
 * for another, or hide it.
 */
export const zRecallKind = z.enum(['journal', 'learning']);
export type RecallKind = z.infer<typeof zRecallKind>;

/** `PUT /journal/recall/:kind/:id`: either or both. Un-hiding puts the item back as today's. */
export const zRecallPrefs = z.object({ boost: z.boolean().optional(), hidden: z.boolean().optional() }).refine((b) => b.boost !== undefined || b.hidden !== undefined, 'Send boost or hidden.');
export type RecallPrefs = z.infer<typeof zRecallPrefs>;

export interface RecallItem {
  kind: RecallKind;
  id: string;
  /** The day it was written. */
  date: ISODate;
  /** The first 200 characters of what was written. */
  excerpt: string;
  /** The reminder: the assistant's one or two sentences, or the plain fallback built from the text. */
  summary: string;
  /**
   * True when `summary` is the assistant's line (the card says "Written by AI"), false for the plain fallback. The
   * server always sends it; optional only so a client can still read an item from an older server.
   */
  ai?: boolean;
  boosted: boolean;
}

/** `GET /journal/recall`, `POST /journal/recall/another`, `PUT /journal/recall/:kind/:id`. */
export interface RecallState {
  item: RecallItem | null;
  /** How many items could be brought back today (age rule, not hidden), cooldown aside. */
  eligible: number;
}

/** `Oct 12`, or `Oct 12, 2025` when it is not this year. */
export const recallDay = (date: ISODate, today: ISODate): string => (date.slice(0, 4) === today.slice(0, 4) ? fmtDate('md', date) : `${fmtDate('md', date)}, ${date.slice(0, 4)}`);
