import type * as React from 'react';
import { useEffect, useLayoutEffect, useRef } from 'react';
import { useNav, useRouteParams } from '@/app/NavController';
import { useBodyFade, useBodyReady } from '@/features/journal/feel';
import { PushedBar } from '@/ui';
import { HabitsPage } from './HabitsPage';
import { AccountPage, AppPage, ConnectionsPage, DataPage } from './SectionPages';
import { TrainingPage, YouPage } from './TrainingPages';
import './settings.css';

const TITLES: Record<string, string> = { you: 'You', training: 'Training', habits: 'Habits', connections: 'Connections', app: 'App', data: 'Data', account: 'Account' };
const PAGES: Record<string, () => React.JSX.Element> = {
  you: YouPage,
  training: TrainingPage,
  habits: HabitsPage,
  connections: ConnectionsPage,
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
  // the push draws the page's bar alone; the page follows as a deferred render that never holds the slide (review feel F4)
  const ready = useBodyReady();
  // the page's body fades in when it lands (its bar was there already): the page is the element before the sentinel
  const sentinel = useRef<HTMLSpanElement>(null);
  const page = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    page.current = (sentinel.current?.previousElementSibling as HTMLElement | null) ?? null;
  });
  useBodyFade(page, ready);
  if (!Page) return <BackToSettings />;
  if (!ready)
    return (
      <div className={`page s-set s-sub ${section === 'you' || section === 'training' ? 's-pad-rebuild' : ''}`}>
        <PushedBar title={TITLES[section!] ?? ''} />
      </div>
    );
  return (
    <>
      <Page />
      <span ref={sentinel} hidden />
    </>
  );
}

const BackToSettings = (): null => {
  const nav = useNav();
  useEffect(() => nav.go('/settings'), [nav]);
  return null;
};
