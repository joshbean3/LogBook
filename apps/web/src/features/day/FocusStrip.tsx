import { Eraser, PenLine } from 'lucide-react';
import { useBootstrap, useMorningMutations } from '@/api/queries';
import { haptics } from '@/lib/haptics';
import { ContextMenu, Pressable, useToast } from '@/ui';
import { EMPTY_FOCUS as EMPTY, useOpenWordSheet, type Focus } from './WordSheet';

/**
 * The word and sentence you chose, at the very top of Today. Small on purpose: one stamped word and one serif line.
 * Tap to change it; hold for Edit / Clear. With nothing set it is a quiet one-line invitation.
 */
export const FocusStrip = () => {
  const boot = useBootstrap();
  const toast = useToast();
  const edit = useOpenWordSheet();
  const { settings } = useMorningMutations();
  const focus: Focus = { ...EMPTY, ...(boot.data?.morningSettings?.focus ?? {}) };
  if (!boot.data) return null;
  const has = !!(focus.word || focus.quote);
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
