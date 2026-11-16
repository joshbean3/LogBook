import { fmtDate, shiftDays, type ISODate, type TodoGroup } from '@logbook/shared';
import { motion } from 'motion/react';
import { useRef, useState } from 'react';
import { haptics } from '@/lib/haptics';
import { springs, reducedFade, useReduced } from '@/lib/motion';
import { ChipButton } from '@/ui/primitives';
import { colorStyle } from './colors';
import { PRIORITY_SHORT, PriorityFlag } from './PriorityDots';
import { parseQuickAdd, rebasePlain, type MarkKind, type PlainRun, type QuickAdd } from './quickAdd';

/** One chip under the field: what the marks of one kind were read as, in plain words, and the runs a tap keeps as words. */
export interface MarkChip {
  kind: MarkKind;
  /** The chip's words: "Fri, Nov 20", "Tomorrow", "Someday", "P1", "Work". */
  words: string;
  /** What VoiceOver says, the chip's words first: "Fri, Nov 20, read from “friday”. Tap to keep it as words". */
  label: string;
  runs: PlainRun[];
}

const ORDER: MarkKind[] = ['when', 'priority', 'list'];

/** The day a line was read for, in words: "Today", "Tomorrow", "Someday", else "Fri, Nov 20". */
const whenWords = (parsed: QuickAdd, date: ISODate) =>
  parsed.bucket === 'someday' ? 'Someday' : !parsed.due ? 'Today' : parsed.due === shiftDays(date, 1) ? 'Tomorrow' : fmtDate('short', parsed.due);

/**
 * The chips for what the field read, one per kind of mark, in the order the eye wants (the day, how much it matters, the
 * list). Two marks of one kind ("fri later") are one chip that says what the to-do will get; a tap keeps both as words.
 */
export const chipsOf = (parsed: QuickAdd, date: ISODate, groups: readonly TodoGroup[] | undefined): MarkChip[] =>
  ORDER.flatMap((kind) => {
    const marks = parsed.marks.filter((m) => m.kind === kind);
    if (!marks.length) return [];
    const words = kind === 'when' ? whenWords(parsed, date) : kind === 'priority' ? PRIORITY_SHORT[parsed.priority] : (groups?.find((g) => g.id === parsed.groupId)?.name ?? '');
    if (!words) return [];
    const typed = [...marks]
      .reverse()
      .map((m) => `“${m.text}”`)
      .join(' and ');
    return [{ kind, words, label: `${words}, read from ${typed}. Tap to keep it as words`, runs: marks.map((m) => ({ start: m.start, end: m.end, text: m.text })) }];
  });

/**
 * The quick-add field's words and the runs of them kept plain. A run stays plain while its words stay as they were
 * (`rebasePlain`): typing after it, or before it, does not read it again; changing it does.
 */
export const useQuickAddDraft = (date: ISODate, groups: readonly TodoGroup[] | undefined) => {
  const [state, setState] = useState<{ draft: string; plain: PlainRun[] }>({ draft: '', plain: [] });
  // the words right now, for the moments no render sits between (a blur and the unmount it causes)
  const typed = useRef('');
  const setDraft = (next: string) => {
    typed.current = next;
    setState((s) => ({ draft: next, plain: next ? rebasePlain(s.draft, next, s.plain) : [] }));
  };
  const parsed = parseQuickAdd(state.draft, date, groups, state.plain);
  const chips = chipsOf(parsed, date, groups);
  /** A chip tapped: its marks are words again, and stay words. */
  const keepAsWords = (chip: MarkChip) => {
    haptics.tick();
    setState((s) => ({ ...s, plain: [...s.plain, ...chip.runs] }));
  };
  return { draft: state.draft, typed, setDraft, parsed, chips, keepAsWords };
};

/**
 * What the field read, as a row of small chips under it (guide 6.3, the filter chip): "Fri, Nov 20", "P1" with its flag,
 * "Work" with its list's dot. A tap turns that mark back into words (one `tick`); the words stay in the name. A press does
 * not take the focus from the field, so the keyboard stays up and leaving the field does not add the to-do.
 */
export const MarkChips = ({ id, chips, parsed, groups, onKeep }: { id: string; chips: MarkChip[]; parsed: QuickAdd; groups: readonly TodoGroup[] | undefined; onKeep: (chip: MarkChip) => void }) => {
  const reduce = useReduced();
  if (!chips.length) return null;
  const list = groups?.find((g) => g.id === parsed.groupId);
  return (
    <div id={id} className="qa-chips" role="group" aria-label="Read from what you typed">
      {chips.map((c) => (
        <motion.span key={c.kind} className="qa-chip-wrap" initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={reduce ? reducedFade : springs.settle}>
          <ChipButton className="qa-chip" aria-label={c.label} onPointerDown={(e) => e.preventDefault()} onMouseDown={(e) => e.preventDefault()} onClick={() => onKeep(c)}>
            {c.kind === 'priority' ? <PriorityFlag level={parsed.priority} decorative /> : null}
            {c.kind === 'list' && list ? <span className="qa-dot" style={colorStyle(list.color)} aria-hidden="true" /> : null}
            {c.words}
          </ChipButton>
        </motion.span>
      ))}
    </div>
  );
};
