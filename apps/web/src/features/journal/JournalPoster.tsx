import type * as React from 'react';
import { fmtDate, type Learning } from '@logbook/shared';
import { ChevronRight, PenLine } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useImperativeHandle, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { haptics } from '@/lib/haptics';
import { useReduced } from '@/lib/motion';
import { useMedia } from '@/lib/useToday';
import { Poster, WeekLights } from '@/ui/poster';
import { Pressable } from '@/ui/Pressable';
import { Button } from '@/ui/primitives';
import { Skeleton, SkeletonGroup } from '@/ui/Skeleton';
import { Ticker } from '@/ui/Ticker';
import { useToast } from '@/ui/Toast';
import { watchJournalAdd } from '../day/journalGuard';
import { keepAboveKeyboard, revealBox } from '../day/reveal';
import { LineField, QUESTION, useStarter, type LineFieldHandle } from '../learned/LineField';
import { daysWritten, ENTRY_MAX, weekBand, weekLabel, writtenWeek } from './days';
import { getDraft, hasDraft, holdSent, SAVE_FAILED, setDraft, subscribeDrafts } from './drafts';
import { Composer } from './JournalDaySection';
import { QuoteLine } from './JournalHome';
import { useDayPrompt } from './prompt';
import { useJournalWrites } from './queries';

/**
 * The entry writer, opened in place: the journal's own Composer (the day's draft, the 5,000 limit, Save and its guards),
 * in a field's box, with today's quote as a prompt line and a quiet Cancel. Cancel keeps the words: they are the day's
 * draft. The whole box, Save included, stays above the keyboard.
 */
export const EntryWriter = ({ date, today, haptic = true, autoFocus = true, onDone }: { date: string; today: string; haptic?: boolean; autoFocus?: boolean; onDone: () => void }): React.JSX.Element => {
  const prompt = useDayPrompt(date);
  const box = useRef<HTMLDivElement>(null);
  const reduce = useReduced();
  const isToday = date === today;
  // the whole writer, Save included, clear of the tab bar at once (its scroll-margin); the keyboard's rise is followed
  // by the focus handler below
  useEffect(() => {
    const id = requestAnimationFrame(() => box.current?.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' }));
    return () => cancelAnimationFrame(id);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div
      ref={box}
      className="jn-writer"
      onFocusCapture={(e) => {
        if (e.target instanceof HTMLTextAreaElement) revealBox(box.current);
      }}
      onInput={(e) => {
        if (e.target instanceof HTMLTextAreaElement) keepAboveKeyboard(box.current);
      }}
    >
      <Composer
        date={date}
        today={today}
        rows={3}
        placeholder={isToday ? prompt : `Write about ${fmtDate('short', date)}`}
        label={isToday ? 'Today’s entry' : `An entry for ${fmtDate('long', date)}`}
        haptic={haptic}
        autoFocus={autoFocus}
        prompt={isToday ? (insert) => <QuoteLine date={date} labelled onInsert={insert} /> : undefined}
        onSaved={onDone}
        onCancel={onDone}
      />
    </div>
  );
};

/** Is there an unsaved entry draft for `date`? Follows the drafts as they change. */
const useHasDraft = (date: string): boolean =>
  useSyncExternalStore(
    subscribeDrafts,
    () => hasDraft(date),
    () => false,
  );

export interface DayComposerHandle {
  /** Open on the line field with the caret in it; once the line is kept, on the entry writer. */
  focusLine: () => void;
  /** Open the entry writer. */
  writeMore: () => void;
}

/**
 * The one composer (under the Journal's poster, and in the evening's Close card): the line first, then more.
 *   - No line yet: the line field, started from the day, and "Finish the line" (the one Sky button). Under it one quiet
 *     link, "Write a longer entry", for a day that wants an entry before any line.
 *   - The line is kept: one quiet row, "Write more about today".
 *   - Either way in opens the entry writer in the same place; while it is open it is the only thing here, so there is one
 *     primary button on screen at any time.
 * A paste too long for a line is not cut: the field offers "Save as an entry" and the words are saved whole.
 */
export const DayComposer = ({ today, kept, written, onSavingLine, onSavedLine, ref }: { today: string; /** Today has its line. */ kept: boolean; /** Today already has a line or an entry (a save now is not the day's first). */ written: boolean; onSavingLine?: () => void; onSavedLine?: () => void; ref?: React.Ref<DayComposerHandle> }): React.JSX.Element => {
  const starter = useStarter(today);
  const w = useJournalWrites();
  const qc = useQueryClient();
  const toast = useToast();
  const [writing, setWriting] = useState(false);
  const line = useRef<LineFieldHandle>(null);
  const draft = useHasDraft(today);
  // asked to focus the line while the writer was open: done once the field is back
  const [wantLine, setWantLine] = useState(0);
  useEffect(() => {
    if (wantLine && !writing && !kept) line.current?.focus();
  }, [wantLine]); // eslint-disable-line react-hooks/exhaustive-deps
  useImperativeHandle(ref, () => ({
    focusLine: () => {
      if (kept) return setWriting(true);
      if (writing) {
        setWriting(false);
        setWantLine((n) => n + 1);
      } else line.current?.focus();
    },
    writeMore: () => setWriting(true),
  }));
  /** A paste too long for a line, saved whole as an entry; longer than an entry holds, it opens in the writer, cut to fit. */
  const saveLong = (words: string) => {
    if (words.length > ENTRY_MAX) {
      const cur = getDraft(today).trim();
      setDraft(today, (cur ? `${cur}\n\n${words}` : words).slice(0, ENTRY_MAX));
      setWriting(true);
      toast(`That is longer than an entry holds. It was cut to ${ENTRY_MAX.toLocaleString('en-US')} characters.`);
      return;
    }
    // as every entry is saved: the words stay on the device until the server or the outbox has them, and a refused save
    // puts them back in the day's draft (journalGuard) and opens the writer on them
    const release = holdSent(today, words);
    void w.add({ date: today, text: words }).then((ok) => (ok ? release() : setTimeout(release, 0)));
    watchJournalAdd(qc, today, { toast: () => toast(SAVE_FAILED), onRefused: () => setWriting(true) });
    haptics.orb();
    toast('Saved as an entry');
  };
  if (writing) return <EntryWriter date={today} today={today} haptic={!written} onDone={() => setWriting(false)} />;
  if (!kept)
    return (
      <LineField
        ref={line}
        today={today}
        starter={starter}
        onLong={saveLong}
        onSaving={onSavingLine}
        onSaved={onSavedLine}
        more={
          <Button variant="quiet" size="sm" className="jn-longer" onClick={() => setWriting(true)}>
            {draft ? 'Back to your entry' : 'Write a longer entry'}
          </Button>
        }
      />
    );
  return (
    <Pressable as="button" className="jn-more" press="surface" onPress={() => setWriting(true)} label={draft ? 'Write more about today. Your draft is waiting' : 'Write more about today'}>
      <span className="icon-tile" aria-hidden="true">
        <PenLine size={18} />
      </span>
      <span className="jn-more-words" aria-hidden="true">
        <span className="jn-more-title">Write more about today</span>
        {draft ? <span className="jn-more-sub">Your draft is waiting</span> : null}
      </span>
      <ChevronRight size={18} aria-hidden="true" className="jn-more-chev" />
    </Pressable>
  );
};

export interface JournalPosterProps {
  today: string;
  /** Today's lines, in the order they were written: the first is the day's headline. */
  lines: Learning[];
  /** How many lines each day holds, at least across the last seven days. */
  lineCounts: ReadonlyMap<string, number>;
  /** The days with an entry, at least across the last seven days. */
  entryDays: ReadonlySet<string>;
  /** Something was written before today (the first-line invitation is for someone who never has). */
  ever: boolean;
  /** A tap on the kept line: its sheet (edit, delete, another line). */
  onOpenLine: (l: Learning) => void;
  /** A tap on one of the six lights before tonight. */
  onOpenDay: (date: string) => void;
  composer?: React.Ref<DayComposerHandle>;
}

/**
 * The Journal's poster (guide 6.5a): the dusk card the page leads with, and the one composer under its band.
 * Before tonight's line: the question, "One line is enough.", the week's seven lights with tonight's ring waiting, and
 * the band's count of days written. After: the line itself is the title (a tap opens its sheet), tonight is lit, the
 * band counts up, and the composer's place invites more. A day's light is lit by a line or by an entry, today's too. The
 * same poster stays mounted across the save, so the light comes in once (WeekLights) with the field's one haptic; coming
 * back later the same day it is simply lit. Counts are days written and lines kept, never days in a row.
 */
export const JournalPoster = ({ today, lines, lineCounts, entryDays, ever, onOpenLine, onOpenDay, composer }: JournalPosterProps): React.JSX.Element => {
  const kept = lines.length > 0;
  const headline = lines[0];
  // today's light follows today's lines (the save lands in the list at once), the six before it the loaded days
  const week = useMemo(() => writtenWeek(today, new Map(lineCounts).set(today, lines.length), entryDays), [lineCounts, lines.length, entryDays, today]);
  // the save: tonight's light arrived while this poster was up
  const [prev, setPrev] = useState(week.tonight);
  const [fresh, setFresh] = useState(false);
  if (prev !== week.tonight) {
    setPrev(week.tonight);
    setFresh(!prev && week.tonight);
  }
  // the line arrived while the poster was up: its words rise into the title once
  const [had, setHad] = useState(kept);
  const [rose, setRose] = useState(false);
  if (had !== kept) {
    setHad(kept);
    setRose(!had && kept);
  }
  const band = weekBand(week, ever);
  // a light is a button only where seven of them are 44 pt wide each (375 pt and up): narrower, they are the picture alone,
  // and the day is still one tap away in the month's calendar
  const roomy = !useMedia('(max-width: 374.98px)');
  const days = useMemo(() => week.days.map((d) => ({ letter: d.letter, lit: d.lit, name: `${fmtDate('dowLong', d.date)}, ${fmtDate('md', d.date)}${d.lit ? ', written' : ''}. Open the day` })), [week.days]);
  return (
    <Poster
      ground="dusk"
      className="ln-poster jn-poster"
      label={kept ? 'Tonight’s line' : QUESTION}
      titleSize={kept ? 'goal' : 'lead'}
      title={
        headline ? (
          <Pressable className={`jn-title${rose ? ' is-new' : ''}`} press="dim" onPress={() => onOpenLine(headline)} label={`${headline.text.replace(/[.!?…]+$/, '')}. Edit tonight’s line`}>
            <span className="jn-title-in">{headline.text}</span>
          </Pressable>
        ) : (
          QUESTION
        )
      }
      meta={kept ? 'Tonight’s line is kept.' : 'One line is enough.'}
      scene={<WeekLights days={days} tonight={week.tonight ? 'lit' : 'waiting'} label={weekLabel(week)} onPick={roomy ? (i) => onOpenDay(week.days[i]!.date) : undefined} />}
      band={{
        label: band.label,
        words: week.tonight ? (
          <>
            <Ticker value={week.written} from={fresh ? week.written - 1 : undefined} /> {daysWritten(week.written).replace(/^\d+ /, '')}
          </>
        ) : (
          band.words
        ),
        second: band.second,
      }}
    >
      <DayComposer ref={composer} today={today} kept={kept} written={week.tonight} />
    </Poster>
  );
};

/** The poster's place while today's lines load: its height, so nothing jumps when it lands. */
export const JournalPosterSkeleton = (): React.JSX.Element => (
  <SkeletonGroup label="Loading" className="card ln-poster-skel">
    <Skeleton w="70%" h={32} />
    <Skeleton w="45%" h={18} />
    <Skeleton w="100%" h={76} r="control" style={{ marginTop: 'auto' }} />
    <Skeleton w={148} h={48} r="pill" style={{ marginLeft: 'auto' }} />
  </SkeletonGroup>
);
