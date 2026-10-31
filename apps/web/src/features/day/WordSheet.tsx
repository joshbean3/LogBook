import type * as React from 'react';
import { useState, useSyncExternalStore } from 'react';
import { flushSync } from 'react-dom';
import { useBootstrap, useMorningMutations } from '@/api/queries';
import { WORD_MAX } from '@/lib/gesture';
import { Button } from '@/ui/primitives';
import { useSheet } from '@/ui/Sheet';

export type Focus = { word: string; quote: string; by: string };
export const EMPTY_FOCUS: Focus = { word: '', quote: '', by: '' };

/**
 * The word-and-sentence editor (docs/feel.md §2.3, §5; contracts §F): a word, a sentence, who said it, saved to the sticky
 * `settings.focus`. The body the old word strip opened, moved here. The word is at most `WORD_MAX` (12) characters, so the
 * caps line `WORD · THU, OCT 29` fits at 320. No toast and no haptic: the caps line changing is the confirmation.
 */
export const WordSheet = ({ initial }: { initial: Focus }): React.JSX.Element => {
  const sheet = useSheet();
  const { settings } = useMorningMutations();
  const [word, setWord] = useState(initial.word.slice(0, WORD_MAX));
  const [quote, setQuote] = useState(initial.quote);
  const [by, setBy] = useState(initial.by);
  const next = { word: word.trim(), quote: quote.trim(), by: by.trim() };
  const changed = next.word !== initial.word || next.quote !== initial.quote || next.by !== initial.by;
  const save = () => {
    saveFocus(settings, next);
    sheet.close();
  };
  return (
    <form
      className="focus-edit stack word-sheet"
      onSubmit={(e) => {
        e.preventDefault();
        if (changed) save();
      }}
    >
      <label className="focus-field">
        <span className="caps">Word</span>
        <input className="in focus-word-in" value={word} onChange={(e) => setWord(e.target.value)} maxLength={WORD_MAX} placeholder="Steady" autoCapitalize="words" enterKeyHint="next" autoFocus />
      </label>
      <label className="focus-field">
        <span className="caps">Sentence</span>
        <textarea className="in focus-quote-in" value={quote} onChange={(e) => setQuote(e.target.value)} maxLength={400} rows={3} placeholder="Easy days easy, hard days hard." />
      </label>
      <label className="focus-field">
        <span className="caps">By</span>
        <input className="in" value={by} onChange={(e) => setBy(e.target.value)} maxLength={80} placeholder="Optional" enterKeyHint="done" />
      </label>
      <div className="focus-actions">
        {initial.word || initial.quote ? (
          <Button
            variant="quiet"
            onClick={() => {
              setWord('');
              setQuote('');
              setBy('');
            }}
          >
            Clear
          </Button>
        ) : (
          <span />
        )}
        <Button variant="primary" type="submit" disabled={!changed}>
          Save
        </Button>
      </div>
    </form>
  );
};

/**
 * The word as just saved, ahead of the settings write: the caps line is the confirmation (M17, §14 41: within 150 ms), so it
 * paints first, alone (`flushSync` of the few readers of the word), and the write, whose optimistic update re-renders every
 * reader of the bootstrap, follows after that frame.
 */
let pending: Focus | null = null;
const subs = new Set<() => void>();
const setPending = (f: Focus | null) => {
  pending = f;
  for (const g of subs) g();
};
const subscribePending = (g: () => void) => {
  subs.add(g);
  return () => void subs.delete(g);
};
/** Save the word and sentence: the bar first, the write after the frame. */
export const saveFocus = (settings: ReturnType<typeof useMorningMutations>['settings'], next: Focus) => {
  flushSync(() => setPending(next));
  requestAnimationFrame(() =>
    setTimeout(() => {
      settings.mutate({ focus: next });
      setPending(null);
    }, 0),
  );
};

/** The account's current word and sentence (empty strings when unset); a save in flight reads as saved. */
export const useFocus = (): Focus => {
  const boot = useBootstrap();
  const p = useSyncExternalStore(subscribePending, () => pending, () => null);
  return p ?? { ...EMPTY_FOCUS, ...(boot.data?.morningSettings?.focus ?? {}) };
};

/** Opens the word sheet (medium) on the current word and sentence: the title menu's `Change the word`, the sentence line, the Close card. */
export const useOpenWordSheet = (): (() => void) => {
  const sheet = useSheet();
  const focus = useFocus();
  return () => sheet.open({ eyebrow: 'On Today, every day', title: 'Word and sentence', detent: 'medium', sticky: true, body: <WordSheet initial={focus} /> });
};
