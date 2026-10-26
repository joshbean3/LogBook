import { motion, useReducedMotion } from 'motion/react';
import { useState, useSyncExternalStore } from 'react';
import { api } from '@/api/client';
import { useBootstrap } from '@/api/queries';
import { ease, fadeIn, springs } from '@/lib/motion';
import { isNative } from '@/lib/native';
import { Pressable } from '@/ui/Pressable';
import './stravaPrimer.css';

/**
 * "See your runs land here": the Strava primer (experience §5.8 step 6, research §6 step 4). A sample run in Night style
 * draws itself, then one blue Connect Strava and a guilt-free Later.
 *
 * For the Today team:
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

/** Whether to show the primer, and the Later that hides it. */
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

// a morning loop by the river: a sample, drawn the way Today draws a real one
const ROUTE = 'M 24 120 C 40 92, 58 70, 92 64 S 150 40, 176 52 S 226 92, 248 76 S 284 34, 300 44 C 314 54, 306 88, 284 104 S 220 128, 190 136 S 120 150, 84 146 S 34 138, 24 120 Z';

export interface StravaPrimerProps {
  /** Tapped Later: hide the card (and, by default, remember it for 14 days). */
  onLater?: () => void;
  /** Called before the hand-off starts (to remember where to come back to). */
  onConnect?: () => void;
  /** Today's card (an inset card) or the full first-run screen. */
  variant?: 'card' | 'screen';
  className?: string;
}

export const StravaPrimer = ({ onLater, onConnect, variant = 'card', className = '' }: StravaPrimerProps) => {
  const reduce = useReducedMotion();
  const [leaving, setLeaving] = useState(false);
  const later = () => {
    laterStravaPrimer();
    onLater?.();
  };
  return (
    <section className={`sp sp-${variant} ${className}`} aria-label="Connect Strava">
      <motion.div className="sp-sample halo halo-done" aria-hidden="true" initial={reduce ? false : { opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={reduce ? fadeIn : springs.page}>
        <div className="sp-sample-top">
          <span className="caps">Sample · Morning run</span>
        </div>
        <svg className="sp-route" viewBox="0 0 324 170" fill="none">
          <motion.path d={ROUTE} stroke="#fff" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" initial={reduce ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.1, ease, delay: reduce ? 0 : 0.2 }} />
        </svg>
        <div className="sp-stamps">
          <span>
            <span className="caps">Distance</span>
            <span className="stamp">
              4.02<small>mi</small>
            </span>
          </span>
          <span>
            <span className="caps">Pace</span>
            <span className="stamp">
              8:51<small>/mi</small>
            </span>
          </span>
          <span>
            <span className="caps">Time</span>
            <span className="stamp">35:36</span>
          </span>
        </div>
      </motion.div>
      <h2 className="sp-title display">See your runs land here.</h2>
      <p className="sp-sub">Connect Strava and every run draws itself on Today, with its splits, the minute it syncs.</p>
      <div className="sp-actions">
        <Pressable
          className="btn primary block sp-connect"
          disabled={leaving}
          onPress={() => {
            setLeaving(true);
            onConnect?.();
            void connectStrava().finally(() => setLeaving(false));
          }}
        >
          {leaving ? 'Opening Strava…' : 'Connect Strava'}
        </Pressable>
        <Pressable className="btn quiet block sp-later" onPress={later}>
          Later. I can log runs by hand.
        </Pressable>
      </div>
    </section>
  );
};
