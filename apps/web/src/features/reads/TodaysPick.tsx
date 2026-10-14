import type { Link } from '@logbook/shared';
import { ArrowUpRight, Bookmark, ChevronRight, Copy, RotateCw, Sparkles, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useRef } from 'react';
import { usePick, useReadsMutations } from '@/api/queries';
import { haptics } from '@/lib/haptics';
import { fadeIn, fadeOut, springs, useReduced } from '@/lib/motion';
import { useToday } from '@/lib/useToday';
import { Button, ContextMenu, Group, useToast } from '@/ui';
import { openLink, useOpenLink } from './openLink';
import './reads.css';

/** The pick is still being made (10–20 s the first time each day): quiet bars the height of what is coming. Nothing spins. */
const Wait = ({ compact }: { compact?: boolean }) => (
  <div className={`rwait ${compact ? 'compact' : ''}`} role="status" aria-busy="true" aria-label="Finding today’s pick">
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

export const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
};
const labelOf = (p: Link, site: string) => `${p.title}. ${site}. Opens in a new window`;

/** A slim card for when there is no pick to show: one sentence, and a verb only when there is something to do. */
const Slim = ({ children, verb, busy }: { children: React.ReactNode; verb?: React.ReactNode; busy?: boolean }) => (
  <motion.section className="rp-slim" aria-label="Today’s pick" aria-busy={busy || undefined} initial={false} layout="position" transition={springs.settle}>
    <Sparkles size={18} className="rp-slim-icon" aria-hidden="true" />
    <div className="rp-slim-text">{children}</div>
    {verb}
  </motion.section>
);

/**
 * Today's pick: one article found on the web from what the athlete saves.
 * On Reads: the hero (an aura card, lit from below) only when a pick exists, else a slim card ("Save links and Logbook finds
 * you one a day"). With `compact`, one row for the Today page, and nothing at all when there is no pick.
 */
export const TodaysPick = ({ compact }: { compact?: boolean }) => {
  const date = useToday();
  const q = usePick(date);
  const { feedback, another } = useReadsMutations();
  const toast = useToast();
  const open = useOpenLink();
  const reduce = useReduced();
  const data = q.data ?? null;
  const off = data?.reason === 'off';
  const waiting = (q.isPending && !data) || another.isPending;
  const waited = useWaited(waiting);
  const p: Link | null = data?.pick ?? null;
  const left = data?.refreshesLeft ?? 0;
  const site = p ? p.siteName || hostOf(p.url) : '';
  const refresh = () => {
    another.mutate(date, {
      onSuccess: (r) => {
        if (r.reason === 'limit') toast('That’s all for today.');
        else if (r.reason === 'failed') toast('Nothing found this time.');
      },
      onError: () => toast('Couldn’t fetch a pick.'),
    });
  };
  const verdict = (v: 'saved' | 'dismissed') => {
    if (!p) return;
    if (v === 'saved') haptics.toggle();
    feedback.mutate({ pick: p, verdict: v, date, onGone: () => toast('That pick is gone.') }, { onSuccess: () => v === 'saved' && toast('Saved to your reads.') });
  };

  if (compact) {
    if (off || (!waiting && (!p || p.verdict === 'dismissed'))) return null;
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
          <a className="lrow two rp-crow" href={p.url} target="_blank" rel="noopener noreferrer" draggable={false} aria-label={labelOf(p, site)} onClick={open(p.url)}>
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

  // no pick to show: a slim card, never a big empty hero
  if (!p || waiting) {
    if (waiting && (waited || !data))
      return (
        <Slim busy>
          <span className="rp-slim-line">Finding today’s pick</span>
          <Wait compact />
        </Slim>
      );
    if (off) return <Slim>Daily picks are off. Your links still wait below.</Slim>;
    if (data?.reason === 'empty') return <Slim>Save links and Logbook finds you one a day.</Slim>;
    return (
      <Slim
        verb={
          data?.reason === 'failed' && left > 0 ? (
            <Button size="sm" className="rp-slim-verb" onClick={refresh}>
              <RotateCw size={14} aria-hidden="true" /> Retry
            </Button>
          ) : undefined
        }
      >
        {data?.reason === 'failed' ? (left > 0 ? 'Nothing new fit today.' : 'Nothing new fit today. Back tomorrow.') : 'That’s all for today. Back tomorrow.'}
      </Slim>
    );
  }

  const menu = [
    { label: 'Open', icon: <ArrowUpRight size={18} />, onSelect: () => void openLink(p.url) },
    ...(!p.verdict
      ? [
          { label: 'Save', icon: <Bookmark size={18} />, onSelect: () => verdict('saved') },
          { label: 'Skip', icon: <X size={18} />, onSelect: () => verdict('dismissed') },
        ]
      : []),
    ...(p.verdict && left > 0 ? [{ label: 'Next pick', icon: <RotateCw size={18} />, onSelect: refresh }] : []),
    { label: 'Copy link', icon: <Copy size={18} />, onSelect: () => void navigator.clipboard?.writeText(p.url).then(() => toast('Copied')) },
  ];
  return (
    <ContextMenu label="Today’s pick" items={menu}>
      <motion.section className="rp" aria-label="Today’s pick" initial={waited && !reduce ? { opacity: 0, y: 8 } : false} animate={{ opacity: 1, y: 0 }} transition={reduce ? { duration: 0.15 } : springs.settle}>
        <span className="rp-glow" aria-hidden="true" />
        <div className="rp-top">
          <span className="caps">
            Today’s pick<span className="rp-site"> · {site}</span>
          </span>
          {p.verdict ? <span className="caps rp-state">{p.verdict === 'saved' ? 'Saved' : 'Skipped'}</span> : null}
        </div>
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div key={p.id} className={`rp-body ${p.verdict === 'dismissed' ? 'dim' : ''}`} initial={{ opacity: 0 }} animate={{ opacity: 1, transition: fadeIn }} exit={{ opacity: 0, transition: fadeOut }}>
            <a className="rp-link" href={p.url} target="_blank" rel="noopener noreferrer" draggable={false} aria-label={labelOf(p, site)} onClick={open(p.url)}>
              <span className="rp-title display">{p.title}</span>
            </a>
            {p.pickReason ? <p className="rp-why">{p.pickReason}</p> : null}
            <span className="caps rp-site-sm">{site}</span>
          </motion.div>
        </AnimatePresence>
        <div className="rp-actions">
          {!p.verdict ? (
            <>
              <Button size="sm" onClick={() => verdict('saved')}>
                <Bookmark size={14} aria-hidden="true" /> Save
              </Button>
              <Button size="sm" variant="quiet" onClick={() => verdict('dismissed')}>
                Skip
              </Button>
            </>
          ) : left > 0 ? (
            <Button size="sm" variant="quiet" onClick={refresh}>
              <RotateCw size={14} aria-hidden="true" /> Next
            </Button>
          ) : (
            <span className="t-cap muted rp-note">That’s all for today.</span>
          )}
        </div>
      </motion.section>
    </ContextMenu>
  );
};
