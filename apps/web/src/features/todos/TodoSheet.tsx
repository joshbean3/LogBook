import type { ISODate, Todo, TodoBucket, TodoPriority } from '@logbook/shared';
import { useState } from 'react';
import { useTodoMutations } from '@/api/queries';
import { haptic } from '@/lib/haptics';
import { Button, ChipButton, Segmented } from '@/ui/primitives';
import { useSheet } from '@/ui/Sheet';
import { PriorityDots } from './PriorityDots';

/**
 * The editor behind a tap on a to-do: the name, a note, how much it matters, and when it is for.
 * Save is the sheet's one blue; priority and when are ink and white, never a colour.
 */
export const TodoSheet = ({ x, date }: { x: Todo; date: ISODate }) => {
  const { patch } = useTodoMutations();
  const sheet = useSheet();
  const [text, setText] = useState(x.text);
  const [note, setNote] = useState(x.note ?? '');
  const [priority, setPriority] = useState<TodoPriority>(x.priority);
  const [bucket, setBucket] = useState<TodoBucket>(x.bucket);
  const [due, setDue] = useState<ISODate | null>(x.due);
  const nextText = text.trim();
  const nextNote = note.trim();
  const nextDue = bucket === 'later' ? due : null;
  const changed = !!nextText && (nextText !== x.text || nextNote !== (x.note ?? '') || priority !== x.priority || bucket !== x.bucket || nextDue !== x.due);
  const save = () => {
    if (!changed) return;
    const p: Parameters<typeof patch.mutate>[0] = { id: x.id };
    if (nextText !== x.text) p.text = nextText;
    if (nextNote !== (x.note ?? '')) p.note = nextNote || null;
    if (priority !== x.priority) p.priority = priority;
    if (bucket !== x.bucket) p.bucket = bucket;
    if (nextDue !== x.due) {
      p.due = nextDue;
      p.bucket = bucket;
    }
    patch.mutate(p);
    sheet.close();
  };
  const onKey = (ev: React.KeyboardEvent<HTMLElement>) => {
    if (ev.key === 'Enter' && (ev.metaKey || ev.ctrlKey || ev.currentTarget.tagName === 'INPUT')) {
      ev.preventDefault();
      save();
    }
  };
  const pick = (b: TodoBucket) => {
    haptic();
    setBucket(b);
  };
  return (
    <>
      <input className="tsheet-name" value={text} maxLength={200} aria-label="To-do" onChange={(ev) => setText(ev.target.value)} onKeyDown={onKey} />
      <label className="tsheet-field">
        <span className="caps">Note</span>
        <textarea className="jtext serif tsheet-note" rows={3} maxLength={500} placeholder="Add a note" value={note} autoFocus={!x.note} onChange={(ev) => setNote(ev.target.value)} onKeyDown={onKey} />
      </label>
      <div className="tsheet-field">
        <span className="caps">Priority</span>
        <Segmented<'0' | '1' | '2'>
          label="Priority"
          value={String(priority) as '0' | '1' | '2'}
          onChange={(v) => {
            haptic();
            setPriority(Number(v) as TodoPriority);
          }}
          options={[
            ['0', 'None'],
            [
              '1',
              <span key="1" className="seg-prio">
                <PriorityDots level={1} />
                Medium
              </span>,
            ],
            [
              '2',
              <span key="2" className="seg-prio">
                <PriorityDots level={2} />
                High
              </span>,
            ],
          ]}
        />
      </div>
      <div className="tsheet-field">
        <span className="caps">When</span>
        <div className="tsheet-when" role="group" aria-label="When">
          <ChipButton on={bucket === 'today'} onClick={() => pick('today')}>
            Today
          </ChipButton>
          <ChipButton on={bucket === 'later'} onClick={() => pick('later')}>
            Later
          </ChipButton>
          <ChipButton on={bucket === 'someday'} onClick={() => pick('someday')}>
            Someday
          </ChipButton>
        </div>
        {bucket === 'later' ? <input type="date" className="in tsheet-date" aria-label="Date" value={due ?? ''} min={date} onChange={(ev) => setDue(ev.target.value || null)} /> : null}
      </div>
      <div className="sheet-foot">
        <Button
          variant="danger"
          onClick={() => {
            haptic('warn');
            patch.mutate({ id: x.id, deletedOn: date });
            sheet.close();
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
