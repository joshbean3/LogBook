import { TODO_COLORS, type Todo, type TodoColor, type TodoGroup } from '@logbook/shared';
import { Check } from 'lucide-react';

export const COLOR_WORD: Record<TodoColor, string> = { red: 'Red', orange: 'Orange', yellow: 'Yellow', green: 'Green', blue: 'Blue', purple: 'Purple', pink: 'Pink' };

/** The colour a row shows at its edge: its own highlight, else its list's, else none. */
export const colorOf = (x: Pick<Todo, 'color' | 'groupId'>, groups: readonly TodoGroup[] | undefined): TodoColor | null => x.color ?? groups?.find((g) => g.id === x.groupId)?.color ?? null;
export const groupOf = (x: Pick<Todo, 'groupId'>, groups: readonly TodoGroup[] | undefined) => (x.groupId ? (groups?.find((g) => g.id === x.groupId) ?? null) : null);

/** The style that paints a row's edge bar and its list chip (`--tc`). */
export const colorStyle = (c: TodoColor | null): React.CSSProperties | undefined => (c ? ({ '--tc': `var(--tag-${c})` } as React.CSSProperties) : undefined);

/** Seven swatches and "none", 44 px targets, the chosen one ringed with a check. */
export const ColorSwatches = ({ value, onChange, allowNone = true, label = 'Colour' }: { value: TodoColor | null; onChange: (c: TodoColor | null) => void; allowNone?: boolean; label?: string }) => (
  <div className="swatches" role="radiogroup" aria-label={label}>
    {allowNone ? (
      <button type="button" role="radio" aria-checked={value === null} aria-label="No colour" className={`swatch is-none ${value === null ? 'on' : ''}`} onClick={() => onChange(null)}>
        <span className="swatch-dot" />
      </button>
    ) : null}
    {TODO_COLORS.map((c) => (
      <button key={c} type="button" role="radio" aria-checked={value === c} aria-label={COLOR_WORD[c]} className={`swatch ${value === c ? 'on' : ''}`} style={colorStyle(c)} onClick={() => onChange(c)}>
        <span className="swatch-dot">{value === c ? <Check size={14} strokeWidth={3} aria-hidden="true" /> : null}</span>
      </button>
    ))}
  </div>
);

/** A list's name as a small chip in its colour. */
export const ListChip = ({ group }: { group: TodoGroup }) => (
  <span className="list-chip" style={colorStyle(group.color)}>
    {group.name}
  </span>
);
