import { ago, toISO, type Link, type PickResult } from '@logbook/shared';
import { ArrowUpRight, Check, Copy, Pencil, RotateCcw, Trash2 } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router';
import { keys, useReads, useReadsMutations } from '@/api/queries';
import { haptics } from '@/lib/haptics';
import { rowPresence, springs, useReduced } from '@/lib/motion';
import { useToday } from '@/lib/useToday';
import { Button, EmptyState, IconButton, Mark, PushedHeader, Segmented, SkeletonRows, SwipeRow, useSheet, useToast } from '@/ui';
import { openLink, useOpenLink } from './openLink';
import { TodaysPick } from './TodaysPick';
import './reads.css';

const URL_RE = /https?:\/\/[^\s<>"')\]]+|(?:^|\s)(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s<>"')\]]*)?/i;
/** The first link in a block of text, if there is one. */
const linkIn = (text: string): string | null => {
  const m = URL_RE.exec(text);
  return m ? m[0].trim() : null;
};
const hostOf = (url: string) => {
  try {
    return new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(url) ? url : `https://${url}`).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
};

/** Save a link: the field, the clipboard, or a paste anywhere on the page all end here. */
const useAddLink = () => {
  const { add } = useReadsMutations();
  const toast = useToast();
  const qc = useQueryClient();
  const date = useToday();
  return {
    pending: add.isPending,
    /** Sends only the link in `text`, never the words around it. Resolves false when there was no link or it failed. */
    save: (text: string, onFail?: (v: string) => void) => {
      const link = linkIn(text.trim());
      if (!link) return false;
      add.mutate(
        { url: link },
        {
          onSuccess: (r) => {
            if (r.existed) toast('Already saved.');
            else haptics.toggle();
            // the first saved link is what a pick learns from: ask again if there was nothing to go on
            const pick = qc.getQueryData<PickResult>(keys.pick(date));
            if (pick?.reason === 'empty') void qc.invalidateQueries({ queryKey: keys.pick(date) });
          },
          onError: (e) => {
            onFail?.(text);
            toast(e instanceof Error ? e.message : 'Couldn’t save that link.');
          },
        },
      );
      return true;
    },
  };
};

/** Quick add, on top: paste a link, tap Add. Add is the screen's one blue, and only once there is something to add. */
const QuickAdd = ({ inputRef }: { inputRef: React.RefObject<HTMLInputElement | null> }) => {
  const [url, setUrl] = useState('');
  const adder = useAddLink();
  const ready = !!linkIn(url.trim()) && !adder.pending;
  const submit = () => {
    const v = url;
    if (adder.save(v, setUrl)) setUrl('');
  };
  // a link pasted anywhere on the page lands in the field
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      const found = linkIn(e.clipboardData?.getData('text') ?? '');
      if (found) {
        setUrl(found);
        inputRef.current?.focus();
      }
    };
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  }, [inputRef]);
  return (
    <form
      className="radd"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <input
        ref={inputRef}
        className="in"
        type="text"
        inputMode="url"
        enterKeyHint="done"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        placeholder="Paste a link to keep"
        aria-label="Link to save"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        onPaste={(e) => {
          const found = linkIn(e.clipboardData.getData('text'));
          if (found) {
            e.preventDefault();
            setUrl(found);
          }
        }}
      />
      <Button type="submit" variant={ready ? 'primary' : 'quiet'} className={ready ? '' : 'idle'} disabled={!ready} aria-label="Add link">
        Add
      </Button>
    </form>
  );
};

/** The editor behind Edit: a note, tags, Delete and Save. Save is the sheet's one blue. */
const LinkSheet = ({ x, onDelete }: { x: Link; onDelete: () => void }) => {
  const { patch } = useReadsMutations();
  const sheet = useSheet();
  const [note, setNote] = useState(x.note ?? '');
  const [tags, setTags] = useState(x.tags.join(', '));
  const nextNote = note.trim();
  const nextTags = [...new Set(tags.split(/[,\s]+/).map((t) => t.trim().toLowerCase()).filter(Boolean))].slice(0, 8);
  const changed = nextNote !== (x.note ?? '') || nextTags.join(',') !== x.tags.join(',');
  const save = () => {
    if (!changed) return;
    patch.mutate({ id: x.id, note: nextNote || null, tags: nextTags });
    sheet.close();
  };
  return (
    <>
      <p className="rsheet-title">{x.title}</p>
      <span className="caps">{x.siteName || hostOf(x.url)}</span>
      <label className="rsheet-field">
        <span className="caps">Note</span>
        <textarea className="jtext serif rsheet-note" rows={3} maxLength={500} placeholder="Why you kept it" value={note} autoFocus={!x.note} onChange={(e) => setNote(e.target.value)} />
      </label>
      <label className="rsheet-field">
        <span className="caps">Tags</span>
        <input className="jtext rsheet-tags" maxLength={120} placeholder="running, sleep" value={tags} autoCapitalize="none" onChange={(e) => setTags(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), save())} />
      </label>
      <div className="sheet-foot">
        <Button
          variant="quiet"
          className="danger-quiet"
          onClick={() => {
            sheet.close();
            onDelete();
          }}
        >
          <Trash2 size={16} aria-hidden="true" /> Delete
        </Button>
        <div className="foot-right">
          <Button variant="primary" onClick={save} disabled={!changed}>
            Save
          </Button>
        </div>
      </div>
    </>
  );
};

/**
 * One saved link. The mark at the left flips read / unread (the check draws, then the row leaves), the title opens the link
 * (and counts it read when you come back), Edit opens the sheet. Swipe right: Read (or Unread). Swipe left: Delete, with
 * Undo. Hold: Open, Read, Edit, Copy link, Delete.
 */
const LinkRow = ({ x, today, onFlip, onDelete, onEdit, onOpened }: { x: Link; today: string; onFlip: (via: 'tap' | 'swipe') => void; onDelete: () => void; onEdit: () => void; onOpened: () => void }) => {
  const open = useOpenLink();
  const toast = useToast();
  const [ticked, setTicked] = useState(false);
  const read = !!x.readAt;
  const shown = ticked ? !read : read;
  const site = x.siteName || hostOf(x.url);
  return (
    <SwipeRow
      label={x.title}
      right={{ label: read ? 'Unread' : 'Read', icon: read ? <RotateCcw size={20} /> : <Check size={20} />, tone: read ? 'neutral' : 'ok', onCommit: () => onFlip('swipe') }}
      left={{ label: 'Delete', icon: <Trash2 size={20} />, tone: 'bad', onCommit: onDelete }}
      menuItems={[
        { label: 'Open', icon: <ArrowUpRight size={18} />, onSelect: () => (void openLink(x.url), read ? undefined : onOpened()) },
        { label: 'Edit', icon: <Pencil size={18} />, onSelect: onEdit },
        { label: 'Copy link', icon: <Copy size={18} />, onSelect: () => void navigator.clipboard?.writeText(x.url).then(() => toast('Copied')) },
      ]}
    >
      <div className={`rrow ${shown ? 'is-read' : ''}`}>
        <Mark
          status={shown ? 'done' : 'open'}
          label={x.title}
          title={read ? 'Mark unread' : 'Mark read'}
          haptic={false}
          onClick={() => {
            if (ticked) return;
            haptics.toggle();
            setTicked(true);
            // the check draws, then the row moves to the other list
            setTimeout(() => onFlip('tap'), 420);
          }}
        />
        <a className="rrow-link" href={x.url} target="_blank" rel="noopener noreferrer" draggable={false} aria-label={`${x.title}. ${site}. Opens in a new window`} onClick={open(x.url, read ? undefined : onOpened)}>
          <span className="rrow-title">{x.title}</span>
          <span className="caps rrow-meta">
            {site} · {ago(toISO(new Date(x.addedAt)), today)}
          </span>
          {x.note ? <span className="rrow-note">{x.note}</span> : null}
        </a>
        <IconButton label={`Edit ${x.title}`} className="rrow-edit" onClick={onEdit}>
          <Pencil size={16} />
        </IconButton>
      </div>
    </SwipeRow>
  );
};

/** Ghost rows for the empty list: what it looks like with links in it, at 30%. */
const Ghost = () => (
  <div className="rlist-ghost">
    {[
      ['The long run, explained', 'outsideonline.com'],
      ['Why sleep is the cheapest recovery', 'nytimes.com'],
    ].map(([t, s]) => (
      <div key={t} className="rrow">
        <span className="mark-hit">
          <span className="mark m-open" />
        </span>
        <span className="rrow-link">
          <span className="rrow-title">{t}</span>
          <span className="caps rrow-meta">{s} · today</span>
        </span>
      </div>
    ))}
  </div>
);

type Tab = 'unread' | 'read';
/** Reads (docs/experience.md §5.6), pushed from Journal → Library: quick add on top, today's pick, then the links. */
export default function ReadsView() {
  const params = useParams();
  const nav = useNavigate();
  const tab: Tab = params.tab === 'read' ? 'read' : 'unread';
  const today = useToday();
  const reads = useReads();
  const { patch, remove, restore } = useReadsMutations();
  const sheet = useSheet();
  const toast = useToast();
  const reduce = useReduced();
  const input = useRef<HTMLInputElement>(null);
  const adder = useAddLink();
  const all = reads.data ?? [];
  const unread = useMemo(() => all.filter((x) => !x.readAt), [all]);
  const read = useMemo(() => all.filter((x) => x.readAt), [all]);
  const list = tab === 'read' ? read : unread;
  const prevTab = useRef(tab);
  const dir = tab === prevTab.current ? 0 : tab === 'read' ? 1 : -1;
  useEffect(() => {
    prevTab.current = tab;
  }, [tab]);

  const del = (x: Link) => {
    haptics.delete();
    remove.mutate(x);
    toast('Deleted', { label: 'Undo', fn: () => restore.mutate(x) });
  };
  const flip = (x: Link) => {
    const was = x.readAt;
    patch.mutate({ id: x.id, readAt: was ? null : new Date().toISOString() });
    toast(was ? 'Marked unread' : 'Marked read', { label: 'Undo', fn: () => patch.mutate({ id: x.id, readAt: was }) });
  };
  /** The empty state's verb: take a link off the clipboard if there is one, else open the field. */
  const paste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (adder.save(text)) return;
      toast('No link on the clipboard. Paste one above.');
    } catch {
      /* no clipboard permission: the field it is */
    }
    input.current?.focus();
  };
  const variants = {
    enter: (d: number) => (reduce || !d ? { opacity: 0 } : { opacity: 0, x: `${d * 24}%` }),
    center: { opacity: 1, x: 0 },
    exit: (d: number) => (reduce || !d ? { opacity: 0 } : { opacity: 0, x: `${d * -24}%` }),
  };
  return (
    <div className="page reads-page">
      <PushedHeader title="Reads" />
      <QuickAdd inputRef={input} />
      <TodaysPick />
      <div className="r-lists">
        <Segmented
          className="r-tabs"
          label="Unread or read"
          options={[
            ['unread', `Unread${unread.length ? ` · ${unread.length}` : ''}`],
            ['read', `Read${read.length ? ` · ${read.length}` : ''}`],
          ]}
          value={tab}
          onChange={(k) => nav(k === 'unread' ? '/reads' : '/reads/read', { replace: true })}
        />
        <div className="r-stage">
          <AnimatePresence mode="popLayout" initial={false} custom={dir}>
            <motion.div key={tab} custom={dir} variants={variants} initial="enter" animate="center" exit="exit" transition={reduce ? { duration: 0.15 } : { x: springs.page, opacity: { duration: 0.12 } }}>
              {reads.isPending && !reads.data ? (
                <SkeletonRows rows={3} label="Loading your links" />
              ) : !list.length ? (
                tab === 'read' ? (
                  <EmptyState verb={{ label: 'Show unread', onPress: () => nav('/reads', { replace: true }) }}>Links you finish move here.</EmptyState>
                ) : (
                  <EmptyState ghost={all.length ? undefined : <Ghost />} verb={{ label: 'Paste a link', onPress: () => void paste() }}>
                    {all.length ? 'All read. The next link you keep lands here.' : 'Links you keep wait here, unread first.'}
                  </EmptyState>
                )
              ) : (
                <div className="rlist">
                  <AnimatePresence initial={false}>
                    {list.map((x) => (
                      <motion.div key={x.id} className="rlist-item" {...rowPresence}>
                        <LinkRow
                          x={x}
                          today={today}
                          onFlip={(via) => (via === 'swipe' && haptics.toggle(), flip(x))}
                          onDelete={() => del(x)}
                          onOpened={() => patch.mutate({ id: x.id, readAt: new Date().toISOString() })}
                          onEdit={() => sheet.open({ eyebrow: 'Link', title: 'Edit', body: <LinkSheet x={x} onDelete={() => del(x)} /> })}
                        />
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
