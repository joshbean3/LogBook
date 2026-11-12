/**
 * What the Journal was asked to open on, from somewhere else: Today's row asks for the line field (or, once the line is
 * kept, the entry writer); a past light or Remember when asks a month's page for a day. It is held here between the tap
 * and the screen that answers it, which may not be mounted yet, and is taken once.
 */
export type JournalIntent = { kind: 'line' } | { kind: 'entry' } | { kind: 'day'; date: string };

let pending: JournalIntent | null = null;
const subs = new Set<() => void>();

export const journalIntent = {
  set: (i: JournalIntent): void => {
    pending = i;
    for (const f of [...subs]) f();
  },
  peek: (): JournalIntent | null => pending,
  /** The pending intent if it is of this kind; it is then gone. */
  take: <K extends JournalIntent['kind']>(kind: K): Extract<JournalIntent, { kind: K }> | null => {
    if (pending?.kind !== kind) return null;
    const p = pending as Extract<JournalIntent, { kind: K }>;
    pending = null;
    return p;
  },
  clear: (): void => {
    pending = null;
  },
  subscribe: (fn: () => void): (() => void) => {
    subs.add(fn);
    return () => void subs.delete(fn);
  },
};
