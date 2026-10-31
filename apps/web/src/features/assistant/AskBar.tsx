import type { ISODate } from '@logbook/shared';
import { Sparkles } from 'lucide-react';
import { memo } from 'react';
import { Pressable } from '@/ui/Pressable';
import { useSheet } from '@/ui/Sheet';
import { AssistantSheet } from './AssistantSheet';
import { useAssistantTurns } from './store';
import './assistant.css';

/**
 * Where the assistant was asked from (docs/system.md §7): the tab and the object on screen, so it knows what "this week" or
 * "this goal" means. The sheet passes it to the server with every turn.
 */
export interface AskContext {
  tab: 'today' | 'goals' | 'plan' | 'journal';
  /** The day the page shows (Today, Journal), or the week's Monday (Plan). */
  date?: ISODate;
  /** The goal level on screen (Goals). */
  level?: 'day' | 'week' | 'month' | 'year';
}

/** Open the assistant over the page (large sheet), asking about `date`, from `context`. */
export const useOpenAssistant = () => {
  const sheet = useSheet();
  return (date: ISODate, initial?: string, context?: AskContext) => sheet.open({ title: 'Ask Logbook', eyebrow: 'Assistant', detent: 'large', detents: ['large'], sticky: true, body: <AssistantSheet date={date} initial={initial} context={context} /> });
};

/** What the bar says when nothing is going, per tab. */
const PROMPT: Record<AskContext['tab'], string> = {
  today: 'Ask or change anything',
  goals: 'Set a goal, or ask how you are doing',
  plan: 'Pick a plan, change your week, or ask how it looks',
  journal: 'Ask about a day, or what happened this month',
};

/**
 * The assistant's door, at the top of every day's page: one 48 px bar that reads like a field. A tap opens the
 * conversation with the keyboard up; while one is going, the bar says so.
 */
export const AskBar = memo(function AskBar({ date, context }: { date: ISODate; context?: AskContext }) {
  const open = useOpenAssistant();
  const turns = useAssistantTurns();
  const live = turns.length > 0;
  const ctx: AskContext = context ?? { tab: 'today', date };
  return (
    <Pressable className="ask-bar" press="surface" onPress={() => open(date, undefined, ctx)} label="Ask Logbook. Ask about your plan or ask for a change">
      <Sparkles size={17} className="ask-bar-ic" aria-hidden="true" />
      <span className="ask-bar-text">{live ? 'Continue with the assistant' : PROMPT[ctx.tab]}</span>
      {live ? <span className="ask-bar-dot" aria-hidden="true" /> : null}
    </Pressable>
  );
});
