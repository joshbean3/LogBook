import { fmtDate, type JournalEntry } from '@logbook/shared';
import { Star } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { useJournalMutations } from '@/api/queries';
import { Button, Group, IconButton, SectionHead } from '@/ui/primitives';
import { useToast } from '@/ui/Toast';
import type { Log } from '../log/useLog';
import './journal.css';

const timeOf = (at: string) => {
  const d = new Date(at);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
};

/** One entry as a grouped-list row: time and tools on the first line, the text in serif under it. */
export const EntryItem = ({ e, withDate }: { e: JournalEntry; withDate?: boolean }) => {
  const { patch, remove, restore } = useJournalMutations();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(e.text);
  return (
    <div className={`jentry ${e.fav ? 'is-fav' : ''}`}>
      <div className="jentry-head">
        <span className="t-cap muted jentry-meta">
          {withDate ? (
            <Link to={`/today/${e.date}`} className="link sm">
              {fmtDate('short', e.date)}
            </Link>
          ) : null}
          <span>{timeOf(e.createdAt)}</span>
          {e.editedAt ? <span>edited</span> : null}
        </span>
        {!editing ? (
          <span className="jentry-tools">
            <button type="button" className="link sm" onClick={() => setEditing(true)}>
              Edit
            </button>
            <button
              type="button"
              className="link sm quiet"
              onClick={() => {
                remove.mutate(e);
                toast('Entry deleted', { label: 'Undo', fn: () => restore.mutate(e) });
              }}
            >
              Delete
            </button>
            <IconButton label={e.fav ? 'Remove from favorites' : 'Favorite'} size="sm" className={`star ${e.fav ? 'on' : ''}`} onClick={() => patch.mutate({ entry: e, fav: !e.fav })}>
              <Star size={15} fill={e.fav ? 'currentColor' : 'none'} />
            </IconButton>
          </span>
        ) : null}
      </div>
      {editing ? (
        <div className="jedit">
          <textarea className="jtext serif" rows={4} maxLength={5000} value={text} aria-label="Edit entry" onChange={(ev) => setText(ev.target.value)} autoFocus />
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <Button size="sm" variant="ghost" onClick={() => (setText(e.text), setEditing(false))}>
              Cancel
            </Button>
            <Button
              size="sm"
              variant="primary"
              onClick={() => {
                const v = text.trim();
                if (v && v !== e.text) patch.mutate({ entry: e, text: v });
                setEditing(false);
              }}
            >
              Save
            </Button>
          </div>
        </div>
      ) : (
        <p className="jentry-text serif t-body">{e.text}</p>
      )}
    </div>
  );
};

const drafts: Record<string, string> = {};
/** A bare textarea and a footer line: meant to be the last row of a Group. */
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
        <span className="t-cap muted">{hint ?? ''}</span>
        <Button size="sm" variant="primary" onClick={save} disabled={!text.trim()}>
          Save entry
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
            Open journal
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
