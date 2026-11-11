import { createHash } from 'node:crypto';
import { ApiError } from '../lib/util.js';
import type { AiFlow } from './consent.js';

/**
 * Cost and load limits for the Claude calls a person starts: the assistant, the plan builder, its settings assistant and
 * the goal review. Kept in
 * memory, per user, in this one process (a restart clears them, which only ever gives a person a little more room).
 *
 * For each flow: one call running at a time, a short window, and a daily budget. Across every user: a cap on calls
 * running at once, so one small machine is never asked to hold a dozen long answers. A limit answers 429 `rate_limited`
 * with Retry-After; the global cap answers 503 `claude_busy`.
 */
export const AI_LIMITS: Record<AiFlow, { window: number; windowMs: number; perDay: number; noun: string }> = {
  assistant: { window: 10, windowMs: 5 * 60_000, perDay: 60, noun: 'messages' },
  plan: { window: 5, windowMs: 10 * 60_000, perDay: 15, noun: 'plan drafts' },
  goal: { window: 5, windowMs: 60_000, perDay: 30, noun: 'goal reviews' },
  // the plan builder's assistant: a small call a person may make a few times in a row while they shape one plan
  shape: { window: 10, windowMs: 5 * 60_000, perDay: 50, noun: 'plan requests' },
};
/** Claude calls running at once, all users together. */
export const AI_MAX_RUNNING = 6;

interface Usage {
  day: string;
  count: Record<AiFlow, number>;
  recent: Record<AiFlow, number[]>;
  running: Set<AiFlow>;
}
const users = new Map<string, Usage>();
let running = 0;

const dayOf = (now: number) => new Date(now).toISOString().slice(0, 10);
const fresh = (day: string): Usage => ({ day, count: { assistant: 0, plan: 0, goal: 0, shape: 0 }, recent: { assistant: [], plan: [], goal: [], shape: [] }, running: new Set() });

const limited = (message: string, retryAfterSec: number) => new ApiError(429, message, 'rate_limited', { 'Retry-After': String(Math.max(1, Math.ceil(retryAfterSec))) });
export const claudeBusy = () => new ApiError(503, 'The assistant is busy right now. Try again in a minute.', 'claude_busy', { 'Retry-After': '60' });

/**
 * Take a place for one Claude call, or throw. Call the function it returns when the call ends, however it ends.
 * Checks, in order: one running per user and flow, the short window, the day's budget, the global cap.
 */
export const beginAi = (userId: string, flow: AiFlow, now = Date.now()): (() => void) => {
  const day = dayOf(now);
  let u = users.get(userId);
  if (!u || u.day !== day) {
    // a new day starts the counts again; anything still running carries over
    const next = fresh(day);
    if (u) next.running = u.running;
    u = next;
    users.set(userId, u);
  }
  const lim = AI_LIMITS[flow];
  if (u.running.has(flow)) throw limited(flow === 'assistant' ? 'The assistant is still answering your last message.' : 'The last one is still running. Wait for it to finish.', 5);
  const recent = (u.recent[flow] = u.recent[flow].filter((t) => now - t < lim.windowMs));
  if (recent.length >= lim.window) throw limited('That is a lot in a short time. Try again in a few minutes.', (recent[0]! + lim.windowMs - now) / 1000);
  if (u.count[flow] >= lim.perDay) throw limited(`You have used today's ${lim.noun}. They come back tomorrow.`, (Date.parse(`${day}T00:00:00Z`) + 864e5 - now) / 1000);
  if (running >= AI_MAX_RUNNING) throw claudeBusy();
  recent.push(now);
  u.count[flow]++;
  u.running.add(flow);
  running++;
  let released = false;
  const usage = u;
  return () => {
    if (released) return;
    released = true;
    usage.running.delete(flow);
    running = Math.max(0, running - 1);
  };
};

/** Run one Claude call inside its limits: the place is given back when the work settles. */
export const withAiLimit = async <T>(userId: string, flow: AiFlow, work: () => Promise<T>): Promise<T> => {
  const release = beginAi(userId, flow);
  try {
    return await work();
  } finally {
    release();
  }
};

/** The user as the logs name them: a short hash, never the id or the email. */
export const logUser = (userId: string) => createHash('sha256').update(userId).digest('hex').slice(0, 12);

export type AiUsageFlow = AiFlow | 'recall' | 'reads';
interface TokenUsage {
  input_tokens?: number | null;
  output_tokens?: number | null;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
}
let sink: (line: string) => void = (line) => console.log(line);
/** Tests read the usage lines here; null puts the console back. */
export const setUsageSink = (fn: ((line: string) => void) | null) => {
  sink = fn ?? ((line) => console.log(line));
};
/** One structured line per Claude response: who (hashed), which flow, and the tokens it cost. No prompt text. */
export const logAiUsage = (userId: string, flow: AiUsageFlow, usage: TokenUsage | null | undefined) => {
  if (!usage) return;
  sink(JSON.stringify({ evt: 'ai_usage', user: logUser(userId), flow, in: usage.input_tokens ?? 0, out: usage.output_tokens ?? 0, cacheRead: usage.cache_read_input_tokens ?? 0, cacheWrite: usage.cache_creation_input_tokens ?? 0, at: new Date().toISOString() }));
};

/** Forget every count (tests). */
export const resetAiLimits = () => {
  users.clear();
  running = 0;
};
