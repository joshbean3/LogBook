import type { AssistantChange, AssistantFileShown, AssistantProposal, AssistantTurn } from '@logbook/shared';

/**
 * Saved chats and server replies, checked before the sheet draws them. The app ships in a binary while the server and the
 * saved shape change, so a chat written by an older build (or a damaged one) must never stop the sheet from opening: what
 * does not have the shape the screen reads is dropped, the rest is kept.
 */
const isRec = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((s): s is string => typeof s === 'string') : []);

const STATUSES: readonly unknown[] = ['proposed', 'applied', 'dismissed', 'undone'];

const cleanChange = (v: unknown): AssistantChange | null => {
  if (!isRec(v) || typeof v.label !== 'string' || !isRec(v.op) || typeof v.op.op !== 'string') return null;
  return { op: v.op as AssistantChange['op'], label: v.label, ...(typeof v.reason === 'string' && v.reason ? { reason: v.reason } : {}) };
};

/** A proposal the card can draw, or null: it needs its id, its summary, a known status and a list of whole changes. */
export const cleanProposal = (v: unknown): AssistantProposal | null => {
  if (!isRec(v) || typeof v.id !== 'string' || typeof v.summary !== 'string' || !STATUSES.includes(v.status) || !Array.isArray(v.changes)) return null;
  const changes = v.changes.map(cleanChange);
  // a change that cannot be read makes the indexes (skipped, Apply's skip list) mean something else: no card at all
  if (changes.some((c) => c === null)) return null;
  const skipped = Array.isArray(v.skipped) ? v.skipped.filter((i): i is number => Number.isInteger(i) && i >= 0 && i < changes.length) : [];
  return { id: v.id, summary: v.summary, changes: changes as AssistantChange[], status: v.status as AssistantProposal['status'], ...(skipped.length ? { skipped } : {}) };
};

const cleanFile = (v: unknown): AssistantFileShown | null => {
  if (!isRec(v) || typeof v.name !== 'string' || typeof v.mediaType !== 'string') return null;
  return { name: v.name, mediaType: v.mediaType as AssistantFileShown['mediaType'], ...(typeof v.thumb === 'string' && v.thumb.startsWith('data:image/') ? { thumb: v.thumb } : {}) };
};

/**
 * A turn the thread can draw, or null. It needs a speaker and words (a string); each extra is kept only in the shape the
 * screen reads. A turn left with nothing to show (no words, no files, no proposal) is dropped.
 */
export const cleanTurn = (v: unknown): AssistantTurn | null => {
  if (!isRec(v) || (v.role !== 'user' && v.role !== 'assistant') || typeof v.text !== 'string') return null;
  const t: AssistantTurn = { role: v.role, text: v.text };
  const files = Array.isArray(v.files) ? v.files.map(cleanFile).filter((f): f is AssistantFileShown => f !== null) : [];
  if (files.length) t.files = files;
  if (v.role === 'assistant') {
    // null is a real value here ("this answer proposed nothing"); anything else that is not a whole proposal goes
    if (v.proposal === null) t.proposal = null;
    else if (v.proposal !== undefined) {
      const p = cleanProposal(v.proposal);
      if (p) t.proposal = p;
    }
    const replies = strings(v.replies).slice(0, 3);
    if (replies.length) t.replies = replies;
    const steps = strings(v.steps);
    if (steps.length) t.steps = steps;
    if (typeof v.thoughts === 'string' && v.thoughts) t.thoughts = v.thoughts;
    if (typeof v.thoughtSeconds === 'number' && Number.isFinite(v.thoughtSeconds)) t.thoughtSeconds = v.thoughtSeconds;
    if (v.error === true) t.error = true;
    if (v.stopped === true) t.stopped = true;
    if (v.rating === 'up' || v.rating === 'down') t.rating = v.rating;
  }
  if (!t.text.trim() && !t.files?.length && !t.proposal) return null;
  return t;
};

export const cleanTurns = (v: unknown): AssistantTurn[] => (Array.isArray(v) ? v.map(cleanTurn).filter((t): t is AssistantTurn => t !== null) : []);

/** A saved chat as the store keeps it, or null when it has no id or no turn left worth keeping. */
export const cleanChat = (v: unknown): { id: string; title: string; named?: boolean; updatedAt: number; turns: AssistantTurn[]; plan?: string } | null => {
  if (!isRec(v) || typeof v.id !== 'string' || !v.id) return null;
  const turns = cleanTurns(v.turns);
  if (!turns.length) return null;
  const title = typeof v.title === 'string' && v.title.trim() ? v.title : '';
  // the plan block a chat was started for (the plan summary's assistant): an id, nothing else
  const plan = typeof v.plan === 'string' && v.plan && v.plan.length <= 64 ? v.plan : undefined;
  return { id: v.id, title, ...(v.named === true ? { named: true } : {}), updatedAt: typeof v.updatedAt === 'number' && Number.isFinite(v.updatedAt) ? v.updatedAt : 0, turns, ...(plan ? { plan } : {}) };
};
