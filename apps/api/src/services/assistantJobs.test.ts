import { describe, expect, it } from 'vitest';
import { ApiError } from '../lib/util.js';
import { JOB_TTL_MS, jobState, startJob } from './assistantJobs.js';
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

describe('a proposal', () => {
  it('takes a whole plan in one go (fifty changes and more), up to the cap', () => {
    const add = (i: number) => ({ op: 'add_session', date: `2026-11-${String((i % 28) + 1).padStart(2, '0')}`, kind: 'run', title: `Easy ${i}`, miles: 5 });
    expect(zProposal.safeParse({ summary: 'Replace the plan', changes: Array.from({ length: 56 }, (_, i) => add(i)) }).success).toBe(true);
    expect(zProposal.safeParse({ summary: 'Too much', changes: Array.from({ length: MAX_CHANGES + 1 }, (_, i) => add(i)) }).success).toBe(false);
  });
});
