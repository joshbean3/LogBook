import { DEFAULT_CONSENT, type Consent, type ConsentInput } from '@logbook/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';

/** The account's privacy choice (user_settings `consent`): what may go to the assistant. */
export const consentKey = ['consent'] as const;
export const useConsent = () => useQuery({ queryKey: consentKey, queryFn: () => api<{ consent: Consent }>('/me/consent').then((r) => r.consent), staleTime: 60_000 });
/** Change any subset of it: the switch moves at once, and goes back if the save fails. */
export const useSaveConsent = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (c: ConsentInput) => api<{ consent: Consent }>('/me/consent', { method: 'PUT', json: c }).then((r) => r.consent),
    onMutate: async (c) => {
      await qc.cancelQueries({ queryKey: consentKey });
      const prev = qc.getQueryData<Consent>(consentKey);
      const given = Object.fromEntries(Object.entries(c).filter(([, v]) => v !== undefined)) as Partial<Consent>;
      qc.setQueryData<Consent>(consentKey, (cur) => ({ ...(cur ?? DEFAULT_CONSENT), ...given }));
      return { prev };
    },
    onError: (_e, _c, ctx) => {
      if (ctx?.prev) qc.setQueryData(consentKey, ctx.prev);
    },
    onSuccess: (c) => qc.setQueryData(consentKey, c),
  });
};
