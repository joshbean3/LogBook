import { mondayOf } from '@logbook/shared';
import { useEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router';
import { useNav } from './NavController';

/**
 * INTERIM (docs/feel.md §12, contracts §A.2): until the last package has replaced its react-router calls, an old page's
 * `navigate()` or `<Link>` changes the URL without NavController knowing. This forwards a react-router PUSH or REPLACE, in a
 * microtask, to `nav.go(path, { adopt })`, which re-stamps the entry react-router wrote instead of adding one. Keyed on
 * `location.key` (a repeated navigate to the same path still counts); the mount render is skipped (a login mounts Authed
 * with a PUSH); POP is ignored (NavController handles popstate). Deleted by WP1 after WP6 lands.
 */
export const RouterBridge = () => {
  const loc = useLocation();
  const type = useNavigationType();
  const nav = useNav();
  const seen = useRef(loc.key);
  useEffect(() => {
    if (loc.key === seen.current) return;
    seen.current = loc.key;
    if (type === 'POP') return;
    const path = legacyPath(loc.pathname) + loc.search;
    const adopt = type === 'PUSH' ? 'push' : 'replace';
    queueMicrotask(() => nav.go(path, { adopt }));
  }, [loc.key]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
};

/** The old Plan page writes months as `/plan/month/<any day>` and weeks as `/plan/week/<any day>`: the routes want the first and the Monday. */
const legacyPath = (p: string) => {
  const m = /^\/plan\/(week|month)\/(\d{4}-\d{2}-\d{2})$/.exec(p);
  if (!m) return p;
  return m[1] === 'month' ? `/plan/month/${m[2]!.slice(0, 8)}01` : `/plan/week/${mondayOf(m[2]!)}`;
};
