import type * as React from 'react';
import { useEffect } from 'react';
import { useNav, useRouteParams } from '@/app/NavController';
import { HabitsPage } from './HabitsPage';
import { TrainingPage, YouPage } from './TrainingPages';
import './settings.css';

/**
 * `/settings/:section` (contracts §F): the depth-2 page pushed over Settings, chosen by `useRouteParams().section`. You,
 * Training and Habits are real pages (each under its own pushed bar). `plans` is WP4's PlansPage, mounted by the Shell
 * before this. Connections, App, Data and Account have no page of their own yet (their rows live on the Settings root), so
 * they return to `/settings` (a jump: the layer pops), as they did before this module existed; WP6 builds them.
 */
export default function SettingsSection(): React.JSX.Element | null {
  const { section } = useRouteParams();
  const page = section === 'you' ? <YouPage /> : section === 'training' ? <TrainingPage /> : section === 'habits' ? <HabitsPage /> : null;
  return page ?? <BackToSettings />;
}

const BackToSettings = (): null => {
  const nav = useNav();
  useEffect(() => nav.go('/settings'), [nav]);
  return null;
};
