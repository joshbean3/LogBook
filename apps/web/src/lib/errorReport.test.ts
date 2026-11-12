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

  it('never carries what a person typed: quoted text is masked, a code name the engine quotes is kept', () => {
    // a JSON parser quotes the text it could not read
    const json = reportOf(new SyntaxError(`Unexpected token 'B', "Buy a ring for Sam" is not valid JSON`));
    expect(json.message).not.toMatch(/Buy|ring|Sam/);
    expect(json.message).toContain('is not valid JSON');
    // a validator quotes the value it refused; curly quotes and backticks too
    for (const m of ['Invalid goal "Ask Alex about the loan"', 'Invalid goal “Ask Alex about the loan”', 'Invalid goal `Ask Alex about the loan`', "Unknown tag 'groceries'"]) {
      const r = reportOf(new Error(m));
      expect(r.message).not.toMatch(/Alex|loan|groceries/);
      expect(r.stack).not.toMatch(/Alex|loan|groceries/);
    }
    // a key the engine could not read is quoted too: a name from the code stays, a typed one does not
    expect(reportOf(new TypeError("Cannot read properties of undefined (reading 'stack')")).message).toContain("reading 'stack'");
    expect(reportOf(new TypeError("Cannot read properties of undefined (reading 'Call the bank at 9')")).message).not.toMatch(/bank/);
    expect(reportOf(new Error("Failed to execute 'replaceState' on 'History': bad URL 'http://my-private-note/'")).message).toBe("Failed to execute 'replaceState' on 'History': bad URL '…'");
    // an apostrophe in plain words is not a quote
    expect(reportOf(new Error("Couldn't draw the week, it isn't loaded")).message).toBe("Couldn't draw the week, it isn't loaded");
  });

  it('masks addresses wherever they sit, and reads a huge line of letters at once (it took seconds)', () => {
    expect(reportOf(new Error('a@b.co, Sam <sam.o+run@mail.example.org>; x@y')).message).toBe('[email], Sam <[email]>; x@y');
    expect(reportOf(new Error('@handle and 5@ and a@b')).message).toBe('@handle and 5@ and a@b');
    const e = new Error('x'.repeat(200_000));
    e.stack = `${'y'.repeat(400_000)}@`;
    const t0 = performance.now();
    const r = reportOf(e);
    expect(performance.now() - t0).toBeLessThan(1500);
    expect(r.message).toHaveLength(500);
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
