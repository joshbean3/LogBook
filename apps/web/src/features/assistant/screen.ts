import { mondayOf, type AssistantScreen, type ISODate } from '@logbook/shared';
import { useCallback } from 'react';
import { useNavInternal } from '@/app/NavController';
import type { TabId } from '@/ui/nav';

const WEEK = /^\/plan\/week\/(\d{4}-\d{2}-\d{2})/;
const MONTH = /^\/plan\/month\/(\d{4}-\d{2})/;

/**
 * Where the assistant was opened from, as the conversation carries it (docs/inspiration.md §4): Today with the day it
 * shows, Plan with the week (or month) it shows, or the tab. Settings, pushed over a tab, carries none.
 */
export const screenOf = (tab: TabId, path: string, pushedPath: string | undefined, date: ISODate, today: ISODate): AssistantScreen | undefined => {
  if (pushedPath?.startsWith('/settings')) return undefined;
  if (tab === 'today') return { tab, date };
  if (tab === 'plan') {
    const week = WEEK.exec(path)?.[1];
    if (week) return { tab, week: mondayOf(week) };
    const month = MONTH.exec(path)?.[1];
    if (month) return { tab, month };
    return { tab, week: mondayOf(today) };
  }
  return { tab };
};

/** Reads the screen at the moment of the tap (no re-render on every navigation): `screenNow(date, today)`. */
export const useScreenContext = () => {
  const ctl = useNavInternal();
  return useCallback(
    (date: ISODate, today: ISODate) => {
      const st = ctl.getState();
      const tab = st.tabs[st.active];
      return screenOf(st.active, tab.path, tab.stack[tab.stack.length - 1]?.path, date, today);
    },
    [ctl],
  );
};
