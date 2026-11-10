import { type ISODate } from '@logbook/shared';
import { PenLine, Share } from 'lucide-react';
import type * as React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { memo, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { SectionHeader } from '@/ui/layout';
import { Pressable } from '@/ui/Pressable';
import { useSheet } from '@/ui/Sheet';
import { useToast } from '@/ui/Toast';
import { Composer } from '../journal/JournalDaySection';
import type { Log } from '../log/useLog';
import { shareDataFor } from '../sessions/SessionCard';
import { ShareSheet } from '../share/ShareSheet';
import { watchJournalAdd } from './journalGuard';
import { dayMiles, weekMiles } from './miles';
import { keepAboveKeyboard, revealBox } from './reveal';

const timeOf = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
};

/**
 * The day (docs/feel.md §3.1 row 9, §3.3): on past days only, the card under the week: `THE DAY`, what was written that day
 * (plain rows: the Today page has no swipe rows, M9; the Journal edits them), `Add to it` (the day's composer, inline) and
 * `Share the day`. It is the link between Today and the Journal. A Save the server refuses opens the composer again with the
 * words and the error toast, however late it comes (`watchJournalAdd`; code review 2 #2). A keyboard or VoiceOver Save leaves
 * the focus on `Add to it` (code review 2 #5).
 */
export const TheDayCard = memo(function TheDayCard({ date, log }: { date: ISODate; log: Log }): React.JSX.Element {
  const sheet = useSheet();
  const [writing, setWriting] = useState(false);
  const qc = useQueryClient();
  const toast = useToast();
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  // how the composer was last pressed: a touch Save moves no focus and a refused one does not raise the keyboard by itself
  const via = useRef<'pointer' | 'other'>('other');
  const focusTo = useRef<'add' | null>(null);
  const [autoFocus, setAutoFocus] = useState(true);
  const add = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    if (writing || focusTo.current !== 'add') return;
    focusTo.current = null;
    add.current?.focus({ preventScroll: true });
  }, [writing]);
  // the words as saved, on the card at once in the entry's place until the month carries the entry: the journal's write
  // re-renders every page, and at 4× the words were nowhere for 0.6 s (code review 3 #5); as the Close card's `justSaved`
  const [justSaved, setJustSaved] = useState<{ text: string; at: string } | null>(null);
  const saved = () => {
    const keyboard = via.current !== 'pointer';
    if (keyboard) focusTo.current = 'add';
    const { text } = watchJournalAdd(qc, date, {
      toast,
      onRefused: () => {
        if (!alive.current) return;
        setJustSaved(null);
        setAutoFocus(keyboard);
        setWriting(true);
      },
    });
    if (text) setJustSaved({ text, at: new Date().toISOString() });
    setWriting(false);
  };
  const logged = log.snap.journalOn(date);
  const entries = justSaved && !logged.some((e) => e.text.trim() === justSaved.text.trim()) ? [{ id: 'just-saved', text: justSaved.text, createdAt: justSaved.at }, ...logged] : logged;
  const runs = log.snap.runsOn(date);
  const share = () => {
    const lead = log.snap.sessionsOn(date).find((s) => s.kind !== 'rest') ?? null;
    const miles = dayMiles(log.snap, date).miles;
    const base = shareDataFor(date, lead, runs, log);
    const days = weekMiles(log.snap, date);
    const data = runs.length ? base : { ...base, miles, week: base.week ? { ...base.week, days, total: days.reduce((t, d) => t + d.miles, 0) } : base.week };
    const words = entries[0]?.text.replace(/\s+/g, ' ').trim() ?? '';
    const cut = words.length > 80 ? `${words.slice(0, 79).replace(/\s+\S*$/, '')}…` : words;
    sheet.open({ title: 'Share the day', body: <ShareSheet data={cut ? { ...data, verdict: cut } : data} initial={miles > 0 ? (data.polyline ? 'route' : 'stamp') : 'bubble'} /> });
  };
  return (
    <section className="the-day" aria-label="Journal">
      <SectionHeader
        title="Journal"
        meta={entries.length ? `${entries.length} ${entries.length === 1 ? 'entry' : 'entries'}` : null}
        action={
          <Pressable className="lb-act td-share" press="dim" onPress={share} label="Share the day">
            <Share size={15} strokeWidth={2.25} aria-hidden="true" /> Share
          </Pressable>
        }
      />
      <div className="td-card">
        {entries.map((e) => (
          <div key={e.id} className="td-entry">
            <span className="td-time tnum">{timeOf(e.createdAt)}</span>
            <p className="td-text">{e.text}</p>
          </div>
        ))}
        {writing ? (
          // §5.1: the composer is scrolled above the keyboard on focus (code review 1 #5)
          <div
            className="td-composer"
            data-no-page=""
            // the box (the field and Save), not the field alone: Save sat under the keyboard (day review 3 #3)
            onFocusCapture={(e) => e.target instanceof HTMLTextAreaElement && revealBox(e.currentTarget)}
            onInput={(e) => keepAboveKeyboard(e.currentTarget)}
            onPointerDownCapture={() => (via.current = 'pointer')}
            onKeyDownCapture={() => (via.current = 'other')}
          >
            <Composer date={date} today={log.today} rows={2} placeholder="Add to the day" autoFocus={autoFocus} onSaved={saved} />
          </div>
        ) : (
          <Pressable
            ref={add}
            className="td-add"
            press="surface"
            onPress={() => {
              via.current = 'other';
              setAutoFocus(true);
              setWriting(true);
            }}
            label={entries.length ? 'Add to it' : 'Write about the day'}
          >
            <span className="td-add-ic" aria-hidden="true">
              <PenLine size={16} />
            </span>
            {entries.length ? 'Add to it' : 'Nothing written. Write about the day'}
          </Pressable>
        )}
      </div>
    </section>
  );
});
