import { mondayOf, today } from '@logbook/shared';
import { useLayoutEffect } from 'react';
import { useNavInternal } from './NavController';

/**
 * INTERIM (docs/feel.md §12, contracts §A.2): until the last package has replaced its react-router calls, an old page's
 * `navigate()` or `<Link>` writes history without NavController knowing. While this is mounted, every history write
 * react-router makes (a PUSH or a REPLACE; never a POP, which NavController handles as popstate) is forwarded, in a microtask
 * after the write, to `nav.go(path, { adopt })`, which re-stamps the entry react-router wrote instead of adding one. The
 * controller sees the write itself (it owns window.history's write methods), so a repeated navigate to the same path counts,
 * a write made while one of its own traversals is pending waits behind it, and a login's mount forwards nothing (the
 * bridge is not mounted yet when the login navigates). Deleted by WP1 after WP6 lands.
 */
export const RouterBridge = () => {
  const ctl = useNavInternal();
  useLayoutEffect(() => {
    ctl.setAdopter((path, how) => ctl.go(legacyPath(path.split('?')[0]!) + (path.includes('?') ? path.slice(path.indexOf('?')) : ''), { adopt: how }));
    return () => ctl.setAdopter(null);
  }, [ctl]);
  return null;
};

/**
 * Old pages' addresses that mean something the route table spells differently: the old Plan page writes months as
 * `/plan/month/<any day>` and weeks as `/plan/week/<any day>` (the routes want the first and the Monday), and the old Today
 * opens today's morning as a bare `/morning` (which the table sends to /today).
 */
const legacyPath = (p: string) => {
  if (p === '/morning') return `/today/${today()}/morning`;
  const m = /^\/plan\/(week|month)\/(\d{4}-\d{2}-\d{2})$/.exec(p);
  if (!m) return p;
  return m[1] === 'month' ? `/plan/month/${m[2]!.slice(0, 8)}01` : `/plan/week/${mondayOf(m[2]!)}`;
};
