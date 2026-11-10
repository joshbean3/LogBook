import { describe, expect, it } from 'vitest';
import { AskError, askAndWait, type JobAnswer } from './poll';

/** A clock the sleeps move forward, so a wait of minutes runs at once. */
const clock = () => {
  let t = 0;
  return { now: () => t, sleep: async (ms: number) => void (t += ms), elapsed: () => t };
};

describe('waiting on an ask', () => {
  it('takes no looks while the app is out of view, and that time does not count', async () => {
    const c = clock();
    let looks = 0;
    const reply = await askAndWait<string>(
      async () => ({ jobId: 'aj1' }),
      async () => (++looks < 2 ? { status: 'running' } : { status: 'done', reply: 'ok' }),
      { ...c, maxMs: 1000, whenVisible: async () => void (looks === 1 ? c.sleep(5000) : undefined) },
    );
    expect(reply).toBe('ok');
  });

  it('answers at once when the server had nothing to wait on', async () => {
    const reply = await askAndWait(async () => ({ text: 'no key', proposal: null }), async () => ({ status: 'running' as const }));
    expect(reply).toEqual({ text: 'no key', proposal: null });
  });

  it('checks until the answer is ready: quick while words arrive, easing off while nothing changes', async () => {
    const c = clock();
    const live = (text: string) => ({ phase: 'writing' as const, text, thoughts: '', seconds: 1 });
    const answers: JobAnswer<string>[] = [{ status: 'running' }, { status: 'running', live: live('Two') }, { status: 'running', live: live('Two runs') }, { status: 'running', live: live('Two runs') }, { status: 'done', reply: 'Two runs left.' }];
    const seen: string[] = [];
    let job = '';
    const reply = await askAndWait<string>(async () => ({ jobId: 'aj1' }), async () => answers.shift()!, { ...c, onJob: (id) => (job = id), onProgress: (l) => seen.push(l.text) });
    expect(reply).toBe('Two runs left.');
    expect(job).toBe('aj1');
    expect(seen).toEqual(['Two', 'Two runs']);
    // 400 first; nothing new (540); words (350, 350); the same words again (473)
    expect(c.elapsed()).toBe(400 + 540 + 350 + 350 + 473);
  });

  it('rides out checks that cannot reach the server, and stops on any other failure', async () => {
    const c = clock();
    const offline = new Error('offline');
    const conn: boolean[] = [];
    let n = 0;
    const reply = await askAndWait<string>(
      async () => ({ jobId: 'aj1' }),
      async () => {
        n += 1;
        if (n < 3) throw offline;
        return { status: 'done', reply: 'ok' };
      },
      { ...c, isTransient: (e) => e === offline, onConnection: (ok) => conn.push(ok) },
    );
    expect(reply).toBe('ok');
    // two misses in a row: waiting for a connection; the next look that gets through: back
    expect(conn).toEqual([false, true]);
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
