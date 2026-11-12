import type { ErrorInfo, ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetErrorReports, setErrorSender, type ClientErrorReport } from '@/lib/errorReport';
import { reloadFresh, reloadOnce, SectionBoundary } from './ErrorBoundary';

vi.stubGlobal('__BUILD_COMMIT__', 'abc1234');
// the phone's database, as the test says it behaves
let del: () => Promise<void> = () => Promise.resolve();
vi.mock('idb-keyval', () => ({ del: () => del(), clear: () => Promise.resolve() }));

/**
 * One broken section never blanks a page. The boundary is driven here as React drives it (the static error hook, the
 * catch, the render): a real throw inside a real page is walked in the browser by the edge-case scripts.
 */
const Card = () => <section className="card">The card</section>;
const make = (name = 'today.habits') => {
  const b = new SectionBoundary({ name, children: <Card /> });
  // React's setState, as far as a class outside a tree needs it
  b.setState = ((patch: { error: Error | null }) => void (b.state = { ...b.state, ...patch })) as typeof b.setState;
  return b;
};
const fail = (b: SectionBoundary, e: Error, stack = '\n    at HabitsTop\n    at DayContent') => {
  b.setState(SectionBoundary.getDerivedStateFromError(e));
  b.componentDidCatch(e, { componentStack: stack } as ErrorInfo);
};
const html = (b: SectionBoundary) => renderToStaticMarkup(b.render() as ReactElement);

describe('a page section’s own boundary', () => {
  let sent: ClientErrorReport[] = [];
  let logged: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    sent = [];
    resetErrorReports();
    setErrorSender(async (r) => void sent.push(r));
    logged = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => logged.mockRestore());

  it('healthy, it adds nothing: the section’s own markup and no element around it', () => {
    expect(html(make())).toBe('<section class="card">The card</section>');
  });

  it('broken, the section alone is replaced by one calm line and Try again', () => {
    const b = make();
    fail(b, new Error('boom'));
    const out = html(b);
    expect(out).toContain('role="alert"');
    expect(out).toContain('This part hit a snag.');
    expect(out).toMatch(/<button type="button"[^>]*>Try again<\/button>/);
    expect(out).not.toContain('The card');
    // never the error's own words on the page
    expect(out).not.toContain('boom');
  });

  it('reports once, the way every boundary does, with the section’s name and nothing a person typed', () => {
    const b = make('today.plan');
    const e = new Error('Cannot draw the to-do "Call Dr. Lee about the results"');
    fail(b, e);
    fail(b, e);
    expect(sent).toHaveLength(1);
    expect(sent[0]!.stack).toContain('section: today.plan');
    expect(sent[0]!.stack).toContain('at HabitsTop');
    expect(JSON.stringify(sent[0])).not.toMatch(/Lee|results/);
  });

  it('Try again draws the section again in place; only when that draw fails too does the next one reload from the server', async () => {
    vi.useFakeTimers();
    const reload = vi.fn();
    vi.stubGlobal('location', { reload, pathname: '/today' });
    const b = make();
    fail(b, new Error('first'));
    b.retry();
    expect(html(b)).toContain('The card');
    // the draw Try again asked for throws as well: the same line, and this time Try again is the deeper one
    fail(b, new Error('second'));
    expect(html(b)).toContain('Try again');
    expect(reload).not.toHaveBeenCalled();
    b.retry();
    await vi.advanceTimersByTimeAsync(2000);
    expect(reload).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.stubGlobal('__BUILD_COMMIT__', 'abc1234');
  });

  it('a retry that worked is forgotten: a later failure is drawn again in place, and the page is not reloaded', async () => {
    vi.useFakeTimers();
    const reload = vi.fn();
    vi.stubGlobal('location', { reload, pathname: '/today' });
    const b = make();
    const first = new Error('first');
    fail(b, first);
    b.retry();
    // React commits the section's own markup again
    b.componentDidUpdate({ name: 'today.habits', children: null }, { error: first });
    fail(b, new Error('later, something else'));
    b.retry();
    await vi.advanceTimersByTimeAsync(2000);
    expect(html(b)).toContain('The card');
    expect(reload).not.toHaveBeenCalled();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.stubGlobal('__BUILD_COMMIT__', 'abc1234');
  });
});

describe('Reload (and a section’s second Try again) always reloads', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.stubGlobal('__BUILD_COMMIT__', 'abc1234');
    del = () => Promise.resolve();
  });
  const run = async (behave: () => Promise<void>) => {
    const reload = vi.fn();
    vi.stubGlobal('location', { reload });
    del = behave;
    reloadFresh();
    await vi.advanceTimersByTimeAsync(2000);
    return reload;
  };
  it('when the saved copy is cleared', async () => expect(await run(() => Promise.resolve())).toHaveBeenCalledTimes(1));
  it('when clearing it fails', async () => expect(await run(() => Promise.reject(new Error('blocked')))).toHaveBeenCalledTimes(1));
  it('when the database cannot even be opened (it throws at once, as in a private window)', async () =>
    expect(
      await run(() => {
        throw new ReferenceError('indexedDB is not defined');
      }),
    ).toHaveBeenCalledTimes(1));
  it('when the database never answers', async () => expect(await run(() => new Promise<void>(() => undefined))).toHaveBeenCalledTimes(1));
});

describe('the one reload for a stale build', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.stubGlobal('__BUILD_COMMIT__', 'abc1234');
  });
  it('reloads once, then not again for a while', () => {
    const reload = vi.fn();
    const m = new Map<string, string>();
    vi.stubGlobal('location', { reload });
    vi.stubGlobal('sessionStorage', { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) });
    reloadOnce();
    reloadOnce();
    expect(reload).toHaveBeenCalledTimes(1);
  });
  it('with storage that throws it cannot know it already did, so it never reloads by itself (no loop)', () => {
    const reload = vi.fn();
    vi.stubGlobal('location', { reload });
    vi.stubGlobal('sessionStorage', {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    });
    for (let i = 0; i < 5; i++) reloadOnce();
    expect(reload).not.toHaveBeenCalled();
  });
});
