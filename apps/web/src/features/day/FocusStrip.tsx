import { Eraser, PenLine } from 'lucide-react';
import { useState } from 'react';
import { useBootstrap, useMorningMutations } from '@/api/queries';
import { haptics } from '@/lib/haptics';
import { Button, ContextMenu, Pressable, useSheet, useToast } from '@/ui';

type Focus = { word: string; quote: string; by: string };
const EMPTY: Focus = { word: '', quote: '', by: '' };

/** The editor: a word, a sentence, who said it. Saved to the account; it stays until it is changed. */
const FocusEditor = ({ initial }: { initial: Focus }) => {
  const sheet = useSheet();
  const toast = useToast();
  const { settings } = useMorningMutations();
  const [word, setWord] = useState(initial.word);
  const [quote, setQuote] = useState(initial.quote);
  const [by, setBy] = useState(initial.by);
  const next = { word: word.trim(), quote: quote.trim(), by: by.trim() };
  const changed = next.word !== initial.word || next.quote !== initial.quote || next.by !== initial.by;
  const save = () => {
    settings.mutate({ focus: next });
    haptics.success();
    sheet.close();
    toast(next.word || next.quote ? 'Saved. It stays until you change it.' : 'Cleared.');
  };
  return (
    <form
      className="focus-edit stack"
      onSubmit={(e) => {
        e.preventDefault();
        if (changed) save();
      }}
    >
      <label className="focus-field">
        <span className="caps">Word</span>
        <input className="in focus-word-in" value={word} onChange={(e) => setWord(e.target.value)} maxLength={40} placeholder="Steady" autoCapitalize="words" enterKeyHint="next" autoFocus />
      </label>
      <label className="focus-field">
        <span className="caps">Sentence</span>
        <textarea className="in focus-quote-in" value={quote} onChange={(e) => setQuote(e.target.value)} maxLength={400} rows={3} placeholder="Easy days easy, hard days hard." />
      </label>
      <label className="focus-field">
        <span className="caps">By</span>
        <input className="in" value={by} onChange={(e) => setBy(e.target.value)} maxLength={80} placeholder="Optional" enterKeyHint="done" />
      </label>
      <p className="fine">It stays on Today, every day, until you change it.</p>
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
 * The word and sentence you chose, at the very top of Today. Small on purpose: one stamped word and one serif line.
 * Tap to change it; hold for Edit / Clear. With nothing set it is a quiet one-line invitation.
 */
export const FocusStrip = () => {
  const boot = useBootstrap();
  const sheet = useSheet();
  const toast = useToast();
  const { settings } = useMorningMutations();
  const focus: Focus = { ...EMPTY, ...(boot.data?.morningSettings?.focus ?? {}) };
  if (!boot.data) return null;
  const has = !!(focus.word || focus.quote);
  const edit = () => sheet.open({ eyebrow: 'On Today, every day', title: 'Word and sentence', sticky: true, body: <FocusEditor initial={focus} /> });
  const clear = () => {
    const before = focus;
    settings.mutate({ focus: EMPTY });
    haptics.delete();
    toast('Cleared', { label: 'Undo', fn: () => settings.mutate({ focus: before }) });
  };
  const items = [
    { label: has ? 'Change' : 'Set a word', icon: <PenLine size={18} />, onSelect: edit },
    ...(has ? [{ label: 'Clear', icon: <Eraser size={18} />, onSelect: clear, destructive: true }] : []),
  ];
  return (
    <ContextMenu items={items} label={has ? `Your word: ${focus.word || focus.quote}` : 'Your word'}>
      <Pressable className={`focus-strip ${has ? '' : 'is-empty'}`} onPress={edit} label={has ? `Your word: ${[focus.word, focus.quote, focus.by].filter(Boolean).join('. ')}. Change it` : 'Set a word for your days'}>
        {has ? (
          <>
            {focus.word ? <span className="stamp focus-word">{focus.word}</span> : null}
            {focus.quote ? (
              <span className="focus-line">
                <span className="display focus-quote">“{focus.quote}”</span>
                {focus.by ? <span className="focus-by"> {focus.by}</span> : null}
              </span>
            ) : null}
          </>
        ) : (
          <span className="focus-invite">
            <PenLine size={15} aria-hidden="true" /> A word for your days
          </span>
        )}
      </Pressable>
    </ContextMenu>
  );
};
