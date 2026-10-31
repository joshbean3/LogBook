import type { ISODate } from '@logbook/shared';
import { Sparkles } from 'lucide-react';
import { memo } from 'react';
import { Pressable } from '@/ui/Pressable';
import { useSheet } from '@/ui/Sheet';
import { AssistantSheet } from './AssistantSheet';
import { useAssistantTurns } from './store';
import './assistant.css';

/** Open the assistant over the page (large sheet), asking about `date`. */
export const useOpenAssistant = () => {
  const sheet = useSheet();
  return (date: ISODate, initial?: string) => sheet.open({ title: 'Ask Logbook', eyebrow: 'Assistant', detent: 'large', detents: ['large'], sticky: true, body: <AssistantSheet date={date} initial={initial} /> });
};

/**
 * The assistant's door, at the top of every day's page: one 48 px bar that reads like a field. A tap opens the
 * conversation with the keyboard up; while one is going, the bar says so.
 */
export const AskBar = memo(function AskBar({ date }: { date: ISODate }) {
  const open = useOpenAssistant();
  const turns = useAssistantTurns();
  const live = turns.length > 0;
  return (
    <Pressable className="ask-bar" press="surface" onPress={() => open(date)} label="Ask Logbook. Ask about your plan or ask for a change">
      <Sparkles size={17} className="ask-bar-ic" aria-hidden="true" />
      <span className="ask-bar-text">{live ? 'Continue with the assistant' : 'Ask or change anything'}</span>
      {live ? <span className="ask-bar-dot" aria-hidden="true" /> : null}
    </Pressable>
  );
});
