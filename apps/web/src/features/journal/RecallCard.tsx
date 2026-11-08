import { recallDay, type RecallItem } from '@logbook/shared';
import { Bell, Copy, Download, EyeOff, Share, Shuffle } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNav } from '@/app/NavController';
import { useJournalList } from '@/api/queries';
import { haptics } from '@/lib/haptics';
import { crossfade, fadeIn, useReduced } from '@/lib/motion';
import { Card } from '@/ui';
import { Button } from '@/ui/primitives';
import { useSheet } from '@/ui/Sheet';
import { useToast } from '@/ui/Toast';
import { PressButton } from './PressButton';
import { recallKey, useRecall, useRecallActions } from './recall';
import { drawRecall, recallText, saveImage } from './recallShare';
import './recall.css';

/**
 * Share Remember when: the card as it will look, then Save as image (the share sheet on a phone, a download on the web) or
 * Copy text.
 */
const ShareRecall = ({ summary, when }: { summary: string; when: string }) => {
  const toast = useToast();
  const sheet = useSheet();
  const [img, setImg] = useState<{ blob: Blob; url: string } | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let url = '';
    let dead = false;
    drawRecall(summary, when)
      .then((blob) => {
        if (dead) return;
        url = URL.createObjectURL(blob);
        setImg({ blob, url });
      })
      .catch(() => {
        if (!dead) setFailed(true);
      });
    return () => {
      dead = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [summary, when]);
  const save = async () => {
    if (!img) return;
    haptics.select();
    const how = await saveImage(img.blob, `remember-when-${when.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.png`);
    if (how === 'downloaded') toast('Image saved');
    if (how !== 'cancelled') sheet.close();
  };
  const copy = async () => {
    haptics.select();
    try {
      await navigator.clipboard.writeText(recallText(summary, when));
      toast('Copied');
      sheet.close();
    } catch {
      toast('Couldn’t copy that.');
    }
  };
  return (
    <div className="recall-share">
      <div className="recall-share-preview">
        {img ? <img src={img.url} alt={`Remember when, ${when}: ${summary}`} /> : <span className="recall-share-wait">{failed ? 'The image could not be drawn. Copy the text instead.' : ' '}</span>}
      </div>
      <div className="recall-share-actions">
        <Button variant="primary" block onClick={() => void save()} disabled={!img}>
          <Download size={17} aria-hidden="true" /> Save as image
        </Button>
        <Button block onClick={() => void copy()}>
          <Copy size={17} aria-hidden="true" /> Copy text
        </Button>
      </div>
    </div>
  );
};

/**
 * "Remember when" (the top of the Journal tab): one past entry or learning a day, as an insight card: a soft Columbia header
 * with the date and Share, the reminder in the serif under it. Tap the words to open that day's page (a learning opens What
 * I learned). Under it three quiet verbs: Remind me more (the server picks it four times as often), Another, Hide (with
 * Undo). Nothing eligible, or still loading: no card at all; it fades in once there is one, and a change of item
 * cross-fades in place.
 */
export const RecallCard = ({ today, onOpenDay }: { today: string; onOpenDay: (date: string) => void }) => {
  const q = useRecall(today);
  const { another, prefs } = useRecallActions(today);
  const toast = useToast();
  const nav = useNav();
  const sheet = useSheet();
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
  const share = (it: RecallItem) => {
    haptics.select();
    sheet.open({ eyebrow: 'Remember when', title: 'Share', body: <ShareRecall summary={it.summary} when={recallDay(it.date, today)} /> });
  };

  const busy = another.isPending || (prefs.isPending && prefs.variables?.hidden !== undefined);
  return (
    <AnimatePresence initial={false}>
      {item ? (
        <motion.div key="recall" className="recall-wrap" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={fadeIn}>
          <Card className="recall" aria-label="Remember when" aria-busy={busy || undefined}>
            <div className="recall-head">
              <span className="recall-head-light" aria-hidden="true" />
              <p className="caps recall-eyebrow">
                Remember when <span aria-hidden="true">·</span> {recallDay(item.date, today)}
              </p>
              <PressButton press="dim" className="recall-share-btn" aria-label="Share" onClick={() => share(item)}>
                <Share size={17} aria-hidden="true" />
              </PressButton>
            </div>
            <div className="recall-stack">
              <AnimatePresence initial={false}>
                <motion.div key={`${item.kind}:${item.id}`} className="recall-body" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={reduce ? fadeIn : crossfade}>
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
