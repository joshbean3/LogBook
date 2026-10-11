import { fmtDate, type JournalEntry } from '@logbook/shared';
import { Star } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { useJournalMutations } from '@/api/queries';
import { Button, Card, CardHead, IconButton } from '@/ui/primitives';
import { useToast } from '@/ui/Toast';
import type { Log } from '../log/useLog';
import './journal.css';

const timeOf = (at: string) => {
  const d = new Date(at);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
};

export const EntryItem = ({ e, withDate }: { e: JournalEntry; withDate?: boolean }) => {
  const { patch, remove, restore } = useJournalMutations();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(e.text);
  return (
    <li className={`entry ${e.fav ? 'is-fav' : ''}`}>
      <div className="entry-head">
        <div className="entry-meta">
          {withDate ? (
            <Link to={`/today/${e.date}`} className="link sm">
              {fmtDate('short', e.date)}
            </Link>
          ) : null}
          <span>{timeOf(e.createdAt)}</span>
          {e.editedAt ? <span>edited</span> : null}
        </div>
        {!editing ? (
          <div className="entry-tools">
            <IconButton label={e.fav ? 'Remove from favorites' : 'Favorite'} size="sm" className={`star ${e.fav ? 'on' : ''}`} onClick={() => patch.mutate({ entry: e, fav: !e.fav })}>
              <Star size={15} fill={e.fav ? 'currentColor' : 'none'} />
            </IconButton>
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
          </div>
        ) : null}
      </div>
      {editing ? (
        <div className="stack" style={{ gap: 8 }}>
          <textarea className="in" rows={4} maxLength={5000} value={text} onChange={(ev) => setText(ev.target.value)} autoFocus />
          <div className="row">
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
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <p className="entry-text">{e.text}</p>
      )}
    </li>
  );
};

const drafts: Record<string, string> = {};
export const Composer = ({ date, hint, today }: { date: string; hint?: string; today: string }) => {
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
    <div className="stack" style={{ gap: 8 }}>
      <textarea
        className="in composer"
        rows={3}
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
      <div className="row spread">
        <span className="fine">{hint ?? ''}</span>
        <Button size="sm" variant="primary" onClick={save} disabled={!text.trim()}>
          Save entry
        </Button>
      </div>
    </div>
  );
};

export const JournalDaySection = ({ date, log }: { date: string; log: Log }) => {
  const list = log.snap.journalOn(date);
  return (
    <Card className="a-journal">
      <CardHead title="Journal" meta={list.length ? `${list.length} ${list.length === 1 ? 'entry' : 'entries'}` : undefined}>
        <Link to="/journal" className="link">
          Open journal
        </Link>
      </CardHead>
      {list.length ? (
        <ul className="entries">
          {list.map((e) => (
            <EntryItem key={e.id} e={e} />
          ))}
        </ul>
      ) : null}
      <Composer date={date} today={log.today} />
    </Card>
  );
};
