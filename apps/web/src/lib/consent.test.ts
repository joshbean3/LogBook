import { DEFAULT_CONSENT, type Consent, type ConsentInput } from '@logbook/shared';
import { QueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Bootstrap } from '@/api/types';

/**
 * critic-01, Contract 10: lib/consent.ts is the one place the web app reads and writes the privacy choice. Three streams
 * import it. These tests pin its exports and that a save merges only the fields it was given, into both cached copies.
 */
let answer: (body: ConsentInput) => Promise<{ consent: Consent }> = async () => ({ consent: DEFAULT_CONSENT });
const calls: Array<{ path: string; method?: string; json?: unknown }> = [];
vi.mock('@/api/client', () => ({
  api: async (path: string, init: { method?: string; json?: unknown } = {}) => {
    calls.push({ path, method: init.method, json: init.json });
    return answer(init.json as ConsentInput);
  },
}));

const stored: Consent = { training: true, health: null, recall: false, reads: true, at: '2026-11-10T08:00:00.000Z', version: '2026-11' };
const boot = (consent?: Consent) => ({ user: { id: 'u1', email: 'sam@example.com' }, habits: [], blocks: [], features: { claude: true, strava: false }, ...(consent ? { consent } : {}) }) as unknown as Bootstrap;

const setup = async (opts: { consent?: Consent; bootConsent?: Consent; noBoot?: boolean } = {}) => {
  const mod = await import('./consent');
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  if (opts.consent) qc.setQueryData(mod.consentKey, opts.consent);
  if (!opts.noBoot) qc.setQueryData(['bootstrap'], boot(opts.bootConsent));
  const save = (c: ConsentInput) => qc.getMutationCache().build(qc, mod.saveConsentOptions(qc)).execute(c);
  const read = () => ({ query: qc.getQueryData<Consent>(mod.consentKey), boot: qc.getQueryData<Bootstrap>(['bootstrap'])?.consent });
  return { mod, qc, save, read };
};

beforeEach(() => {
  calls.length = 0;
  answer = async () => ({ consent: DEFAULT_CONSENT });
});

describe('lib/consent.ts', () => {
  it('exports the three names the other streams import', async () => {
    const mod = await import('./consent');
    expect(mod.consentKey).toEqual(['consent']);
    expect(typeof mod.useConsent).toBe('function');
    expect(typeof mod.useSaveConsent).toBe('function');
  });

  it('the bootstrap type carries the record (a compile check)', () => {
    const b = boot(stored);
    const recall: boolean | undefined = b.consent?.recall;
    const version: string | null | undefined = b.consent?.version;
    expect([recall, version]).toEqual([false, '2026-11']);
  });

  it.each<[string, ConsentInput, Partial<Consent>]>([
    ['training alone', { training: false }, { training: false }],
    ['recall alone', { recall: true }, { recall: true }],
    ['reads alone', { reads: false }, { reads: false }],
    ['health alone', { health: true }, { health: true }],
    ['version alone', { version: '2026-12' }, { version: '2026-12' }],
    ['several at once', { recall: true, reads: false, version: '2026-12' }, { recall: true, reads: false, version: '2026-12' }],
    ['an undefined field is not a change', { training: undefined, recall: true }, { recall: true }],
  ])('a save of %s sends only that and merges only that into the cache', async (_name, input, changed) => {
    const { save, read } = await setup({ consent: stored, bootConsent: stored });
    let release: (v: { consent: Consent }) => void = () => undefined;
    answer = () => new Promise((r) => (release = r));
    const done = save(input);
    await vi.waitFor(() => expect(calls).toHaveLength(1));
    // sent exactly what was given
    expect(calls[0]).toMatchObject({ path: '/me/consent', method: 'PUT' });
    expect(JSON.parse(JSON.stringify(calls[0]!.json))).toEqual(JSON.parse(JSON.stringify(input)));
    // at once, before the server answers: the given fields changed, the others did not, in both copies
    expect(read().query).toEqual({ ...stored, ...changed });
    expect(read().boot).toEqual({ ...stored, ...changed });
    // the server's record (with its new `at`) replaces both
    const saved = { ...stored, ...changed, at: '2026-11-10T09:00:00.000Z' } as Consent;
    release({ consent: saved });
    await done;
    expect(read().query).toEqual(saved);
    expect(read().boot).toEqual(saved);
  });

  it('a save that fails puts both copies back', async () => {
    const { save, read } = await setup({ consent: stored, bootConsent: stored });
    answer = async () => {
      throw Object.assign(new Error('down'), { status: 503 });
    };
    await expect(save({ training: false, recall: true })).rejects.toThrow('down');
    expect(read().query).toEqual(stored);
    expect(read().boot).toEqual(stored);
  });

  it('with nothing cached yet it starts from the defaults, and a bootstrap without the field gets one', async () => {
    const { save, read } = await setup();
    const saved: Consent = { ...DEFAULT_CONSENT, recall: true, at: '2026-11-10T09:00:00.000Z', version: '2026-11' };
    answer = async () => ({ consent: saved });
    await save({ recall: true, version: '2026-11' });
    expect(read().query).toEqual(saved);
    expect(read().boot).toEqual(saved);
  });

  it('with no bootstrap in the cache (first run, before it loads) only the consent query is written', async () => {
    const { save, read, qc } = await setup({ noBoot: true });
    answer = async () => ({ consent: { ...DEFAULT_CONSENT, training: false } });
    await save({ training: false });
    expect(read().query).toMatchObject({ training: false });
    expect(qc.getQueryData(['bootstrap'])).toBeUndefined();
  });

  it('givenFields drops undefined and keeps null (health: null means "not asked")', async () => {
    const { mod } = await setup();
    expect(mod.givenFields({ training: undefined, health: null, version: null })).toEqual({ health: null, version: null });
  });
});
