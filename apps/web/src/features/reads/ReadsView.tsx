import { ago, type Link } from '@logbook/shared';
import { Check, RotateCcw, Trash2 } from 'lucide-react';
import { AnimatePresence, motion, useMotionValue, useReducedMotion } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router';
import { keys, useReads, useReadsMutations } from '@/api/queries';
import type { PickResult } from '@logbook/shared';
import { haptic } from '@/lib/haptics';
import { useToday } from '@/lib/useToday';
import { Button, EmptyState, Group, PageHeader, Segmented } from '@/ui/primitives';
import { useSheet } from '@/ui/Sheet';
import { useToast } from '@/ui/Toast';
import { useOpenLink } from './openLink';
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

/** Paste a link, tap Add. Add is the screen's one blue, and only once there is something to add. */
const QuickAdd = () => {
  const [url, setUrl] = useState('');
  const { add } = useReadsMutations();
  const toast = useToast();
  const qc = useQueryClient();
  const date = useToday();
  const input = useRef<HTMLInputElement>(null);
  const ready = !!linkIn(url.trim()) && !add.isPending;
  const submit = () => {
    const v = url.trim();
    if (!v) return;
    setUrl('');
    add.mutate(
      { url: v },
      {
        onSuccess: () => {
          // the first saved link is what a pick learns from: ask again if there was nothing to go on
          const pick = qc.getQueryData<PickResult>(keys.pick(date));
          if (pick?.reason === 'empty') void qc.invalidateQueries({ queryKey: keys.pick(date) });
        },
        onError: (e) => {
          setUrl(v);
          toast(e instanceof Error ? e.message : 'Couldn’t save that link.');
        },
      },
    );
  };
  // a link pasted anywhere on the page lands in the field
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      const found = linkIn(e.clipboardData?.getData('text') ?? '');
      if (found) {
        setUrl(found);
        input.current?.focus();
      }
    };
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  }, []);
  return (
    <form
      className="radd"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <input
        ref={input}
        className="in"
        type="text"
        inputMode="url"
        enterKeyHint="done"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        placeholder="Paste a link"
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
      <Button type="submit" variant={ready ? 'primary' : 'quiet'} disabled={!ready} aria-label="Add link">
        Add
      </Button>
    </form>
  );
};

/** The editor behind a long press: a note, tags, Delete and Save. Save is the sheet's one blue. */
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
        <input className="jtext" maxLength={120} placeholder="running, sleep" value={tags} autoCapitalize="none" onChange={(e) => setTags(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), save())} />
      </label>
      <div className="sheet-foot">
        <Button
          variant="danger"
          onClick={() => {
            sheet.close();
            onDelete();
          }}
        >
          Delete
        </Button>
        <div className="foot-right">
          <Button variant="ghost" onClick={() => sheet.close()}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save} disabled={!changed}>
            Save
          </Button>
        </div>
      </div>
    </>
  );
};

/** One saved link: the title is the link; swipe right to mark read (or unread), left to delete; hold to edit. */
const LinkRow = ({ x, today, onFlip, onDelete, onEdit, onOpened }: { x: Link; today: string; onFlip: () => void; onDelete: () => void; onEdit: () => void; onOpened: () => void }) => {
  const reduce = useReducedMotion();
  const open = useOpenLink();
  const [gone, setGone] = useState<'left' | 'right' | null>(null);
  const armed = useRef<'left' | 'right' | null>(null);
  const dragged = useRef(false);
  const hold = useRef<{ timer: ReturnType<typeof setTimeout>; x: number; y: number; fired: boolean } | null>(null);
  const mx = useMotionValue(0);
  const THRESHOLD = 56;
  const onDrag = () => {
    dragged.current = true;
    const v = mx.get();
    const next = v >= THRESHOLD ? 'right' : v <= -THRESHOLD ? 'left' : null;
    if (next && next !== armed.current) haptic('tick');
    armed.current = next;
  };
  const onDragEnd = () => {
    const v = mx.get();
    armed.current = null;
    setTimeout(() => (dragged.current = false), 300);
    if (v >= THRESHOLD) {
      haptic('success');
      setGone('right');
      setTimeout(onFlip, 120);
    } else if (v <= -THRESHOLD) {
      haptic('warn');
      setGone('left');
      setTimeout(onDelete, 120);
    }
  };
  const cancelHold = () => {
    if (hold.current) clearTimeout(hold.current.timer);
    if (!hold.current?.fired) hold.current = null;
  };
  const read = !!x.readAt;
  const site = x.siteName || hostOf(x.url);
  return (
    <motion.div className="rrow-wrap" layout initial={false} animate={gone ? { height: 0, opacity: 0 } : { height: 'auto', opacity: 1 }} transition={{ duration: 0.18 }}>
      <div className={`rrow-under ${read ? 'is-read' : ''}`} aria-hidden="true">
        <span className="rrow-under-left">{read ? <RotateCcw size={20} strokeWidth={2.5} /> : <Check size={20} strokeWidth={2.5} />}</span>
        <span className="rrow-under-right">
          <Trash2 size={20} strokeWidth={2.5} />
        </span>
      </div>
      <motion.div className={`rrow ${read ? 'is-read' : ''}`} style={{ x: mx }} drag={reduce ? false : 'x'} dragConstraints={{ left: 0, right: 0 }} dragElastic={0.7} onDrag={onDrag} onDragEnd={onDragEnd} animate={gone === 'right' ? { x: 120 } : gone === 'left' ? { x: -120 } : { x: 0 }}>
        <a
          className="rrow-link"
          href={x.url}
          target="_blank"
          rel="noopener noreferrer"
          draggable={false}
          aria-label={`${x.title}. ${site}. Opens in a new window`}
          onPointerDown={(e) => {
            cancelHold();
            hold.current = {
              x: e.clientX,
              y: e.clientY,
              fired: false,
              timer: setTimeout(() => {
                if (hold.current) hold.current.fired = true;
                haptic('tick');
                onEdit();
              }, 480),
            };
          }}
          onPointerMove={(e) => {
            const h = hold.current;
            if (h && !h.fired && Math.hypot(e.clientX - h.x, e.clientY - h.y) > 8) cancelHold();
          }}
          onPointerUp={cancelHold}
          onPointerCancel={cancelHold}
          onContextMenu={(e) => e.preventDefault()}
          onClick={(e) => {
            if (dragged.current || hold.current?.fired) {
              hold.current = null;
              e.preventDefault();
              return;
            }
            open(x.url, read ? undefined : onOpened)(e);
          }}
        >
          <span className="rrow-title">{x.title}</span>
          <span className="caps rrow-meta">
            {site} · {ago(x.addedAt.slice(0, 10), today)}
          </span>
          {x.note ? <span className="rrow-note">{x.note}</span> : null}
        </a>
      </motion.div>
    </motion.div>
  );
};

type Tab = 'unread' | 'read';
export default function ReadsView() {
  const params = useParams();
  const nav = useNavigate();
  const tab: Tab = params.tab === 'read' ? 'read' : 'unread';
  const today = useToday();
  const reads = useReads();
  const { patch, remove, restore } = useReadsMutations();
  const sheet = useSheet();
  const toast = useToast();
  const all = reads.data ?? [];
  const unread = useMemo(() => all.filter((x) => !x.readAt), [all]);
  const read = useMemo(() => all.filter((x) => x.readAt), [all]);
  const list = tab === 'read' ? read : unread;
  const del = (x: Link) => {
    remove.mutate(x);
    toast('Deleted', { label: 'Undo', fn: () => restore.mutate(x) });
  };
  return (
    <div className="page">
      <PageHeader title="Reads" sub="Links to come back to, and one pick a day." />
      <TodaysPick />
      <QuickAdd />
      <div className="section">
        <Segmented className="r-tabs" label="Reads tabs" options={[['unread', `Unread${unread.length ? ` (${unread.length})` : ''}`], ['read', `Read${read.length ? ` (${read.length})` : ''}`]]} value={tab} onChange={(k) => nav(k === 'unread' ? '/reads' : '/reads/read')} />
      </div>
      <div className="rlist">
        {reads.isPending && !reads.data ? (
          <Group>
            <div className="rwait list" aria-busy="true" />
          </Group>
        ) : !list.length ? (
          <Group>
            <EmptyState>{tab === 'read' ? 'Nothing read yet. Swipe a link right when you’ve finished it.' : all.length ? 'All read. Paste a link above to keep the next one.' : 'Nothing saved yet. Paste a link above to keep it here.'}</EmptyState>
          </Group>
        ) : (
          <Group>
            <AnimatePresence initial={false}>
              {list.map((x) => (
                <LinkRow
                  key={x.id}
                  x={x}
                  today={today}
                  onFlip={() => patch.mutate({ id: x.id, readAt: x.readAt ? null : new Date().toISOString() })}
                  onDelete={() => del(x)}
                  onOpened={() => patch.mutate({ id: x.id, readAt: new Date().toISOString() })}
                  onEdit={() => sheet.open({ title: <span className="caps rsheet-kicker">Link</span>, body: <LinkSheet x={x} onDelete={() => del(x)} /> })}
                />
              ))}
            </AnimatePresence>
          </Group>
        )}
      </div>
    </div>
  );
}
