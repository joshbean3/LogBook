import { fmtDate, type JournalEntry } from '@logbook/shared';
import { Star } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { useJournalMutations } from '@/api/queries';
import { Button, Group, IconButton, SectionHead } from '@/ui/primitives';
import { useSheet } from '@/ui/Sheet';
import { useToast } from '@/ui/Toast';
import type { Log } from '../log/useLog';
import './journal.css';

/** True on a device with a pointer that can hover (a keyboard is near); false on a phone. Read once. */
export const canHover = typeof matchMedia === 'function' && matchMedia('(hover: hover)').matches;

const timeOf = (at: string) => {
  const d = new Date(at);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
};

/** The editor behind a tap on an entry: the text, Save / Cancel, and Delete with an undo. */
const EntrySheet = ({ e }: { e: JournalEntry }) => {
  const { patch, remove, restore } = useJournalMutations();
  const sheet = useSheet();
  const toast = useToast();
  const [text, setText] = useState(e.text);
  const save = () => {
    const v = text.trim();
    if (v && v !== e.text) patch.mutate({ entry: e, text: v });
    sheet.close();
  };
  return (
    <>
      <span className="t-cap muted">
        {timeOf(e.createdAt)}
        {e.editedAt ? ' · edited' : ''}
      </span>
      <textarea
        className="jtext serif jsheet-text"
        rows={6}
        maxLength={5000}
        value={text}
        aria-label="Entry"
        autoFocus
        onChange={(ev) => setText(ev.target.value)}
        onKeyDown={(ev) => {
          if (ev.key === 'Enter' && (ev.metaKey || ev.ctrlKey)) {
            ev.preventDefault();
            save();
          }
        }}
      />
      <div className="sheet-foot">
        <Button
          variant="danger"
          onClick={() => {
            remove.mutate(e);
            sheet.close();
            toast('Entry deleted', { label: 'Undo', fn: () => restore.mutate(e) });
          }}
        >
          Delete
        </Button>
        <div className="foot-right">
          <Button variant="ghost" onClick={() => sheet.close()}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save} disabled={!text.trim()}>
            Save
          </Button>
        </div>
      </div>
    </>
  );
};

/** One entry as a grouped-list row: time on the first line, the text in serif under it, the star at the right. Tap the text to edit. */
export const EntryItem = ({ e }: { e: JournalEntry }) => {
  const { patch } = useJournalMutations();
  const sheet = useSheet();
  return (
    <div className={`jentry ${e.fav ? 'is-fav' : ''}`}>
      <button type="button" className="jentry-body" onClick={() => sheet.open({ title: fmtDate('short', e.date), body: <EntrySheet e={e} /> })} aria-label={`Edit entry from ${timeOf(e.createdAt)}`}>
        <span className="t-cap muted jentry-meta">
          <span>{timeOf(e.createdAt)}</span>
          {e.editedAt ? <span>edited</span> : null}
        </span>
        <span className="jentry-text serif t-body">{e.text}</span>
      </button>
      <IconButton label={e.fav ? 'Remove from favorites' : 'Favorite'} size="sm" className={`star ${e.fav ? 'on' : ''}`} onClick={() => patch.mutate({ entry: e, fav: !e.fav })}>
        <Star size={15} fill={e.fav ? 'currentColor' : 'none'} />
      </IconButton>
    </div>
  );
};

const drafts: Record<string, string> = {};
/** A bare textarea and a footer line: meant to be the last row of a Group. The keyboard hint only shows where there is a keyboard. */
export const Composer = ({ date, hint, today, rows = 3 }: { date: string; hint?: string; today: string; rows?: number }) => {
  const { add } = useJournalMutations();
  const toast = useToast();
  const [text, setText] = useState(drafts[date] ?? '');
  const save = () => {
    const v = text.trim();
    if (!v) return;
    add.mutate({ date, text: v });
    drafts[date] = '';
    setText('');
    toast('Saved to your journal');
  };
  return (
    <div className="composer">
      <textarea
        className="jtext serif"
        rows={rows}
        maxLength={5000}
        placeholder={date === today ? 'What’s on your mind today?' : `Add an entry for ${fmtDate('short', date)}`}
        aria-label="Journal entry"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          drafts[date] = e.target.value;
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            save();
          }
        }}
      />
      <div className="composer-foot">
        <span className="t-cap muted">{hint && canHover ? hint : ''}</span>
        <Button variant="primary" onClick={save} disabled={!text.trim()}>
          Save
        </Button>
      </div>
    </div>
  );
};

/** The journal section Today embeds: the day's entries and a composer, one group. */
export const JournalDaySection = ({ date, log }: { date: string; log: Log }) => {
  const list = log.snap.journalOn(date);
  return (
    <>
      <SectionHead
        title="Journal"
        meta={list.length ? `${list.length} ${list.length === 1 ? 'entry' : 'entries'}` : undefined}
        action={
          <Link to="/journal" className="link">
            Journal
          </Link>
        }
      />
      <Group>
        {list.map((e) => (
          <EntryItem key={e.id} e={e} />
        ))}
        <Composer date={date} today={log.today} rows={2} />
      </Group>
    </>
  );
};
