import type { AssistantLive, AssistantProposal, AssistantTurn, Attachment } from '@logbook/shared';
import { useSyncExternalStore } from 'react';
import { orphanDraft, readDraft, writeDraft } from './drafts';
import { cleanChat, cleanProposal, cleanTurns } from './sanitize';

/**
 * Conversations with the assistant, the way ChatGPT and Claude keep them: every chat is saved on the phone (localStorage)
 * with a title and when it was last used, and the History list opens any of them again. The open chat survives closing
 * the sheet and a reload (sessionStorage holds which one); a fresh launch starts a new one.
 *
 * One ask at a time, app-wide. An answer always lands in the chat that asked, even if the owner has moved to another chat
 * or started a new one meanwhile (it carries on in the background, as ChatGPT does).
 */
export interface AssistantChat {
  id: string;
  title: string;
  /** True once the title came from the assistant (or the owner): the first-words title is only a placeholder. */
  named?: boolean;
  updatedAt: number;
  turns: AssistantTurn[];
}

const CHATS = 'logbook.assistant.chats';
const CURRENT = 'logbook.assistant.current';
/** The answer being written, so a reload can carry on reading it: { chatId, jobId, startedAt }. */
const JOB = 'logbook.assistant.job';
const LEGACY = 'logbook.assistant';
const MAX_CHATS = 60;
const MAX_TURNS = 60;

const newId = () => `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
/** A placeholder title from the first question: its first words, cut at a word. */
export const titleFrom = (text: string) => {
  const t = text.replace(/\s+/g, ' ').trim();
  if (!t) return 'Photos and files';
  if (t.length <= 36) return t;
  const cut = t.slice(0, 36);
  return `${cut.slice(0, cut.lastIndexOf(' ') > 16 ? cut.lastIndexOf(' ') : 36)}…`;
};

/** Saved chats in the shape the sheet reads: a turn it cannot draw is dropped, and a chat left empty goes with it. */
export const chatsFrom = (v: unknown): AssistantChat[] => {
  if (!Array.isArray(v)) return [];
  const seen = new Set<string>();
  const out: AssistantChat[] = [];
  for (const raw of v) {
    const c = cleanChat(raw);
    if (!c || seen.has(c.id)) continue;
    seen.add(c.id);
    out.push({ ...c, title: c.title || titleFrom(c.turns.find((t) => t.role === 'user')?.text ?? '') });
  }
  return out;
};
const load = (): AssistantChat[] => {
  try {
    return chatsFrom(JSON.parse(localStorage.getItem(CHATS) ?? '[]') as unknown);
  } catch {
    return [];
  }
};
let chats: AssistantChat[] = load();
let current: string = (() => {
  try {
    const id = sessionStorage.getItem(CURRENT);
    if (id && (chats.some((c) => c.id === id) || readDraft(id))) return id;
    // the one conversation kept before history existed comes across as a chat
    const old = cleanTurns(JSON.parse(sessionStorage.getItem(LEGACY) ?? 'null') as unknown);
    sessionStorage.removeItem(LEGACY);
    if (old.length) {
      const first = old.find((t) => t.role === 'user');
      const c: AssistantChat = { id: newId(), title: titleFrom(first?.text ?? ''), updatedAt: Date.now(), turns: old };
      chats = [c, ...chats];
      return c.id;
    }
  } catch {
    /* private mode */
  }
  // a new chat with unsent words in it, from before the app closed, opens again
  return orphanDraft((id) => chats.some((c) => c.id === id)) ?? newId();
})();
try {
  sessionStorage.setItem(CURRENT, current);
} catch {
  /* private mode */
}
let turns: AssistantTurn[] = chats.find((c) => c.id === current)?.turns ?? [];

/** When the ask now out started (ms), or null; and the chat it belongs to. The job itself is kept for a reload (JOB). */
let busySince: number | null = null;
let busyChat: string | null = null;
/** The answer being written (its words so far, what it is doing), and the job to stop it by. Memory only. */
let live: AssistantLive | null = null;
let jobId: string | null = null;
/** Bumped whenever the open chat changes: live words from an ask in another chat are not shown here. */
let generation = 0;
/** The server answered an ask with "ask first" (403 consent_required): the sheet shows its permission step. Memory only. */
let consentNeeded = false;
/** The chat whose answer was stopped before any words came (the thread says Stopped). Memory only. */
let stoppedChat: string | null = null;
/** Two looks in a row at the answer could not reach the server (the thread says it is waiting for a connection). */
let offline = false;
/** The chat that was open the last time the sheet failed to draw (see reset). */
let failed: string | null = null;
const subs = new Set<() => void>();
/**
 * The files sent with a user turn, kept in memory only (storage keeps the names and small previews): the assistant can
 * look again at a photo for as long as the app is open.
 */
const fileData = new WeakMap<AssistantTurn, Attachment[]>();

const save = () => {
  try {
    localStorage.setItem(CHATS, JSON.stringify(chats));
    sessionStorage.setItem(CURRENT, current);
  } catch {
    /* private mode or full: kept in memory only */
  }
};
const notify = () => subs.forEach((f) => f());

/** Writes `next` as the turns of chat `id` (the open one or another), saves, and tells the screen. */
const write = (id: string, next: AssistantTurn[]) => {
  if (id === current) turns = next;
  const had = chats.find((c) => c.id === id);
  if (!next.length) chats = chats.filter((c) => c.id !== id);
  else {
    const first = next.find((t) => t.role === 'user');
    const chat: AssistantChat = had ? { ...had, turns: next.slice(-MAX_TURNS), updatedAt: Date.now() } : { id, title: titleFrom(first?.text ?? ''), updatedAt: Date.now(), turns: next.slice(-MAX_TURNS) };
    chats = [chat, ...chats.filter((c) => c.id !== id)].slice(0, MAX_CHATS);
  }
  save();
  notify();
};
export interface PendingJob {
  chatId: string;
  jobId: string;
  startedAt: number;
}
const readJob = (): PendingJob | null => {
  try {
    const v = JSON.parse(sessionStorage.getItem(JOB) ?? 'null') as Partial<PendingJob> | null;
    return v && typeof v.chatId === 'string' && typeof v.jobId === 'string' && typeof v.startedAt === 'number' ? (v as PendingJob) : null;
  } catch {
    return null;
  }
};
const writeJob = (j: PendingJob | null) => {
  try {
    if (j) sessionStorage.setItem(JOB, JSON.stringify(j));
    else sessionStorage.removeItem(JOB);
  } catch {
    /* private mode: a reload loses the answer, and the thread offers Retry */
  }
};
const turnsOf = (id: string) => (id === current ? turns : (chats.find((c) => c.id === id)?.turns ?? []));

export const assistantStore = {
  get: () => turns,
  busySince: () => busySince,
  generation: () => generation,
  /** The open chat. */
  currentId: () => current,
  /** Every saved chat, newest first. */
  chats: () => chats,
  /** The chat an ask now out belongs to. */
  busyChat: () => busyChat,
  push: (t: AssistantTurn, files?: Attachment[]) => {
    if (files?.length) fileData.set(t, files);
    write(current, [...turns, t]);
  },
  /** Adds a turn to a given chat: an answer goes to the chat that asked, wherever the owner is now. */
  pushTo: (id: string, t: AssistantTurn) => write(id, [...turnsOf(id), t]),
  filesOf: (t: AssistantTurn) => fileData.get(t),
  /** The proposal as the server now has it (applied, undone). An answer that is not a whole proposal changes nothing. */
  setProposal: (next: AssistantProposal) => {
    const p = cleanProposal(next);
    if (p) write(current, turns.map((t) => (t.proposal?.id === p.id ? { ...t, proposal: p } : t)));
  },
  /** The owner's thumbs on an answer (tapping the same one again takes it off). */
  rate: (index: number, rating: 'up' | 'down') =>
    write(
      current,
      turns.map((t, i) => {
        if (i !== index) return t;
        const next: AssistantTurn = { ...t, rating };
        if (t.rating === rating) delete next.rating;
        return next;
      }),
    ),
  /** Names a chat, once (the assistant's title on its first answer). */
  name: (id: string, title: string) => {
    const c = chats.find((x) => x.id === id);
    if (!c || c.named || !title.trim()) return;
    chats = chats.map((x) => (x.id === id ? { ...x, title: title.trim(), named: true } : x));
    save();
    notify();
  },
  /** Takes off the last turn when it is an ask that did not go through (Retry sends again without it). */
  dropError: () => {
    if (!turns[turns.length - 1]?.error) return;
    write(current, turns.slice(0, -1));
  },
  /** Keeps the turns before `index` (editing a question sends it again from there). */
  truncate: (index: number) => write(current, turns.slice(0, Math.max(0, index))),
  setBusy: (since: number | null, chat: string | null = since === null ? null : current) => {
    busySince = since;
    busyChat = chat;
    offline = false;
    if (since === null) {
      live = null;
      jobId = null;
      writeJob(null);
    } else if (stoppedChat === chat) stoppedChat = null;
    notify();
  },
  live: () => live,
  setLive: (l: AssistantLive | null) => {
    live = l;
    notify();
  },
  consentNeeded: () => consentNeeded,
  setConsentNeeded: (v: boolean) => {
    if (consentNeeded === v) return;
    consentNeeded = v;
    notify();
  },
  jobId: () => jobId,
  setJob: (id: string | null) => {
    jobId = id;
    writeJob(id && busyChat && busySince !== null ? { chatId: busyChat, jobId: id, startedAt: busySince } : null);
  },
  /** An answer a reload left half read: its chat must still end on the question it answers. */
  pendingJob: (): PendingJob | null => {
    const j = readJob();
    if (!j) return null;
    const t = turnsOf(j.chatId);
    if (t[t.length - 1]?.role === 'user') return j;
    writeJob(null);
    return null;
  },
  stoppedChat: () => stoppedChat,
  setStopped: (chat: string | null) => {
    stoppedChat = chat;
    notify();
  },
  offline: () => offline,
  setOffline: (v: boolean) => {
    if (offline === v) return;
    offline = v;
    notify();
  },
  /** Takes off the last assistant turn (Regenerate asks again without it). */
  dropLastAnswer: () => {
    if (turns[turns.length - 1]?.role !== 'assistant') return;
    write(current, turns.slice(0, -1));
  },
  /** A new, empty chat. The one open stays in History; an answer it is waiting for still lands there. */
  clear: () => {
    current = newId();
    turns = [];
    generation++;
    save();
    notify();
  },
  /** Opens a saved chat. */
  open: (id: string) => {
    const c = chats.find((x) => x.id === id);
    if (!c || id === current) return;
    current = id;
    turns = c.turns;
    generation++;
    save();
    notify();
  },
  /** Puts back a chat just deleted (the Undo on History's toast), in its place by when it was last used. */
  restore: (chat: AssistantChat) => {
    if (chats.some((c) => c.id === chat.id)) return;
    chats = [...chats, chat].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, MAX_CHATS);
    save();
    notify();
  },
  /** Deletes a saved chat; deleting the open one starts a new one. */
  remove: (id: string) => {
    chats = chats.filter((c) => c.id !== id);
    writeDraft(id, '');
    if (id === current) {
      current = newId();
      turns = [];
      generation++;
    }
    save();
    notify();
  },
  /**
   * The sheet could not draw (its error boundary says so with the window event `logbook:assistant-reset`): every saved
   * chat is checked again and a new chat opens, so "Start a new chat" always works. The chat that was open stays in
   * History; if it stops the sheet a second time it is taken off the phone.
   */
  reset: () => {
    const was = current;
    chats = chatsFrom(chats);
    if (failed === was) chats = chats.filter((c) => c.id !== was);
    failed = was;
    current = newId();
    turns = [];
    generation++;
    save();
    notify();
  },
  subscribe: (f: () => void) => {
    subs.add(f);
    return () => void subs.delete(f);
  },
};

/** Contract C2: the shell's error boundary around the assistant asks for a clean start with this window event. */
export const ASSISTANT_RESET = 'logbook:assistant-reset';
if (typeof window !== 'undefined') window.addEventListener(ASSISTANT_RESET, () => assistantStore.reset());

export const useAssistantTurns = () => useSyncExternalStore(assistantStore.subscribe, assistantStore.get, assistantStore.get);
export const useAssistantBusy = () => useSyncExternalStore(assistantStore.subscribe, assistantStore.busySince, assistantStore.busySince);
export const useAssistantLive = () => useSyncExternalStore(assistantStore.subscribe, assistantStore.live, assistantStore.live);
export const useAssistantChats = () => useSyncExternalStore(assistantStore.subscribe, assistantStore.chats, assistantStore.chats);
export const useAssistantChatId = () => useSyncExternalStore(assistantStore.subscribe, assistantStore.currentId, assistantStore.currentId);
export const useAssistantBusyChat = () => useSyncExternalStore(assistantStore.subscribe, assistantStore.busyChat, assistantStore.busyChat);
export const useAssistantStopped = () => useSyncExternalStore(assistantStore.subscribe, assistantStore.stoppedChat, assistantStore.stoppedChat);
export const useAssistantOffline = () => useSyncExternalStore(assistantStore.subscribe, assistantStore.offline, assistantStore.offline);
export const useAssistantConsentNeeded = () => useSyncExternalStore(assistantStore.subscribe, assistantStore.consentNeeded, assistantStore.consentNeeded);
