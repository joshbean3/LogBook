import { DEFAULT_CONSENT, type Consent, type ConsentInput } from '@logbook/shared';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import type { Bootstrap } from '@/api/types';

/**
 * The account's privacy choice (Contract 1): what may go to the assistant. One record per account,
 * `{ training, recall, reads, health, at, version }`. It is read in two places, and this file keeps them the same: the
 * bootstrap carries it (`useBootstrap().data.consent`, for a page that only needs to know), and `useConsent()` reads it
 * from `GET /me/consent` (for the pages that change it). Every stream imports these three names from here.
 */
export const consentKey = ['consent'] as const;
const bootKey = ['bootstrap'] as const;

/** The fields of a change that were actually given (an absent or undefined field leaves the stored one alone). */
export const givenFields = (c: ConsentInput): Partial<Consent> => Object.fromEntries(Object.entries(c).filter(([, v]) => v !== undefined)) as Partial<Consent>;

/** Put a consent record in both caches: the consent query, and the bootstrap's copy when there is a bootstrap. */
const put = (qc: QueryClient, next: Consent) => {
  qc.setQueryData<Consent>(consentKey, next);
  qc.setQueryData<Bootstrap>(bootKey, (b) => (b ? { ...b, consent: next } : b));
};

export const useConsent = () => {
  const qc = useQueryClient();
  return useQuery({
    queryKey: consentKey,
    queryFn: () => api<{ consent: Consent }>('/me/consent').then((r) => r.consent),
    staleTime: 60_000,
    // the bootstrap already brought it: a page draws its switches at once, and the query still checks with the server
    initialData: () => qc.getQueryData<Bootstrap>(bootKey)?.consent,
    initialDataUpdatedAt: () => qc.getQueryState(bootKey)?.dataUpdatedAt,
  });
};

/**
 * What useSaveConsent does, apart from React so it can be tested: send any subset of training, recall, reads, health and
 * version; the switch moves at once (only the fields given are merged into the cached record), and goes back if the save
 * fails. The server's answer, with its `at`, replaces both cached copies.
 */
export const saveConsentOptions = (qc: QueryClient) => ({
  mutationFn: (c: ConsentInput) => api<{ consent: Consent }>('/me/consent', { method: 'PUT', json: c }).then((r) => r.consent),
  onMutate: async (c: ConsentInput) => {
    await qc.cancelQueries({ queryKey: consentKey });
    const prev = qc.getQueryData<Consent>(consentKey);
    const prevBoot = qc.getQueryData<Bootstrap>(bootKey)?.consent;
    put(qc, { ...(prev ?? prevBoot ?? DEFAULT_CONSENT), ...givenFields(c) });
    return { prev, prevBoot, hadBoot: qc.getQueryData<Bootstrap>(bootKey) !== undefined };
  },
  onError: (_e: unknown, _c: ConsentInput, ctx: { prev?: Consent; prevBoot?: Consent; hadBoot: boolean } | undefined) => {
    if (!ctx) return;
    qc.setQueryData<Consent>(consentKey, ctx.prev);
    if (ctx.hadBoot)
      qc.setQueryData<Bootstrap>(bootKey, (b) => (b && ctx.prevBoot ? { ...b, consent: ctx.prevBoot } : b));
    // the stored choice is the truth: ask again rather than trust a rollback
    void qc.invalidateQueries({ queryKey: consentKey });
  },
  onSuccess: (c: Consent) => put(qc, c),
});

/** Change any subset of it: the switch moves at once, and goes back if the save fails. */
export const useSaveConsent = () => {
  const qc = useQueryClient();
  return useMutation(saveConsentOptions(qc));
};
