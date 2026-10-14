import type { HrZone } from '@logbook/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import { keys } from '@/api/queries';
import { haptics } from '@/lib/haptics';
import { ChipButton, useToast } from '@/ui';
import { SRow } from './parts';

/** "Easy under 145 bpm · Threshold 146–172 · Speed from 173", or null when the zones that line needs are missing. */
export const zoneLine = (z: HrZone[] | null | undefined): string | null => {
  const Z = (n: number) => z?.find((r) => r.zone === n);
  const z2 = Z(2);
  const z3 = Z(3);
  const z4 = Z(4);
  if (!z2?.max || !z3 || !z4?.max) return null;
  // speed starts where threshold ends (zone 5), so the three ranges never overlap
  return `Easy under ${z2.max} bpm · Threshold ${z3.min}–${z4.max} · Speed from ${Z(5)?.min ?? z4.max + 1}`;
};

/**
 * Heart-rate zones, beside the Strava row (they were the old Trends page's Effort section; Progress reads easy runs by
 * them). The zones in one line and where they come from, with Sync: zones ride along with a sync of the linked account.
 */
export const HrZonesRow = ({ zones, connected }: { zones: HrZone[] | null; connected: boolean }) => {
  const qc = useQueryClient();
  const toast = useToast();
  const sync = useMutation({
    mutationFn: () => api<{ changed?: number }>('/strava/sync', { method: 'POST' }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: keys.bootstrap });
      await qc.invalidateQueries({ queryKey: ['month'] });
      haptics.success();
      toast('Synced with Strava.');
    },
    onError: () => {
      haptics.error();
      toast('Couldn’t reach Strava. Try again when you’re online.');
    },
  });
  const line = zoneLine(zones);
  if (!connected && !line) return null;
  return (
    <SRow
      className="s-zones"
      title="Heart-rate zones"
      sub={
        line ? (
          <>
            <span className="s-zones-line">{line}.</span> They come from Strava with each sync; Progress reads your easy runs by them.
          </>
        ) : (
          'No heart-rate zones yet. Sync and they come in with your runs.'
        )
      }
      right={
        connected ? (
          <ChipButton className="s-zones-sync" disabled={sync.isPending} onClick={() => sync.mutate()} aria-label="Sync heart-rate zones from Strava">
            {sync.isPending ? 'Syncing…' : 'Sync'}
          </ChipButton>
        ) : null
      }
    />
  );
};
