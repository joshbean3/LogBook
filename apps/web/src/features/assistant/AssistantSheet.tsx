import type { AssistantScreen, ISODate } from '@logbook/shared';
import { AssistantPane } from './AssistantPane';

export { chipOf, startersFor } from './AssistantPane';

/**
 * The dock's assistant sheet: the pane on the store's open chat, with the chat's title and its History and New buttons in
 * the sheet's header, exactly as it has always been (layout plan C-1). Everything else lives in AssistantPane.tsx, which
 * the plan summary also hosts with a chat of its own.
 */
export const AssistantSheet = ({ date, initial, screen }: { date: ISODate; initial?: string; screen?: AssistantScreen }) => <AssistantPane chat="current" date={date} initial={initial} screen={screen} />;
