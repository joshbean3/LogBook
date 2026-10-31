import { useState, useSyncExternalStore } from 'react';
import { api } from '@/api/client';
import { useBootstrap } from '@/api/queries';
import { isNative } from '@/lib/native';
import { Button, Group, Row } from '@/ui/primitives';

/**
 * Connect Strava, as one row (docs/system.md: the primer screen is gone). Today and the first run's last step show it:
 *   const primer = useStravaPrimer();
 *   {primer.show ? <StravaPrimer onLater={primer.later} /> : null}
 * `show` is true when this server can connect Strava, the account is not connected, and Later was not tapped in the last
 * 14 days. Later is remembered per device (localStorage `logbook.stravaPrimer.later`).
 */

const KEY = 'logbook.stravaPrimer.later';
const SNOOZE_DAYS = 14;
const subs = new Set<() => void>();
const readLater = (): string | null => {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
};
const snoozed = () => {
  const at = readLater();
  if (!at) return false;
  return (Date.now() - new Date(at).getTime()) / 864e5 < SNOOZE_DAYS;
};
export const laterStravaPrimer = () => {
  try {
    localStorage.setItem(KEY, new Date().toISOString());
  } catch {
    /* private mode: it shows again next time */
  }
  for (const f of subs) f();
};
const subscribe = (f: () => void) => {
  subs.add(f);
  return () => void subs.delete(f);
};

/** Whether to show the row, and the Later that hides it. */
export const useStravaPrimer = () => {
  const boot = useBootstrap();
  const isSnoozed = useSyncExternalStore(subscribe, snoozed, () => false);
  const s = boot.data;
  const show = !!s && s.features.strava && !s.strava.connected && !isSnoozed;
  return { show, later: laterStravaPrimer };
};

/** Start the hand-off: a link in the browser, the system browser in the app (the callback deep-links back). */
export const connectStrava = async () => {
  if (!isNative) {
    window.location.href = '/api/strava/connect';
    return;
  }
  try {
    const { url } = await api<{ url: string }>('/strava/connect-url');
    const { Browser } = await import('@capacitor/browser');
    await Browser.open({ url, presentationStyle: 'popover' });
  } catch {
    /* Settings shows the status; nothing to say here */
  }
};

export interface StravaPrimerProps {
  /** Tapped Later: hide the row (and remember it for 14 days). Left out: no Later. */
  onLater?: () => void;
  /** Called before the hand-off starts (to remember where to come back to). */
  onConnect?: () => void;
  /** Accepted from older callers; the row is the same everywhere. */
  variant?: 'card' | 'screen';
  className?: string;
}

/** One `Group` with the one row, "Connect Strava › Runs land here on their own", and a quiet Later under it. */
export const StravaPrimer = ({ onLater, onConnect, className = '' }: StravaPrimerProps) => {
  const [leaving, setLeaving] = useState(false);
  const later = () => {
    laterStravaPrimer();
    onLater?.();
  };
  return (
    <section className={`sp ${className}`} aria-label="Connect Strava">
      <Group>
        <Row
          title={leaving ? 'Opening Strava…' : 'Connect Strava'}
          sub="Runs land here on their own, with their splits"
          right={<span className="lrow-verb">Connect</span>}
          onClick={() => {
            if (leaving) return;
            setLeaving(true);
            onConnect?.();
            void connectStrava().finally(() => setLeaving(false));
          }}
        />
      </Group>
      {onLater ? (
        <Button variant="quiet" size="sm" className="sp-later" onClick={later}>
          Later. I can log runs by hand.
        </Button>
      ) : null}
    </section>
  );
};
