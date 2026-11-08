import { describe, expect, it } from 'vitest';
import { ApiError } from '../lib/util.js';
import { cancelJob, JOB_TTL_MS, jobState, startJob } from './assistantJobs.js';
import { MAX_CHANGES, zProposal } from './assistant.js';

const tick = () => new Promise((r) => setTimeout(r, 0));

describe('an ask the phone does not wait on', () => {
  it('is running, then done with the reply, and only its owner can read it', async () => {
    let finish!: (v: string) => void;
    const id = startJob('u1', () => new Promise<string>((r) => (finish = r)));
    expect(jobState('u1', id)).toEqual({ status: 'running' });
    expect(jobState('u2', id)).toBeNull();
    finish('Here is your plan.');
    await tick();
    expect(jobState('u1', id)).toEqual({ status: 'done', reply: 'Here is your plan.' });
  });

  it('keeps the message and status of an error the phone should show, and hides an unexpected one', async () => {
    const a = startJob('u1', async () => {
      throw new ApiError(409, 'That proposal is closed.', 'stale_proposal');
    });
    const b = startJob('u1', async () => {
      throw new Error('socket hang up');
    });
    await tick();
    expect(jobState('u1', a)).toEqual({ status: 'error', error: { message: 'That proposal is closed.', status: 409, code: 'stale_proposal' } });
    expect(jobState('u1', b)).toEqual({ status: 'error', error: { message: 'The assistant hit a problem on the server. Try again.', status: 500, code: 'internal' } });
  });

  it('forgets a job half an hour after it started', () => {
    const t0 = 1_000_000;
    const id = startJob('u1', () => new Promise(() => undefined), t0);
    expect(jobState('u1', id, t0 + JOB_TTL_MS - 1)).toEqual({ status: 'running' });
    expect(jobState('u1', id, t0 + JOB_TTL_MS + 1)).toBeNull();
  });
});

describe('an answer as it is written, and stopping it', () => {
  it('shows the words so far while it runs', async () => {
    let say!: (t: string) => void;
    const id = startJob('u1', ({ progress }) => new Promise<string>(() => (say = (text) => progress({ phase: 'writing', text, thoughts: '', seconds: 2 }))));
    say('Moved the tempo');
    expect(jobState('u1', id)).toEqual({ status: 'running', live: { phase: 'writing', text: 'Moved the tempo', thoughts: '', seconds: 2 } });
  });

  it('stops: the request is aborted, the job says stopped, and a late answer does not replace that', async () => {
    let signal!: AbortSignal;
    let finish!: (v: string) => void;
    const id = startJob('u1', (ctx) => {
      signal = ctx.signal;
      return new Promise<string>((r) => (finish = r));
    });
    expect(cancelJob('u2', id)).toBe(false);
    expect(cancelJob('u1', id)).toBe(true);
    expect(signal.aborted).toBe(true);
    expect(jobState('u1', id)).toEqual({ status: 'error', error: { message: 'Stopped.', status: 499, code: 'stopped' } });
    finish('too late');
    await tick();
    expect(jobState('u1', id)).toMatchObject({ status: 'error' });
    expect(cancelJob('u1', id)).toBe(false);
  });
});

describe('a proposal', () => {
  it('takes a whole plan in one go (fifty changes and more), up to the cap', () => {
    const add = (i: number) => ({ op: 'add_session', date: `2026-11-${String((i % 28) + 1).padStart(2, '0')}`, kind: 'run', title: `Easy ${i}`, miles: 5 });
    expect(zProposal.safeParse({ summary: 'Replace the plan', changes: Array.from({ length: 56 }, (_, i) => add(i)) }).success).toBe(true);
    expect(zProposal.safeParse({ summary: 'Too much', changes: Array.from({ length: MAX_CHANGES + 1 }, (_, i) => add(i)) }).success).toBe(false);
  });
});
