import { shiftDays, type ISODate, type Todo, type TodoBucket, type TodoColor, type TodoPriority } from '@logbook/shared';
import { ArrowDown, ArrowUp, Plus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTodoGroups, useTodoMutations, useTodos } from '@/api/queries';
import { haptics } from '@/lib/haptics';
import { Button, ChipButton, IconButton, Segmented } from '@/ui/primitives';
import { useSheet, useSheetDepth } from '@/ui/Sheet';
import { useToast } from '@/ui/Toast';
import { groupsOn, stepWithin } from './groups';
import { ColorSwatches, colorStyle } from './colors';
import { ListSheet } from './ListSheet';
import { PRIORITY_SHORT, PriorityFlag } from './PriorityDots';

/**
 * The editor behind a tap on a to-do: the name, a note, how much it matters (P1 to P3, each a coloured flag), the list it
 * belongs to, a highlight colour, when it is for, and its place in the list. Save is the sheet's one blue.
 */
export const TodoSheet = ({ x, date }: { x: Todo; date: ISODate }) => {
  const { patch, reorder } = useTodoMutations();
  const todos = useTodos();
  const sheet = useSheet();
  const depth = useSheetDepth();
  /** Pushed from the full list, the editor goes back to it; opened on its own, it closes. */
  const done = () => (depth > 1 ? sheet.pop() : sheet.close());
  const toast = useToast();
  // the row as it is now: a Move or a settle can change it while the sheet is open
  const cur = todos.data?.find((t) => t.id === x.id) ?? x;
  const [text, setText] = useState(x.text);
  const [note, setNote] = useState(x.note ?? '');
  const [priority, setPriority] = useState<TodoPriority>(x.priority);
  const [bucket, setBucket] = useState<TodoBucket>(x.bucket);
  const [due, setDue] = useState<ISODate | null>(x.due);
  const [groupId, setGroupId] = useState<string | null>(x.groupId);
  const [color, setColor] = useState<TodoColor | null>(x.color);
  const groups = useTodoGroups();
  const dateIn = useRef<HTMLInputElement>(null);
  const tomorrow = shiftDays(date, 1);
  const nextText = text.trim();
  const nextNote = note.trim();
  const nextDue = bucket === 'later' ? due ?? tomorrow : null;
  const changed = !!nextText && (nextText !== cur.text || nextNote !== (cur.note ?? '') || priority !== cur.priority || bucket !== cur.bucket || nextDue !== cur.due || groupId !== cur.groupId || color !== cur.color);
  const save = () => {
    if (!changed) return;
    const p: Parameters<typeof patch.mutate>[0] = { id: x.id };
    if (nextText !== cur.text) p.text = nextText;
    if (nextNote !== (cur.note ?? '')) p.note = nextNote || null;
    if (priority !== cur.priority) p.priority = priority;
    if (groupId !== cur.groupId) p.groupId = groupId;
    if (color !== cur.color) p.color = color;
    if (bucket !== cur.bucket) p.bucket = bucket;
    if (nextDue !== cur.due) {
      p.due = nextDue;
      p.bucket = bucket;
    }
    patch.mutate(p);
    done();
  };
  const onKey = (ev: React.KeyboardEvent<HTMLElement>) => {
    if (ev.key === 'Enter' && (ev.metaKey || ev.ctrlKey || ev.currentTarget.tagName === 'INPUT')) {
      ev.preventDefault();
      save();
    }
  };
  // Later means a day: tomorrow unless said otherwise, and the date field takes the focus
  const pick = (b: TodoBucket) => {
    setBucket(b);
    if (b === 'later' && !due) setDue(tomorrow);
  };
  useEffect(() => {
    if (bucket === 'later' && bucket !== x.bucket) dateIn.current?.focus();
  }, [bucket, x.bucket]);

  // its place in its list, from live data, so a second Move sees the first
  const group = groupsOn(todos.data, date).find((g) => g.items.some((t) => t.id === x.id));
  const idx = group ? group.items.findIndex((t) => t.id === x.id) : -1;
  const movable = !!group && group.key !== 'done' && group.items.length > 1;
  const stepBy = (dir: -1 | 1) => {
    if (!group) return;
    const r = stepWithin(group.items, x.id, dir, group.tier);
    if (!r) return;
    reorder.mutate(r.order);
    if (r.fix) {
      patch.mutate({ id: x.id, ...r.fix });
      if (r.fix.priority !== undefined) setPriority(r.fix.priority);
      if (r.fix.due !== undefined) setDue(r.fix.due);
    }
  };
  return (
    <>
      <input className="tsheet-name" value={text} maxLength={200} aria-label="To-do" onChange={(ev) => setText(ev.target.value)} onKeyDown={onKey} />
      <label className="tsheet-field">
        <span className="caps">Note</span>
        <textarea className="jtext serif tsheet-note" rows={3} maxLength={500} placeholder="Add a note" value={note} onChange={(ev) => setNote(ev.target.value)} onKeyDown={onKey} />
      </label>
      <div className="tsheet-field">
        <span className="caps">Priority</span>
        <Segmented<'0' | '3' | '2' | '1'>
          label="Priority"
          value={String(priority) as '0' | '3' | '2' | '1'}
          onChange={(v) => setPriority(Number(v) as TodoPriority)}
          options={(['0', '3', '2', '1'] as const).map((k) => [
            k,
            k === '0' ? (
              'None'
            ) : (
              <span key={k} className="seg-prio">
                <PriorityFlag level={Number(k) as TodoPriority} decorative size={13} />
                {PRIORITY_SHORT[Number(k) as TodoPriority]}
              </span>
            ),
          ])}
        />
      </div>
      <div className="tsheet-field">
        <span className="caps">List</span>
        <div className="tsheet-when tsheet-lists" role="radiogroup" aria-label="List">
          <ChipButton on={groupId === null} onClick={() => setGroupId(null)} role="radio" aria-checked={groupId === null}>
            None
          </ChipButton>
          {(groups.data ?? []).map((g) => (
            <ChipButton key={g.id} on={groupId === g.id} onClick={() => setGroupId(g.id)} role="radio" aria-checked={groupId === g.id} className="list-pick" style={colorStyle(g.color)}>
              <span className="list-pick-dot" aria-hidden="true" />
              {g.name}
            </ChipButton>
          ))}
          <ChipButton quiet onClick={() => sheet.push({ title: 'New list', body: <ListSheet onCreated={(g) => setGroupId(g.id)} /> })}>
            <Plus size={14} strokeWidth={2.4} aria-hidden="true" /> New list
          </ChipButton>
        </div>
      </div>
      <div className="tsheet-field">
        <span className="caps">Highlight</span>
        <ColorSwatches value={color} onChange={setColor} label="Highlight" />
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
        {bucket === 'later' ? <input ref={dateIn} type="date" className="in tsheet-date" aria-label="Date" value={due ?? tomorrow} min={tomorrow} onChange={(ev) => setDue(ev.target.value || null)} /> : null}
      </div>
      {movable && group ? (
        <div className="tsheet-field">
          <span className="caps">Order</span>
          <div className="tsheet-move">
            <IconButton label="Move up" disabled={idx <= 0} onClick={() => stepBy(-1)}>
              <ArrowUp size={18} />
            </IconButton>
            <IconButton label="Move down" disabled={idx < 0 || idx >= group.items.length - 1} onClick={() => stepBy(1)}>
              <ArrowDown size={18} />
            </IconButton>
            <span className="t-sub muted" aria-live="polite">
              {idx + 1} of {group.items.length}
            </span>
          </div>
        </div>
      ) : null}
      <div className="sheet-foot">
        <Button
          variant="danger"
          onClick={() => {
            haptics.delete();
            patch.mutate({ id: x.id, deletedOn: date });
            done();
            toast('Deleted', { label: 'Undo', fn: () => patch.mutate({ id: x.id, deletedOn: null }) });
          }}
        >
          Delete
        </Button>
        <div className="foot-right">
          <Button variant="ghost" onClick={done}>
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
