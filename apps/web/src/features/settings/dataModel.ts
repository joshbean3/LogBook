/**
 * The Data page's words and the checks Import runs before it sends a file. Kept free of React so they can be tested.
 */

/** What Export writes, and no more (the export holds the plan, habits, goals, journal and to-dos, among others). */
export const EXPORT_SUB = 'Your plan, habits, goals, journal and to-dos, as one JSON file.';
export const IMPORT_SUB = 'An Orby export file (JSON).';

/** The server takes a file up to 20 MB (ws-01, settings-15); a bigger one is refused here before it is sent. */
export const IMPORT_MAX_BYTES = 20 * 1024 * 1024;

export const IMPORT_TOO_BIG = 'That file is too big.';
export const IMPORT_NOT_OURS = 'That file isn’t an Orby export.';
export const IMPORT_FAILED = 'Import didn’t finish. Try again.';
export const IMPORT_NOTHING_NEW = 'Nothing new: it was all here already.';

/** The keys of the original Logbook bundle (routes/import.ts). A file with none of them is not one. */
const LEGACY_KEYS = ['habits', 'blocks', 'plans', 'logs', 'lifts', 'journal', 'morning', 'todos', 'picks', 'quotes_mine'];

export type ImportKind = 'v2' | 'legacy';

/** Which kind of Logbook file this is, or null when it is not one (an empty object, some other app's JSON). */
export const importKind = (json: unknown): ImportKind | null => {
  if (!json || typeof json !== 'object' || Array.isArray(json)) return null;
  const o = json as Record<string, unknown>;
  if (o.version === 2) return 'v2';
  if (o.version != null && o.version !== 1) return null;
  return LEGACY_KEYS.some((k) => o[k] != null) ? 'legacy' : null;
};

/** The line for a failed import: a status from the server (413 too big, 422 not a Logbook file) or anything else. */
export const importError = (status: number | null): string => (status === 413 ? IMPORT_TOO_BIG : status === 422 || status === 400 ? IMPORT_NOT_OURS : IMPORT_FAILED);

const WORDS: Record<string, [string, string]> = {
  habits: ['habit', 'habits'],
  checks: ['habit check', 'habit checks'],
  blocks: ['plan', 'plans'],
  sessions: ['session', 'sessions'],
  activities: ['activity', 'activities'],
  lifts: ['lift set', 'lift sets'],
  goals: ['goal', 'goals'],
  goalEvents: ['goal update', 'goal updates'],
  journal: ['journal entry', 'journal entries'],
  learnings: ['learning', 'learnings'],
  todos: ['to-do', 'to-dos'],
  todoGroups: ['to-do list', 'to-do lists'],
  links: ['saved link', 'saved links'],
  reads: ['saved link', 'saved links'],
  quotes: ['quote', 'quotes'],
  quotePrefs: ['quote preference', 'quote preferences'],
  morningDays: ['morning', 'mornings'],
  dayTags: ['day tag', 'day tags'],
};
/** Counts that are one account setting each (the name, the training answers, a stored setting): "your settings". */
const SETTING_KEYS = new Set(['name', 'settings', 'trainingProfile', 'morning']);

const count = (n: number, [one, many]: [string, string]) => `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`;

/** The line for a finished import, from the server's counts. Call it only for a file already known to be ours. */
export const importDone = (imported: Record<string, number> | undefined): string => {
  const parts: string[] = [];
  let settings = false;
  let other = 0;
  for (const [k, n] of Object.entries(imported ?? {})) {
    if (!n) continue;
    const w = WORDS[k];
    if (w) parts.push(count(n, w));
    else if (SETTING_KEYS.has(k)) settings = true;
    else other += n;
  }
  if (other) parts.push(count(other, ['other item', 'other items']));
  if (settings) parts.push('your settings');
  return parts.length ? `Imported ${parts.join(', ')}.` : IMPORT_NOTHING_NEW;
};
