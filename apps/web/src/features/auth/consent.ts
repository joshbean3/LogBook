import { DEFAULT_CONSENT, type Consent, type ConsentInput } from '@logbook/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';

/**
 * The privacy choice (user_settings `consent`). Before the account exists it waits on this device (`logbook.consent.pending`),
 * chosen on the privacy page; Create account sends it with the new account and clears it.
 */
export const PENDING_CONSENT_KEY = 'logbook.consent.pending';

export const readPendingConsent = (): ConsentInput | null => {
  try {
    const raw = localStorage.getItem(PENDING_CONSENT_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as { training?: unknown };
    return typeof v.training === 'boolean' ? { training: v.training } : null;
  } catch {
    return null;
  }
};
export const writePendingConsent = (c: ConsentInput) => {
  try {
    localStorage.setItem(PENDING_CONSENT_KEY, JSON.stringify({ training: c.training }));
  } catch {
    /* private mode: the page asks again next time, which is the safe way round */
  }
};
export const clearPendingConsent = () => {
  try {
    localStorage.removeItem(PENDING_CONSENT_KEY);
  } catch {
    /* nothing to clear */
  }
};

export const consentKey = ['consent'] as const;
/** The account's choice, for Settings › Privacy. */
export const useConsent = () => useQuery({ queryKey: consentKey, queryFn: () => api<{ consent: Consent }>('/me/consent').then((r) => r.consent), staleTime: 60_000 });
/** Change it: the switch moves at once, and goes back with a toast if the save fails. */
export const useSaveConsent = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (c: ConsentInput) => api<{ consent: Consent }>('/me/consent', { method: 'PUT', json: c }).then((r) => r.consent),
    onMutate: async (c) => {
      await qc.cancelQueries({ queryKey: consentKey });
      const prev = qc.getQueryData<Consent>(consentKey);
      qc.setQueryData<Consent>(consentKey, (cur) => ({ ...(cur ?? DEFAULT_CONSENT), training: c.training }));
      return { prev };
    },
    onError: (_e, _c, ctx) => {
      if (ctx?.prev) qc.setQueryData(consentKey, ctx.prev);
    },
    onSuccess: (c) => qc.setQueryData(consentKey, c),
  });
};
