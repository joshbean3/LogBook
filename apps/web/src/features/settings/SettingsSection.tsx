import type * as React from 'react';
import { useEffect } from 'react';
import { useNav, useRouteParams } from '@/app/NavController';
import { HabitsPage } from './HabitsPage';
import { AccountPage, AppPage, ConnectionsPage, DataPage, NotificationsPage } from './SectionPages';
import { TrainingPage, YouPage } from './TrainingPages';
import './settings.css';

const PAGES: Record<string, () => React.JSX.Element> = {
  you: YouPage,
  training: TrainingPage,
  habits: HabitsPage,
  connections: ConnectionsPage,
  notifications: NotificationsPage,
  app: AppPage,
  data: DataPage,
  account: AccountPage,
};

/**
 * `/settings/:section` (contracts §F): the depth-2 page pushed over the mounted Settings, chosen by
 * `useRouteParams().section`, each under its own `PushedBar` ("Back to Settings"). `plans` is WP4's PlansPage, which the Shell
 * mounts before this; any other name is redirected to `/settings` by the route table, so the fallback below never shows.
 */
export default function SettingsSection(): React.JSX.Element | null {
  const { section } = useRouteParams();
  const Page = section ? PAGES[section] : undefined;
  // the page is drawn in the push's commit, whole on the slide's first frame (review 2 feel N1); a page with more than a
  // screen defers what is below its fold itself (`useBelowFold`)
  if (!Page) return <BackToSettings />;
  return <Page />;
}

const BackToSettings = (): null => {
  const nav = useNav();
  useEffect(() => nav.go('/settings'), [nav]);
  return null;
};
