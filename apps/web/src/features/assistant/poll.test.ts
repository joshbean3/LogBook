import { describe, expect, it } from 'vitest';
import { AskError, askAndWait, type JobAnswer } from './poll';

/** A clock the sleeps move forward, so a wait of minutes runs at once. */
const clock = () => {
  let t = 0;
  return { now: () => t, sleep: async (ms: number) => void (t += ms), elapsed: () => t };
};

describe('waiting on an ask', () => {
  it('answers at once when the server had nothing to wait on', async () => {
    const reply = await askAndWait(async () => ({ text: 'no key', proposal: null }), async () => ({ status: 'running' as const }));
    expect(reply).toEqual({ text: 'no key', proposal: null });
  });

  it('checks until the answer is ready, easing from 1.2 s to 3 s apart', async () => {
    const c = clock();
    const answers: JobAnswer<string>[] = [{ status: 'running' }, { status: 'running' }, { status: 'running' }, { status: 'done', reply: 'Here is the plan.' }];
    const reply = await askAndWait<string>(async () => ({ jobId: 'aj1' }), async () => answers.shift()!, c);
    expect(reply).toBe('Here is the plan.');
    expect(c.elapsed()).toBe(1200 + 1500 + 1800 + 2100);
  });

  it('rides out checks that cannot reach the server, and stops on any other failure', async () => {
    const c = clock();
    const offline = new Error('offline');
    let n = 0;
    const reply = await askAndWait<string>(
      async () => ({ jobId: 'aj1' }),
      async () => {
        n += 1;
        if (n < 3) throw offline;
        return { status: 'done', reply: 'ok' };
      },
      { ...c, isTransient: (e) => e === offline },
    );
    expect(reply).toBe('ok');
    await expect(askAndWait<string>(async () => ({ jobId: 'aj1' }), async () => Promise.reject(new Error('404')), { ...c, isTransient: (e) => e === offline })).rejects.toThrow('404');
  });

  it('passes on the server’s own error, and gives up after the time allowed', async () => {
    const c = clock();
    await expect(askAndWait(async () => ({ jobId: 'aj1' }), async () => ({ status: 'error' as const, error: { message: 'That proposal is closed.', status: 409, code: 'stale_proposal' } }), c)).rejects.toMatchObject({ message: 'That proposal is closed.', status: 409 });
    const slow = clock();
    const e = await askAndWait(async () => ({ jobId: 'aj1' }), async () => ({ status: 'running' as const }), { ...slow, maxMs: 60_000 }).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(AskError);
    expect((e as AskError).code).toBe('too_slow');
    expect(slow.elapsed()).toBeGreaterThanOrEqual(60_000);
  });
});
