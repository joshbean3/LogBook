import { type ISODate } from '@logbook/shared';
import { PenLine, Share } from 'lucide-react';
import type * as React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { memo, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { revealField } from '@/lib/keyboard';
import { Pressable } from '@/ui/Pressable';
import { useSheet } from '@/ui/Sheet';
import { useToast } from '@/ui/Toast';
import { Composer } from '../journal/JournalDaySection';
import type { Log } from '../log/useLog';
import { shareDataFor } from '../sessions/SessionCard';
import { ShareSheet } from '../share/ShareSheet';
import { watchJournalAdd } from './journalGuard';
import { dayMiles, weekMiles } from './miles';

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
  const saved = () => {
    const keyboard = via.current !== 'pointer';
    if (keyboard) focusTo.current = 'add';
    watchJournalAdd(qc, date, {
      toast,
      onRefused: () => {
        if (!alive.current) return;
        setAutoFocus(keyboard);
        setWriting(true);
      },
    });
    setWriting(false);
  };
  const entries = log.snap.journalOn(date);
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
    <section className="the-day card" aria-label="The day">
      <span className="caps td-eyebrow">The day</span>
      {entries.length ? (
        <div className="td-entries">
          {entries.map((e) => (
            <div key={e.id} className="td-entry">
              <span className="caps td-time">{timeOf(e.createdAt)}</span>
              <p className="td-text">{e.text}</p>
            </div>
          ))}
        </div>
      ) : null}
      {writing ? (
        // §5.1: the field is scrolled above the keyboard on focus (code review 1 #5)
        <div
          className="td-composer"
          data-no-page=""
          onFocusCapture={(e) => e.target instanceof HTMLTextAreaElement && revealField(e.target)}
          onPointerDownCapture={() => (via.current = 'pointer')}
          onKeyDownCapture={() => (via.current = 'other')}
        >
          <Composer date={date} today={log.today} rows={2} placeholder="Add to the day" toast={false} autoFocus={autoFocus} onSaved={saved} />
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
          label="Add to it"
        >
          <PenLine size={16} aria-hidden="true" /> Add to it
        </Pressable>
      )}
      <Pressable className="td-share hero-share" onPress={share} label="Share the day">
        <Share size={14} strokeWidth={2.25} aria-hidden="true" /> Share the day
      </Pressable>
    </section>
  );
});
