import { TODO_COLORS, type TodoColor, type TodoGroup } from '@logbook/shared';
import { useState } from 'react';
import { useTodoGroupMutations, useTodoMutations, useTodos } from '@/api/queries';
import { haptics } from '@/lib/haptics';
import { Button } from '@/ui/primitives';
import { useSheet, useSheetDepth } from '@/ui/Sheet';
import { useToast } from '@/ui/Toast';
import { ColorSwatches } from './colors';

/**
 * A list's editor: its name and colour; Delete keeps its to-dos (they move to no list), with Undo. New lists come here
 * too (no `group`), and `onCreated` hands the new list back to whoever asked (the to-do editor files the to-do under it).
 */
export const ListSheet = ({ group, onCreated }: { group?: TodoGroup; onCreated?: (g: TodoGroup) => void }) => {
  const { add, patch, remove } = useTodoGroupMutations();
  const todo = useTodoMutations();
  const todos = useTodos();
  const sheet = useSheet();
  const depth = useSheetDepth();
  const toast = useToast();
  const [name, setName] = useState(group?.name ?? '');
  const [color, setColor] = useState<TodoColor>(group?.color ?? TODO_COLORS[4]!);
  const done = () => (depth > 1 ? sheet.pop() : sheet.close());
  const n = group ? (todos.data ?? []).filter((x) => x.groupId === group.id && !x.deletedOn && !x.doneOn).length : 0;
  const save = async () => {
    const v = name.trim();
    if (!v) return;
    if (group) {
      if (v !== group.name || color !== group.color) patch.mutate({ id: group.id, name: v, color });
      return done();
    }
    try {
      const g = await add.mutateAsync({ name: v, color });
      onCreated?.(g);
      done();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'The list wasn’t saved. Try again.');
    }
  };
  return (
    <>
      <input className="tsheet-name" value={name} maxLength={30} placeholder="Work, Home, Banking…" aria-label="List name" autoFocus={!group} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void save()} />
      <div className="tsheet-field">
        <span className="caps">Colour</span>
        <ColorSwatches value={color} onChange={(c) => c && setColor(c)} allowNone={false} />
      </div>
      {group ? <p className="tsheet-hint">{n ? `${n} open to-do${n === 1 ? '' : 's'} in this list.` : 'No open to-dos in this list.'} Deleting it keeps them.</p> : null}
      <div className="sheet-foot">
        {group ? (
          <Button
            variant="danger"
            onClick={() => {
              haptics.delete();
              const was = group;
              const members = (todos.data ?? []).filter((x) => x.groupId === was.id).map((x) => x.id);
              remove.mutate(was.id);
              done();
              toast(`Deleted ${was.name}`, {
                label: 'Undo',
                fn: async () => {
                  const g = await add.mutateAsync({ name: was.name, color: was.color });
                  for (const id of members) todo.patch.mutate({ id, groupId: g.id });
                },
              });
            }}
          >
            Delete
          </Button>
        ) : (
          <span />
        )}
        <div className="foot-right">
          <Button variant="ghost" onClick={done}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => void save()} disabled={!name.trim() || add.isPending}>
            {group ? 'Save' : 'Create list'}
          </Button>
        </div>
      </div>
    </>
  );
};
