import { beforeEach, describe, expect, it, vi } from 'vitest';
import { reportError, reportOf, resetErrorReports, routeShape, setErrorSender, type ClientErrorReport } from './errorReport';

vi.stubGlobal('__BUILD_COMMIT__', 'abc1234');

describe('client error reports (gap-qua-69)', () => {
  let sent: ClientErrorReport[] = [];
  beforeEach(() => {
    sent = [];
    resetErrorReports();
    setErrorSender(async (b) => void sent.push(b));
  });

  it('sends one report per failure', () => {
    const e = new Error('boom');
    expect(reportError(e)).toBe(true);
    expect(reportError(e)).toBe(false);
    expect(reportError(new Error('other'))).toBe(true);
    expect(sent).toHaveLength(2);
    expect(Object.keys(sent[0]!).sort()).toEqual(['appVersion', 'message', 'route', 'stack', 'ua']);
  });

  it('stops after ten in one launch', () => {
    for (let i = 0; i < 15; i++) reportError(new Error(`e${i}`));
    expect(sent).toHaveLength(10);
  });

  it('keeps people out of it: no query, no ids, no email addresses', () => {
    const r = reportOf(new Error('Could not save for sam@example.com'), '', '/today/2026-11-10?q=my%20secret');
    expect(r.message).toBe('Could not save for [email]');
    expect(r.route).toBe('/today/2026-11-10');
    expect(routeShape('/progress/metric/3f2a9c1e-77aa-4b1e-9e0d-1c2b3a4d5e6f')).toBe('/progress/metric/:id');
  });

  it('fits in 8 KB', () => {
    const e = new Error('big');
    e.stack = 'x'.repeat(50_000);
    expect(new TextEncoder().encode(JSON.stringify(reportOf(e))).length).toBeLessThanOrEqual(8192);
  });

  it('reports a thrown non-error and ignores noise', () => {
    expect(reportError('plain string')).toBe(true);
    expect(reportError(new Error('ResizeObserver loop completed with undelivered notifications.'))).toBe(false);
  });
});
