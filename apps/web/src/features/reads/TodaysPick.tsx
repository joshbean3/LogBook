import type { Link } from '@logbook/shared';
import { ChevronRight } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useRef } from 'react';
import { usePick, useReadsMutations } from '@/api/queries';
import { useToday } from '@/lib/useToday';
import { ChipButton, Group } from '@/ui/primitives';
import { useToast } from '@/ui/Toast';
import { useOpenLink } from './openLink';
import './reads.css';

const FADE = { duration: 0.2, ease: 'easeOut' as const };

/** The pick is still being made (10–20 s the first time each day): the card holds its height with two quiet bars. */
const Wait = ({ compact }: { compact?: boolean }) => (
  <div className={`rwait ${compact ? 'compact' : ''}`} aria-busy="true" aria-label="Finding today’s pick">
    <span className="rwait-bar" />
    <span className="rwait-bar short" />
  </div>
);

/** True once this card has shown a placeholder, so the content that replaces it fades in; later swaps already animate on key. */
const useWaited = (waiting: boolean) => {
  const waited = useRef(false);
  if (waiting) waited.current = true;
  return waited.current;
};

/**
 * Today's pick: one article found on the web from what the athlete saves.
 * The hero on Reads (an aura card, lit from below) or, with `compact`, one row for the Today page.
 */
export const TodaysPick = ({ compact }: { compact?: boolean }) => {
  const date = useToday();
  const q = usePick(date);
  const { feedback, another } = useReadsMutations();
  const toast = useToast();
  const open = useOpenLink();
  const data = q.data ?? null;
  const waiting = (q.isPending && !data) || another.isPending;
  const waited = useWaited(waiting);
  if (data?.reason === 'off') return null;
  const p: Link | null = data?.pick ?? null;
  const left = data?.refreshesLeft ?? 0;
  const site = p ? p.siteName || hostOf(p.url) : '';
  const refresh = () => {
    another.mutate(date, {
      onSuccess: (r) => {
        if (r.reason === 'limit') toast('That’s all for today.');
        else if (r.reason === 'failed') toast('Nothing found this time.');
      },
      onError: () => toast('Couldn’t reach the server.'),
    });
  };

  if (compact) {
    if (!waiting && (!p || p.verdict === 'dismissed')) return null;
    return (
      <Group className="rp-compact">
        {waiting ? (
          <div className="lrow two">
            <div className="lrow-main">
              <span className="caps">Today’s read</span>
              <Wait compact />
            </div>
          </div>
        ) : p ? (
          <a className="lrow two rp-crow" href={p.url} target="_blank" rel="noopener noreferrer" draggable={false} onClick={open(p.url)}>
            <div className="lrow-main">
              <span className="caps">Today’s read · {site}</span>
              <span className="lrow-title">{p.title}</span>
            </div>
            <ChevronRight size={18} className="muted" aria-hidden="true" />
          </a>
        ) : null}
      </Group>
    );
  }

  const eyebrow = p && !waiting ? `Today’s pick · ${site}` : 'Today’s pick';
  return (
    <section className="rp" aria-label="Today’s pick">
      <span className="rp-glow" aria-hidden="true" />
      <div className="rp-top">
        <span className="caps">{eyebrow}</span>
        {p && !waiting && p.verdict ? <span className="caps rp-state">{p.verdict === 'saved' ? 'Saved' : 'Skipped'}</span> : null}
      </div>
      {waiting ? (
        <Wait />
      ) : !p ? (
        <div className="rp-body">
          <p className="rp-title display">{data?.reason === 'empty' ? 'Nothing to go on yet.' : 'Nothing found today.'}</p>
          <p className="rp-why">{data?.reason === 'empty' ? 'Save a link or two below. Your daily pick learns from what you keep.' : left ? 'The web had nothing new that fit. Try once more, or come back tomorrow.' : 'Come back tomorrow.'}</p>
        </div>
      ) : (
        <AnimatePresence mode="popLayout" initial={waited}>
          <motion.div key={p.id} className={`rp-body ${p.verdict === 'dismissed' ? 'dim' : ''}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={FADE}>
            <a className="rp-link" href={p.url} target="_blank" rel="noopener noreferrer" draggable={false} onClick={open(p.url)}>
              <span className="rp-title display">{p.title}</span>
            </a>
            {p.pickReason ? <p className="rp-why">{p.pickReason}</p> : null}
          </motion.div>
        </AnimatePresence>
      )}
      <div className="rp-actions">
        {!waiting && p && !p.verdict ? (
          <>
            <ChipButton
              quiet
              onClick={() => {
                feedback.mutate({ pick: p, verdict: 'saved', date });
                toast('Kept. It’s in your list.');
              }}
            >
              Save
            </ChipButton>
            <ChipButton
              quiet
              onClick={() => {
                feedback.mutate({ pick: p, verdict: 'dismissed', date });
              }}
            >
              Skip
            </ChipButton>
          </>
        ) : null}
        {!waiting && (data?.reason === 'failed' || (p && p.verdict)) && left > 0 ? (
          <ChipButton quiet onClick={refresh}>
            {data?.reason === 'failed' ? 'Try again' : 'Another'}
          </ChipButton>
        ) : null}
        {!waiting && p && p.verdict && left <= 0 ? <span className="t-cap muted rp-note">That’s all for today.</span> : null}
      </div>
    </section>
  );
};

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
};
