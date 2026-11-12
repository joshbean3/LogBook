import { recallDay, type Learning, type RecallItem } from '@logbook/shared';
import { Bell, Copy, Download, EyeOff, Loader2, Share, Shuffle } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useJournalList } from '@/api/queries';
import { haptics } from '@/lib/haptics';
import { isNative } from '@/lib/native';
import { crossfade, fadeIn, useReduced } from '@/lib/motion';
import { Card, Skeleton, SkeletonGroup } from '@/ui';
import { Button } from '@/ui/primitives';
import { useSheet } from '@/ui/Sheet';
import { useToast } from '@/ui/Toast';
import { PressButton } from './PressButton';
import { useLearningEchoes } from '../learned/queries';
import { useAiConsent } from './queries';
import { plainLine, recallItemOf, recallKey, useRecall, useRecallActions, writtenByAi } from './recall';
import { shareImage } from '../share/shareOut';
import { drawRecall, recallText } from './recallShare';
import './recall.css';

/**
 * Share Remember when: the card as it will look, then Share image (the app's native share sheet, where Save Image lives)
 * or, in a browser, Save as image (the browser's share sheet where it takes files, else a download), and Copy text. "Image
 * saved" is said only after a download, the one real save.
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
    try {
      const how = await shareImage(img.blob, `remember-when-${when.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.png`, 'share');
      if (how === 'saved') toast('Image saved');
      if (how !== 'cancelled') sheet.close();
    } catch {
      toast('Couldn’t share the image. Copy the text instead.');
    }
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
      <div className="recall-share-actions btn-stack">
        <Button variant="primary" block onClick={() => void save()} disabled={!img}>
          {isNative ? <Share size={17} aria-hidden="true" /> : <Download size={17} aria-hidden="true" />} {isNative ? 'Share image' : 'Save as image'}
        </Button>
        <Button block onClick={() => void copy()}>
          <Copy size={17} aria-hidden="true" /> Copy text
        </Button>
      </div>
    </div>
  );
};

/**
 * A line from the archive, in the same card (the Learned tab's "From your archive", folded in): shown only on a day the
 * server has nothing to remember (`useRecall` answers no item), so there is one object from the past on the page, never
 * two. It is the line nearest a year ago, else a month ago, else one from any day; "Another" steps through the ones there
 * are. The words are the person's own, so nothing is marked as written by anyone else. A tap opens the line's sheet.
 */
const EchoCard = ({ today, onOpenLine }: { today: string; onOpenLine: (l: Learning) => void }) => {
  const e = useLearningEchoes().data;
  const sheet = useSheet();
  const [at, setAt] = useState(0);
  const slots = [
    { when: 'A year ago', item: e?.yearAgo },
    { when: 'A month ago', item: e?.monthAgo },
    { when: null, item: e?.random },
  ].filter((x): x is { when: string | null; item: Learning } => !!x.item);
  const cur = slots[at % Math.max(1, slots.length)];
  if (!cur) return null;
  const { item, when } = cur;
  const line = plainLine({ kind: 'learning', date: item.date, excerpt: item.text }, today);
  return (
    <div className="recall-wrap">
      <Card className="recall" aria-label="Remember when">
        <div className="recall-head">
          <div className="recall-top">
            <p className="caps recall-eyebrow">
              Remember when
              {when ? (
                <>
                  {' '}
                  <span aria-hidden="true">·</span> {when}
                </>
              ) : null}
            </p>
            <PressButton press="dim" className="recall-share-btn" aria-label="Share" onClick={() => (haptics.select(), sheet.open({ eyebrow: 'Remember when', title: 'Share', body: <ShareRecall summary={line} when={recallDay(item.date, today)} /> }))}>
              <Share size={18} aria-hidden="true" />
            </PressButton>
          </div>
          <div className="recall-stack">
            <div className="recall-body">
              <PressButton press="dim" className="recall-text" onClick={() => (haptics.select(), onOpenLine(item))} aria-label={`${line} Open the line`}>
                <span className="recall-quote">{line}</span>
              </PressButton>
            </div>
          </div>
        </div>
        {slots.length > 1 ? (
          <div className="recall-tools">
            <PressButton press="dim" className="recall-tool" onClick={() => (haptics.select(), setAt((n) => n + 1))}>
              <Shuffle size={18} aria-hidden="true" />
              Another
            </PressButton>
          </div>
        ) : null}
      </Card>
    </div>
  );
};

/**
 * "Remember when" (on the Journal tab, under today's rows; layout standard 6.9): one past entry or line a day. The card's
 * tinted header holds all of it: the caption, Share, and the reminder in the serif ("On Oct 11 you wrote: “…”", at most
 * four lines). Tap the words to open that day on its month's page. On Paper under the header, three quiet verbs: Remind
 * me more (the server picks it four times as often), Another, Hide (with Undo). Nothing eligible: a line from the archive
 * in the same card (`EchoCard`), and with none of those either, no card at all; it fades in once there is one, and a
 * change of item cross-fades in place.
 *
 * The reminder is Claude's line only when the account has said yes to that (the recall switch, Contract 1; the server
 * holds the same switch). Then it is marked "Written by AI", and the line itself opens the entry. With the switch off the
 * card shows the plain line made here from the entry's own words. The caption carries the date only when the line does
 * not already open with it (say it once).
 */
export const RecallCard = ({ today, onOpenDay, onOpenLine }: { today: string; onOpenDay: (date: string) => void; /** A tap on a line from the archive: its sheet. */ onOpenLine: (l: Learning) => void }) => {
  const q = useRecall(today);
  const { another, prefs } = useRecallActions(today);
  const toast = useToast();
  const sheet = useSheet();
  const qc = useQueryClient();
  const reduce = useReduced();
  const raw = q.data?.item;
  const item = useMemo(() => recallItemOf(raw), [raw]);
  const { recall } = useAiConsent();
  const byAi = !!item && recall && writtenByAi(item, today);
  /** The words on the card: Claude's line only with the switch on, else the entry's own opening. */
  const lineOf = (it: RecallItem) => (recall ? it.summary : plainLine(it, today));

  // the entry it shows was deleted (the journal's list is complete and no longer has it): ask for today's again
  const list = useJournalList('', false);
  const gone = !!item && item.kind === 'journal' && !!list.data && !list.data.more && !list.data.entries.some((e) => e.id === item.id || e.id.startsWith('tmp-'));
  useEffect(() => {
    if (gone) void qc.invalidateQueries({ queryKey: recallKey(today) });
  }, [gone, qc, today]);

  const open = (it: RecallItem) => {
    haptics.select();
    onOpenDay(it.date);
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
      onError: () => toast('Couldn’t reach Orby. Try again.'),
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
    sheet.open({ eyebrow: 'Remember when', title: 'Share', body: <ShareRecall summary={lineOf(it)} when={recallDay(it.date, today)} /> });
  };

  const busy = another.isPending || (prefs.isPending && prefs.variables?.hidden !== undefined);
  // the first answer holds its place with a card of the same build, so the calendar under it never jumps; the space is
  // given back only once the answer is that there is nothing to remember
  if (q.isPending)
    return (
      <div className="recall-wrap">
        <Card className="recall is-loading" aria-label="Remember when">
          <SkeletonGroup label="Loading Remember when" className="recall-skel">
            <div className="recall-head">
              <div className="recall-top">
                <Skeleton w={120} h={12} />
                <span className="recall-share-btn is-ghost" aria-hidden="true" />
              </div>
              <div className="recall-skel-lines">
                <Skeleton w="92%" h={20} />
                <Skeleton w="64%" h={20} />
              </div>
            </div>
            <div className="recall-tools" aria-hidden="true">
              <Skeleton w={120} h={14} />
              <Skeleton w={64} h={14} />
              <Skeleton w={40} h={14} />
            </div>
          </SkeletonGroup>
        </Card>
      </div>
    );
  // nothing to remember today: a line from the archive takes the card's place, when there is one
  if (!item && !q.isError && q.data) return <EchoCard today={today} onOpenLine={onOpenLine} />;
  const day = item ? recallDay(item.date, today) : '';
  // the plain line opens with the date ("On Oct 11 you wrote"); a line written by the assistant may not
  const dated = !!item && !lineOf(item).startsWith(`On ${day} `);
  return (
    <AnimatePresence initial={false}>
      {item ? (
        <motion.div key="recall" className="recall-wrap" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={fadeIn}>
          <Card className="recall" aria-label="Remember when" aria-busy={busy || undefined}>
            <div className="recall-head">
              <div className="recall-top">
                <p className="caps recall-eyebrow">
                  Remember when
                  {dated ? (
                    <>
                      {' '}
                      <span aria-hidden="true">·</span> {day}
                    </>
                  ) : null}
                </p>
                <PressButton press="dim" className="recall-share-btn" aria-label="Share" onClick={() => share(item)}>
                  <Share size={18} aria-hidden="true" />
                </PressButton>
              </div>
              <div className="recall-stack">
                <AnimatePresence initial={false}>
                  <motion.div key={`${item.kind}:${item.id}`} className="recall-body" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={reduce ? fadeIn : crossfade}>
                    <PressButton press="dim" className="recall-text" onClick={() => open(item)} aria-label={`${lineOf(item)} Open that day`}>
                      <span className="recall-quote">{lineOf(item)}</span>
                    </PressButton>
                    {byAi ? <p className="recall-ai">Written by AI</p> : null}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
            <div className="recall-tools">
              <PressButton press="dim" className={`recall-tool is-boost ${item.boosted ? 'is-on' : ''}`} aria-pressed={item.boosted} onClick={() => boost(item)}>
                <Bell size={18} aria-hidden="true" fill={item.boosted ? 'currentColor' : 'none'} />
                Remind me more
              </PressButton>
              <PressButton press="dim" className="recall-tool" onClick={() => shuffle(item)} disabled={busy} aria-busy={another.isPending || undefined}>
                {another.isPending ? <Loader2 size={18} aria-hidden="true" className="recall-spin" /> : <Shuffle size={18} aria-hidden="true" />}
                Another
              </PressButton>
              <PressButton press="dim" className="recall-tool" onClick={() => hide(item)} disabled={busy}>
                <EyeOff size={18} aria-hidden="true" />
                Hide
              </PressButton>
            </div>
          </Card>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
};
