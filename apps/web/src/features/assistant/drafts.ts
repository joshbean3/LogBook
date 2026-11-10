/**
 * Unsent words in the composer, kept per chat on this phone (a `logbook.` key, so signing out clears them: Contract C2).
 * They survive closing the sheet and a reload, and go when the message is sent.
 */
const key = (chatId: string) => `logbook.assistant.draft.${chatId}`;

export const readDraft = (chatId: string): string => {
  try {
    return localStorage.getItem(key(chatId)) ?? '';
  } catch {
    return '';
  }
};
export const writeDraft = (chatId: string, text: string): void => {
  try {
    if (text.trim()) localStorage.setItem(key(chatId), text);
    else localStorage.removeItem(key(chatId));
  } catch {
    /* storage closed or full: the words stay while the sheet is open */
  }
};

/** A chat id with unsent words but no saved turns (a new chat typed in, then the app closed): it opens again. */
export const orphanDraft = (saved: (id: string) => boolean): string | null => {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k?.startsWith('logbook.assistant.draft.')) continue;
      const id = k.slice('logbook.assistant.draft.'.length);
      if (id && !saved(id)) return id;
    }
  } catch {
    /* storage closed */
  }
  return null;
};
