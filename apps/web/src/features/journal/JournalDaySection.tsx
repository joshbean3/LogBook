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
      <span className="caps">
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
        <span className="caps jentry-meta">
          <span>{timeOf(e.createdAt)}</span>
          {e.editedAt ? <span>edited</span> : null}
        </span>
        <span className="jentry-text">{e.text}</span>
      </button>
      <IconButton label={e.fav ? 'Remove from favorites' : 'Favorite'} className={`star ${e.fav ? 'on' : ''}`} onClick={() => patch.mutate({ entry: e, fav: !e.fav })}>
        <Star size={16} fill={e.fav ? 'currentColor' : 'none'} />
      </IconButton>
    </div>
  );
};

/** The one blue on a composer, and only once there is something to save. Before that the word waits at ink-4 with no fill. */
export const SaveButton = ({ ready, onClick, children = 'Save' }: { ready: boolean; onClick: () => void; children?: string }) =>
  ready ? (
    <Button variant="primary" onClick={onClick}>
      {children}
    </Button>
  ) : (
    <Button variant="quiet" className="idle" disabled>
      {children}
    </Button>
  );

const drafts: Record<string, string> = {};
/** A bare textarea and a footer line: meant to be the last row of a Group. The keyboard hint only shows where there is a keyboard. `size="lg"` is the Journal page's writing voice at 22/28. */
export const Composer = ({ date, hint, today, rows = 3, size }: { date: string; hint?: string; today: string; rows?: number; size?: 'lg' }) => {
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
    <div className={`composer ${size === 'lg' ? 'big' : ''}`}>
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
        <span className="caps">{hint && canHover ? hint : ''}</span>
        <SaveButton ready={!!text.trim()} onClick={save} />
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
