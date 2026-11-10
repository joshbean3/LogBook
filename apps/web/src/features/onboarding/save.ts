import type { Goal, MorningSettings, OnboardingInput } from '@logbook/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import { keys } from '@/api/queries';
import type { Bootstrap, OnboardingResult } from '@/api/types';

/**
 * `POST /me/onboarding` with every answer in the one call (Contract 5, onboarding-03): the plan, the name, the morning
 * routine, when they train and when work ends. `goal: null` finishes setup with no running plan (onboarding-09). A
 * feature-local hook, so the shared query file keeps its older type.
 */
export type OnboardingPost = Omit<OnboardingInput, 'goal' | 'habits' | 'start'> & { goal: Goal | null; habits: string[]; start?: 'monday' | 'tomorrow' };
/** What comes back: as before, and with no block when there is no plan. */
export type OnboardingSaved = Omit<OnboardingResult, 'block' | 'user'> & { block: OnboardingResult['block'] | null; user: OnboardingResult['user'] & { name?: string | null }; morningSettings: MorningSettings };

export const useSaveOnboarding = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (answers: OnboardingPost) => api<OnboardingSaved>('/me/onboarding', { method: 'POST', json: answers }),
    onSuccess: (r) => {
      qc.setQueryData<Bootstrap>(keys.bootstrap, (b) =>
        b ? { ...b, user: { ...b.user, ...r.user }, morningSettings: r.morningSettings ?? b.morningSettings, habits: r.habits ?? b.habits, blocks: r.block ? [...b.blocks.filter((x) => x.id !== r.block!.id), r.block] : b.blocks } : b,
      );
      for (const m of r.months ?? []) void qc.invalidateQueries({ queryKey: keys.month(m) });
      void qc.invalidateQueries({ queryKey: keys.bootstrap });
    },
  });
};
