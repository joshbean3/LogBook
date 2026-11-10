import type { AssistantScreen, ISODate } from '@logbook/shared';
import { useSheet } from '@/ui/Sheet';
import { AssistantSheet } from './AssistantSheet';
import './assistant.css';

/**
 * Open the assistant over the page (large sheet), asking about `date`. `screen` is where it was opened from (Today and
 * its day, Plan and its week, a tab): on Today and Plan the conversation shows it as a chip that can be removed, and
 * sends it with each ask. `initial` fills the composer (Plan's "Move them").
 */
export const useOpenAssistant = () => {
  const sheet = useSheet();
  return (date: ISODate, initial?: string, screen?: AssistantScreen) =>
    sheet.open({ title: 'Assistant', detent: 'large', detents: ['large'], sticky: true, body: <AssistantSheet date={date} initial={initial} screen={screen} /> });
};
