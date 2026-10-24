import { ago, isAddressTitle, linkTitle, toISO, type Link, type PickResult } from '@logbook/shared';
import { ArrowUpRight, Check, Copy, Pencil, Plus, RotateCcw, Trash2, X } from 'lucide-react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useRouteParams } from '@/app/NavController';
import { keys, useReads, useReadsMutations } from '@/api/queries';
import { haptics } from '@/lib/haptics';
import { crossfade, ease } from '@/lib/motion';
import { useToday } from '@/lib/useToday';
import { Button, EmptyState, IconButton, Mark, PushedBar, Segmented, SkeletonRows, SwipeRow, usePress, useSheet, useToast } from '@/ui';
import { measureBelow, popFav, useListFlip } from '../journal/feel';
import { openLink, useOpenLink } from './openLink';
import { TodaysPick } from './TodaysPick';
import './reads.css';
import '../journal/seg.css';

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
            // the row landing in the list is the answer; only a link that was not added says why
            if (r.existed) toast('That link is already saved.');
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
const QuickAdd = ({ inputRef, onDone }: { inputRef: React.RefObject<HTMLInputElement | null>; onDone?: () => void }) => {
  const [url, setUrl] = useState('');
  const adder = useAddLink();
  const ready = !!linkIn(url.trim()) && !adder.pending;
  const submit = () => {
    const v = url;
    if (adder.save(v, setUrl)) {
      setUrl('');
      onDone?.();
    }
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
      <p className="rsheet-title">{linkTitle(x.title, x.url)}</p>
      {isAddressTitle(x.title, x.url) ? null : <span className="caps">{x.siteName || hostOf(x.url)}</span>}
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
  const press = usePress();
  const [ticked, setTicked] = useState(false);
  const read = !!x.readAt;
  const shown = ticked ? !read : read;
  const site = x.siteName || hostOf(x.url);
  // a page that never said its name goes by "nytimes.com · the-quiet-mile", and its meta line then leaves the site out
  const bare = isAddressTitle(x.title, x.url);
  const title = linkTitle(x.title, x.url);
  return (
    <SwipeRow
      label={title}
      right={{ label: read ? 'Unread' : 'Read', icon: read ? <RotateCcw size={20} /> : <Check size={20} />, tone: read ? 'neutral' : 'ok', onCommit: () => onFlip('swipe') }}
      left={{ label: 'Delete', icon: <Trash2 size={20} />, tone: 'bad', onCommit: onDelete }}
      menuItems={[
        { label: 'Open', icon: <ArrowUpRight size={18} />, onSelect: () => (void openLink(x.url), read ? undefined : onOpened()) },
        { label: 'Edit', icon: <Pencil size={18} />, onSelect: onEdit },
        { label: 'Copy link', icon: <Copy size={18} />, onSelect: () => void navigator.clipboard?.writeText(x.url).catch(() => toast('Couldn’t copy the link.')) },
      ]}
    >
      <div className={`rrow ${shown ? 'is-read' : ''}`}>
        <Mark
          status={shown ? 'done' : 'open'}
          label={title}
          title={read ? 'Mark unread' : 'Mark read'}
          haptic={false}
          onClick={() => {
            if (ticked) return;
            // `toggle` on the check's peak (§11.4), never on the tap
            popFav();
            setTicked(true);
            // the check draws, then the row moves to the other list
            setTimeout(() => onFlip('tap'), 420);
          }}
        />
        <a className="rrow-link" data-press="dim" {...press.handlers} href={x.url} target="_blank" rel="noopener noreferrer" draggable={false} aria-label={`${title}.${bare ? '' : ` ${site}.`} Opens in a new window`} onClick={open(x.url, read ? undefined : onOpened)}>
          <span className="rrow-title">{title}</span>
          <span className="caps rrow-meta">
            {bare ? null : `${site} · `}
            {ago(toISO(new Date(x.addedAt)), today)}
          </span>
          {x.note ? <span className="rrow-note">{x.note}</span> : null}
        </a>
        <IconButton label={`Edit ${title}`} className="rrow-edit" onClick={onEdit}>
          <Pencil size={16} />
        </IconButton>
      </div>
    </SwipeRow>
  );
};

type Tab = 'unread' | 'read';
const FADE_MS = ((crossfade as { duration?: number }).duration ?? 0.15) * 1000;
/**
 * Reads (docs/feel.md §8), the pushed page at `/journal/reads/:tab?` over the mounted Journal: the PushedBar, quick add on
 * top, today's pick, then the links on SwipeRow v2 (72 px reveal, 55 % / 600 px/s full). `Unread · Read` is page state
 * (read once from the route; a pushed page's path is not rewritten), and switching crossfades the list in 150 ms. A row
 * that leaves fades while the rows below FLIP up on `settle`; nothing animates height.
 */
export default function ReadsView() {
  const params = useRouteParams();
  const [tab, setTab] = useState<Tab>(params.tab === 'read' ? 'read' : 'unread');
  const today = useToday();
  const reads = useReads();
  const { patch, remove, restore } = useReadsMutations();
  const sheet = useSheet();
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const adder = useAddLink();
  const all = reads.data ?? [];
  const unread = useMemo(() => all.filter((x) => !x.readAt), [all]);
  const read = useMemo(() => all.filter((x) => x.readAt), [all]);

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
  // nothing saved yet: one sentence and Paste a link; the field shows when the clipboard has no link (or from the +)
  const empty = !reads.isPending && !all.length;
  const [adding, setAddingRaw] = useState(false);
  const top = useRef<HTMLDivElement>(null);
  const moved = useRef<(() => void) | null>(null);
  const setAdding = (v: boolean | ((c: boolean) => boolean)) => {
    moved.current = measureBelow(top.current);
    setAddingRaw(v);
  };
  const showAdd = !empty || adding;
  useLayoutEffect(() => {
    moved.current?.();
    moved.current = null;
    if (adding) requestAnimationFrame(() => input.current?.focus());
  }, [adding]);
  // the Unread / Read switch only once something has been read
  const tabs = read.length > 0;
  const shownTab: Tab = tabs ? tab : 'unread';
  const shownList = shownTab === 'read' ? read : unread;
  const listRef = useRef<HTMLDivElement>(null);
  useListFlip(listRef, `${shownTab}:${shownList.map((x) => x.id).join(',')}`);
  // the tab switch: a 150 ms crossfade of the list in place (opacity only)
  const stage = useRef<HTMLDivElement>(null);
  const lastTab = useRef(shownTab);
  useLayoutEffect(() => {
    if (lastTab.current === shownTab) return;
    lastTab.current = shownTab;
    stage.current?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: FADE_MS, easing: `cubic-bezier(${ease.join(', ')})` });
  }, [shownTab]);
  /** The empty state's verb: take a link off the clipboard if there is one, else open the field. */
  const paste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (adder.save(text)) return;
      toast('No link on the clipboard. Paste one here.');
    } catch {
      /* no clipboard permission: the field it is */
    }
    setAdding(true);
    input.current?.focus();
  };
  const rows = (
    <div ref={listRef} className="rlist">
      {shownList.map((x) => (
        <div key={x.id} data-key={x.id} className="rlist-item">
          <LinkRow
            x={x}
            today={today}
            onFlip={() => flip(x)}
            onDelete={() => del(x)}
            onOpened={() => patch.mutate({ id: x.id, readAt: new Date().toISOString() })}
            onEdit={() => sheet.open({ eyebrow: 'Link', title: 'Edit', body: <LinkSheet x={x} onDelete={() => del(x)} /> })}
          />
        </div>
      ))}
    </div>
  );
  return (
    <div className="page reads-page">
      <PushedBar
        title="Reads"
        trailing={
          empty ? (
            <IconButton label={adding ? 'Close' : 'Add a link'} onClick={() => setAdding((v) => !v)}>
              {adding ? <X size={20} /> : <Plus size={20} />}
            </IconButton>
          ) : undefined
        }
      />
      <div ref={top} className="jtl-anchor" aria-hidden="true" />
      {showAdd ? (
        <div className="fade-in">
          <QuickAdd inputRef={input} onDone={() => setAdding(false)} />
        </div>
      ) : null}
      <TodaysPick heroOnly={empty} />
      {reads.isPending && !reads.data ? (
        <div className="r-lists">
          <SkeletonRows rows={3} label="Loading your links" />
        </div>
      ) : empty ? (
        <div className="r-empty">
          <EmptyState verb={{ label: 'Paste a link', primary: true, onPress: () => void paste() }}>Save links and Logbook finds you one a day.</EmptyState>
        </div>
      ) : !tabs ? (
        <div className="r-lists">{unread.length ? rows : <EmptyState verb={{ label: 'Paste a link', onPress: () => void paste() }}>All read. The next link you keep lands here.</EmptyState>}</div>
      ) : (
        <div className="r-lists">
          <Segmented
            className="r-tabs"
            label="Unread or read"
            options={[
              ['unread', `Unread${unread.length ? ` · ${unread.length}` : ''}`],
              ['read', `Read${read.length ? ` · ${read.length}` : ''}`],
            ]}
            value={shownTab}
            onChange={(k: Tab) => setTab(k)}
          />
          <div ref={stage} className="r-stage">
            {shownList.length ? (
              rows
            ) : shownTab === 'read' ? (
              <EmptyState verb={{ label: 'Show unread', onPress: () => setTab('unread') }}>Links you finish move here.</EmptyState>
            ) : (
              <EmptyState verb={{ label: 'Paste a link', onPress: () => void paste() }}>All read. The next link you keep lands here.</EmptyState>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
