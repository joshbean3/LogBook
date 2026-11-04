import { recallDay, type RecallItem } from '@logbook/shared';
import { Bell, EyeOff, Shuffle } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNav } from '@/app/NavController';
import { useJournalList } from '@/api/queries';
import { haptics } from '@/lib/haptics';
import { crossfade, fadeIn, useReduced } from '@/lib/motion';
import { Card } from '@/ui';
import { useToast } from '@/ui/Toast';
import { PressButton } from './PressButton';
import { recallKey, useRecall, useRecallActions } from './recall';
import './recall.css';

/**
 * "Remember when" (the top of the Journal tab): one past entry or learning a day, as a short reminder in the serif on a
 * card lit faintly from below. Tap the words to open that day's page (a learning opens What I learned). Under it three quiet
 * verbs: Remind me more (the server picks it four times as often), Another, Hide (with Undo). Nothing eligible, or still
 * loading: no card at all; it fades in once there is one, and a change of item cross-fades in place.
 */
export const RecallCard = ({ today, onOpenDay }: { today: string; onOpenDay: (date: string) => void }) => {
  const q = useRecall(today);
  const { another, prefs } = useRecallActions(today);
  const toast = useToast();
  const nav = useNav();
  const qc = useQueryClient();
  const reduce = useReduced();
  const item = q.data?.item ?? null;

  // the entry it shows was deleted (the journal's list is complete and no longer has it): ask for today's again
  const list = useJournalList('', false);
  const gone = !!item && item.kind === 'journal' && !!list.data && !list.data.more && !list.data.entries.some((e) => e.id === item.id || e.id.startsWith('tmp-'));
  useEffect(() => {
    if (gone) void qc.invalidateQueries({ queryKey: recallKey(today) });
  }, [gone, qc, today]);

  const open = (it: RecallItem) => {
    haptics.select();
    if (it.kind === 'learning') nav.go('/learned');
    else onOpenDay(it.date);
  };
  const boost = (it: RecallItem) => {
    const on = !it.boosted;
    haptics.toggle();
    prefs.mutate({ kind: it.kind, id: it.id, boost: on }, { onError: () => toast('Couldn’t save that. Try again.') });
    if (on) toast('You’ll see this one more often');
  };
  const shuffle = (it: RecallItem) => {
    haptics.select();
    another.mutate(undefined, {
      onSuccess: (s) => {
        if (s.item?.id === it.id && s.item.kind === it.kind) toast('Nothing else to remember yet');
      },
      onError: () => toast('Couldn’t reach Logbook. Try again.'),
    });
  };
  const hide = (it: RecallItem) => {
    haptics.select();
    prefs.mutate(
      { kind: it.kind, id: it.id, hidden: true },
      {
        onSuccess: () => toast('Hidden from Remember when', { label: 'Undo', fn: () => prefs.mutate({ kind: it.kind, id: it.id, hidden: false }) }),
        onError: () => toast('Couldn’t hide that. Try again.'),
      },
    );
  };

  const busy = another.isPending || (prefs.isPending && prefs.variables?.hidden !== undefined);
  return (
    <AnimatePresence initial={false}>
      {item ? (
        <motion.div key="recall" className="recall-wrap" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={fadeIn}>
          <Card className="recall" aria-label="Remember when" aria-busy={busy || undefined}>
            <span className="recall-glow" aria-hidden="true" />
            <div className="recall-stack">
              <AnimatePresence initial={false}>
                <motion.div key={`${item.kind}:${item.id}`} className="recall-body" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={reduce ? fadeIn : crossfade}>
                  <p className="caps recall-eyebrow">
                    Remember when <span aria-hidden="true">·</span> {recallDay(item.date, today)}
                  </p>
                  <PressButton press="dim" className="recall-text" onClick={() => open(item)} aria-label={`${item.summary} ${item.kind === 'learning' ? 'Open What I learned' : 'Open that day'}`}>
                    {item.summary}
                  </PressButton>
                </motion.div>
              </AnimatePresence>
            </div>
            <div className="recall-tools">
              <PressButton press="dim" className={`recall-tool is-boost ${item.boosted ? 'is-on' : ''}`} aria-pressed={item.boosted} onClick={() => boost(item)}>
                <Bell size={14} aria-hidden="true" fill={item.boosted ? 'currentColor' : 'none'} />
                Remind me more
              </PressButton>
              <PressButton press="dim" className="recall-tool" onClick={() => shuffle(item)} disabled={busy}>
                <Shuffle size={14} aria-hidden="true" />
                Another
              </PressButton>
              <PressButton press="dim" className="recall-tool" onClick={() => hide(item)} disabled={busy}>
                <EyeOff size={14} aria-hidden="true" />
                Hide
              </PressButton>
            </div>
          </Card>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
};
