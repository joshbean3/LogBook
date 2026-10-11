import type { StravaStatus } from '@logbook/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import { keys } from '@/api/queries';
import { useToast } from '@/ui/Toast';

/** "Strava synced 4 min ago · Refresh": one quiet line under the header. */
export const StravaLine = ({ strava }: { strava: StravaStatus | null }) => {
  const qc = useQueryClient();
  const toast = useToast();
  const sync = useMutation({
    mutationFn: () => api<{ changed?: number }>('/strava/sync', { method: 'POST' }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['month'] });
      await qc.invalidateQueries({ queryKey: keys.bootstrap });
      await qc.invalidateQueries({ queryKey: keys.activities });
    },
    onError: (e) => toast(e instanceof Error ? e.message : 'Strava sync failed'),
  });
  if (!strava || !strava.connected) return null;
  const at = strava.lastSyncAt ? Date.now() - new Date(strava.lastSyncAt).getTime() : null;
  const m = at == null ? null : Math.round(at / 60e3);
  const text = sync.isPending ? 'Checking Strava…' : m == null ? 'Strava connected' : `Strava synced ${m < 1 ? 'just now' : m < 60 ? `${m} min ago` : `${Math.round(m / 60)} h ago`}`;
  return (
    <div className="row" style={{ fontSize: 12.5, color: 'var(--ink-3)', gap: 8 }}>
      <span className={`dot ${sync.isPending ? 'on' : ''}`} />
      <span>{text}</span>
      {!sync.isPending ? (
        <button type="button" className="link sm" onClick={() => sync.mutate()}>
          Refresh
        </button>
      ) : null}
    </div>
  );
};
