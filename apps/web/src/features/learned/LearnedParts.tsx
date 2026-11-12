import type * as React from 'react';
import { fmtDate, LEARNING_MAX, shiftDays, type Learning } from '@logbook/shared';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTabScroller } from '@/app/NavController';
import { fitHeight } from '@/lib/fitHeight';
import { revealField, revealFloor } from '@/lib/keyboard';
import { Button } from '@/ui/primitives';
import { Pressable } from '@/ui/Pressable';
import { useSheet } from '@/ui/Sheet';
import { useToast } from '@/ui/Toast';
import { KPin, KTrash } from '../goals/Kit';
import { Marked } from '../journal/Marked';
import { useLearnedMutations } from './queries';

/* The pieces the tab and a month's page share: a growing field, the edit sheet, a line as words, days under month headings. */

/** Oldest first within a day: the order they were written. */
export const byTime = (a: Learning, b: Learning) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0);
export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * A field that grows with its words and never scrolls inside itself. `foot`: while the field has focus and grows, that
 * element (the field with its button) is kept above the keyboard, not just the field.
 */
export const useGrow = (ref: React.RefObject<HTMLTextAreaElement | null>, text: string, rows = 0, foot?: React.RefObject<HTMLElement | null>) => {
  const last = useRef(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    // measured without moving the page under the keys (lib/fitHeight.ts)
    fitHeight(el);
    const grew = el.scrollHeight > last.current;
    last.current = el.scrollHeight;
    if (grew && foot?.current && document.activeElement === el) revealField(foot.current);
  }, [ref, text, rows, foot]);
};

/**
 * In a sheet the Save foot is pinned over the body's last lines, and the browser only keeps the caret inside the body: as
 * the words grew, the line being typed went behind Save (and the count under the field with it). While the caret is at
 * the end of the words, every change puts the field's last line (and the count, once it shows) back above the foot and
 * the keyboard, at once: a smooth scroll would be cut short by the next key.
 */
const useFollowTyping = (ref: React.RefObject<HTMLTextAreaElement | null>, text: string) => {
  useLayoutEffect(() => {
    const el = ref.current;
    const body = el?.closest<HTMLElement>('.sheet-body');
    if (!el || !body || document.activeElement !== el || el.readOnly || el.selectionEnd < el.value.length - 1) return;
    const next = el.nextElementSibling;
    const last = next instanceof HTMLElement && next.classList.contains('ln-limit') ? next : el;
    const foot = [...body.querySelectorAll<HTMLElement>('.sheet-foot')].find((f) => !f.contains(el) && getComputedStyle(f).position === 'sticky');
    const kb = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--kb')) || 0;
    const over = last.getBoundingClientRect().bottom - revealFloor(body.getBoundingClientRect().bottom, window.innerHeight, kb, foot ? foot.getBoundingClientRect().top : null);
    if (over > 0) body.scrollTop += over;
  }, [ref, text]);
};

/** From 900 characters, how many of the 1,000 are used; and a line when a paste was cut to fit. */
const NEAR = 900;
export const Limit = ({ text, cut }: { text: string; cut: boolean }) =>
  text.length >= NEAR || cut ? (
    <p className={`ln-limit ${text.length >= LEARNING_MAX ? 'is-full' : ''}`} aria-live="polite">
      {cut ? <span>Pasted text was cut to {LEARNING_MAX.toLocaleString('en-US')} characters. </span> : null}
      <span className="tnum">
        {text.length} / {LEARNING_MAX}
      </span>
    </p>
  ) : null;

/** Whether a paste into `el` would run past the limit (the field then keeps only what fits). */
export const pasteCut = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
  const el = e.currentTarget;
  const pasted = e.clipboardData.getData('text').length;
  return el.value.length - (el.selectionEnd - el.selectionStart) + pasted > LEARNING_MAX;
};

/** What a sheet's close does with its words: save them, unless the learning was deleted. */
interface SheetGate {
  save?: () => void;
  gone?: boolean;
}

/**
 * Behind a tap on a line (or on Edit): its words to change, Save, and Delete (with Undo). It opens at the top and
 * unfocused, so a long entry reads from its first line; a tap on the words starts editing, the caret at the end. Closing
 * the sheet any way (Close, a flick, the scrim) keeps a change, as the rest of the app saves as you go. For one of
 * today's lines the foot also offers "Add another line": a day may hold more than one, and this is where the next starts.
 */
const LearningSheet = ({ item, today, gate, initial, reopen }: { item: Learning; today: string; gate: SheetGate; initial?: string; reopen: (words: string) => void }) => {
  const sheet = useSheet();
  const { edit } = useLearnedMutations(today);
  const toast = useToast();
  const ref = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState(initial ?? item.text);
  const [editing, setEditing] = useState(false);
  const [cut, setCut] = useState(false);
  useGrow(ref, text);
  useFollowTyping(ref, text);
  const v = text.trim();
  const latest = useRef(v);
  latest.current = v;
  const keep = () => {
    const words = latest.current;
    if (gate.gone || !words || words === item.text) return;
    // a change the server refuses keeps its words: Try again opens them again. A line that is gone (deleted on another
    // device, a 404) cannot be changed any more, so its words open as a new line for the same day
    edit.mutateAsync({ item, text: words }).catch((e: unknown) => {
      const status = (e as { status?: unknown } | null)?.status;
      const gone = status === 404 || status === 410;
      toast('Couldn’t save that.', { label: 'Try again', fn: () => (gone ? sheet.open(addSpec(item.date, today, words)) : reopen(words)) });
    });
  };
  gate.save = keep;
  const save = () => {
    keep();
    // the close's own save sees nothing new
    latest.current = item.text;
    sheet.close();
  };
  /** Start editing from a tap (or a key): the field takes the keyboard, the caret at the end. */
  const begin = () => {
    const el = ref.current;
    if (!el || editing) return;
    el.readOnly = false;
    setEditing(true);
    // blur then focus inside the tap, so iOS brings the keyboard up for a field the sheet had already focused
    el.blur();
    el.focus({ preventScroll: true });
    el.setSelectionRange(el.value.length, el.value.length);
    revealField(el);
  };
  return (
    <div className="ln-sheet k-sheet">
      <textarea
        ref={ref}
        className={`ln-field ln-sheet-field ${editing ? '' : 'is-reading'}`}
        rows={3}
        maxLength={LEARNING_MAX}
        value={text}
        readOnly={!editing}
        aria-label="The line"
        onClick={begin}
        onPaste={(e) => setCut(pasteCut(e))}
        onChange={(e) => {
          if (e.target.value.length < LEARNING_MAX) setCut(false);
          setText(e.target.value);
        }}
        onFocus={(e) => (editing ? revealField(e.currentTarget) : undefined)}
        onKeyDown={(e) => {
          if (!editing) {
            if (e.key !== 'Tab' && e.key !== 'Escape' && !e.metaKey) begin();
            return;
          }
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            save();
          }
        }}
      />
      <Limit text={text} cut={cut} />
      <KPin>
        <Button variant="primary" block onClick={save} disabled={!v || v === item.text}>
          Save
        </Button>
        {item.date === today ? (
          <Button
            variant="quiet"
            block
            onClick={() => {
              // a change in progress is kept first; then this sheet gives way to the empty field for today
              keep();
              latest.current = item.text;
              sheet.open(addSpec(today, today));
            }}
          >
            Add another line
          </Button>
        ) : null}
      </KPin>
    </div>
  );
};

/** A day's eyebrow and title for a sheet: `Today`, `Yesterday` or the weekday; `Nov 10`, with the year when it is not this one. */
export const sheetWords = (date: string, today: string) => ({
  eyebrow: date === today ? 'Today' : date === shiftDays(today, -1) ? 'Yesterday' : fmtDate('dowLong', date),
  title: date.slice(0, 4) === today.slice(0, 4) ? fmtDate('md', date) : `${fmtDate('md', date)}, ${date.slice(0, 4)}`,
});

export const useOpenLearning = (today: string) => {
  const sheet = useSheet();
  const { del } = useLearnedMutations(today);
  /** `initial`: words of a change that did not save, back in the field. */
  const open = (item: Learning, initial?: string) => {
    const gate: SheetGate = {};
    sheet.open({
      ...sheetWords(item.date, today),
      sticky: true,
      action: (
        <KTrash
          label="Delete"
          title="Delete this?"
          what={item.text}
          words="It leaves your journal. Undo brings it back."
          verb="Delete"
          onConfirm={() => {
            gate.gone = true;
            del(item);
          }}
        />
      ),
      body: <LearningSheet item={item} today={today} gate={gate} initial={initial} reopen={(words) => open(item, words)} />,
      onClose: () => gate.save?.(),
    });
  };
  return (item: Learning) => open(item);
};

/**
 * A day that was missed (on its month's page): the field to fill it in, and Save. A save the server rejects keeps the
 * words: the toast's Try again opens the sheet again with them in the field.
 */
const AddSheet = ({ date, today, initial = '', more }: { date: string; today: string; initial?: string; more?: (date: string) => void }) => {
  const sheet = useSheet();
  const { add } = useLearnedMutations(today);
  const toast = useToast();
  const ref = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState(initial);
  const [cut, setCut] = useState(false);
  useGrow(ref, text);
  useFollowTyping(ref, text);
  const v = text.trim();
  /** Save was pressed: a second press while the sheet closes saves nothing more. */
  const sent = useRef(false);
  const save = () => {
    if (!v || sent.current) return;
    sent.current = true;
    add.mutateAsync({ date, text: v }).catch(() => toast('Couldn’t save that.', { label: 'Try again', fn: () => sheet.open(addSpec(date, today, v, more)) }));
    sheet.close();
  };
  return (
    <div className="ln-sheet k-sheet">
      <textarea
        ref={ref}
        className="ln-field ln-sheet-field"
        rows={3}
        maxLength={LEARNING_MAX}
        value={text}
        autoFocus
        placeholder="One thing, in a sentence or two"
        aria-label={`The line for ${fmtDate('long', date)}`}
        onPaste={(e) => setCut(pasteCut(e))}
        onChange={(e) => {
          if (e.target.value.length < LEARNING_MAX) setCut(false);
          setText(e.target.value);
        }}
        onFocus={(e) => revealField(e.currentTarget)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            save();
          }
        }}
      />
      <Limit text={text} cut={cut} />
      <KPin>
        <Button variant="primary" block onClick={save} disabled={!v}>
          Save
        </Button>
        {more ? (
          <Button variant="quiet" block onClick={() => more(date)}>
            Write a longer entry
          </Button>
        ) : null}
      </KPin>
    </div>
  );
};

/** How far back an empty day can still be filled in from its month's page. */
export const FILL_DAYS = 7;
/** Open the field for a day with nothing in it. */
const addSpec = (date: string, today: string, initial?: string, more?: (date: string) => void) => ({ ...sheetWords(date, today), sticky: true, body: <AddSheet date={date} today={today} initial={initial} more={more} /> });
/** `more`: the sheet also offers "Write a longer entry" for that day (the Journal's month page passes its entry writer). */
export const useAddLearning = (today: string, more?: (date: string) => void) => {
  const sheet = useSheet();
  return (date: string) => sheet.open(addSpec(date, today, undefined, more));
};

/** A load that failed: says so, with Try again. Never an empty state, and never a dead end. */
export const LoadError = ({ title, onRetry, busy }: { title: string; onRetry: () => void; busy?: boolean }) => (
  <section className="k-card ln-error" role="alert">
    <p className="k-row-title">{title}</p>
    <p className="k-foot">Check the connection, then try again.</p>
    <Button size="sm" className="ln-error-btn" onClick={onRetry} disabled={busy}>
      Try again
    </Button>
  </section>
);

/** One line as words; a tap opens it. `clamp`: at most six lines (the sheet has the rest). `mark`: the words searched for. */
export const Line = ({ item, onOpen, className = '', clamp, mark }: { item: Learning; onOpen: (l: Learning) => void; className?: string; clamp?: boolean; mark?: string | null }) => (
  <Pressable as="button" className={`ln-line ${className}`} press="dim" onPress={() => onOpen(item)} label={`${item.text}. Edit`}>
    {clamp ? (
      <span className="ln-line-clamp">
        <Marked text={item.text} q={mark} />
      </span>
    ) : (
      <Marked text={item.text} q={mark} />
    )}
  </Pressable>
);

export interface Month {
  month: string;
  days: Array<{ date: string; items: Learning[] }>;
}
/** Newest month first, newest day first, each day's learnings in the order they were written. */
export const groupByMonth = (rows: Learning[]): Month[] => {
  const months: Month[] = [];
  for (const r of rows) {
    const m = r.date.slice(0, 7);
    let month = months[months.length - 1];
    if (!month || month.month !== m) months.push((month = { month: m, days: [] }));
    let day = month.days[month.days.length - 1];
    if (!day || day.date !== r.date) month.days.push((day = { date: r.date, items: [] }));
    day.items.push(r);
  }
  for (const m of months) for (const d of m.days) d.items.sort(byTime);
  return months;
};

/** A day's caption: Today, Yesterday, else the weekday and the date. */
export const dayWords = (date: string, today: string) =>
  date === today ? 'Today' : date === shiftDays(today, -1) ? `Yesterday, ${fmtDate('md', date)}` : `${fmtDate('dowLong', date)}, ${fmtDate('md', date)}`;

/** A month's days, newest first, each with its learnings as serif lines (a tap opens one). */
export const Days = ({ days, today, onOpen }: { days: Month['days']; today: string; onOpen: (l: Learning) => void }) => (
  <>
    {days.map((d) => (
      <div key={d.date} className="ln-day">
        <span className="caps ln-day-caps">{dayWords(d.date, today)}</span>
        {d.items.map((l) => (
          <Line key={l.id} item={l} onOpen={onOpen} />
        ))}
      </div>
    ))}
  </>
);

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
/** 'November' for '2026-11'. */
export const monthName = (m: string) => MONTHS[Number(m.slice(5, 7)) - 1] ?? m;

/** Load the next page when `end` comes within a screen of view. */
export const useLoadMore = (end: React.RefObject<HTMLElement | null>, q: { hasNextPage: boolean; isFetchingNextPage: boolean; isFetchNextPageError?: boolean; fetchNextPage: () => unknown }) => {
  const scroller = useTabScroller();
  const { hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage } = q;
  useEffect(() => {
    const el = end.current;
    // a page that failed is not asked for again by scrolling: the list offers Try again in its place
    if (!el || !hasNextPage || isFetchingNextPage || isFetchNextPageError) return;
    const io = new IntersectionObserver((es) => es.some((e) => e.isIntersecting) && void fetchNextPage(), { root: scroller.current, rootMargin: '0px 0px 600px 0px' });
    io.observe(el);
    return () => io.disconnect();
  });
};

