import { Check, X } from 'lucide-react';
import type * as React from 'react';
import './privacy.css';

/** The promise, in one line: on the privacy page before the account, and at the top of Settings › Privacy. */
export const PRIVACY_PROMISE = 'Your data is yours. It is never sold or shared.';

/** The choice itself, worded the same in both places. */
export const CONSENT_TITLE = 'Let the assistant read my training data';
export const consentSub = (on: boolean) => (on ? 'On. When you ask, it reads your plan, sessions, goals and to-dos to answer.' : 'Off. The assistant answers without your training data.');

/**
 * What goes to Claude (made by Anthropic) and what never does, in plain words. Shared by the privacy page and Settings so the
 * two can never say different things.
 */
export const PrivacyFacts = ({ on, health = null }: { on: boolean; health?: boolean | null }): React.JSX.Element => (
  <div className="pv-facts">
    <section className="card pv-list" aria-labelledby="pv-sent">
      <h2 id="pv-sent" className="pv-h">
        Sent to Claude, by Anthropic
      </h2>
      <ul>
        <li className={on ? '' : 'pv-off'}>
          <Check size={16} strokeWidth={2.6} aria-hidden="true" />
          <span>{on ? 'Your plan, sessions, goals and to-dos, only when you ask the assistant.' : 'Your plan, sessions, goals and to-dos: not while this is off.'}</span>
        </li>
        <li>
          <Check size={16} strokeWidth={2.6} aria-hidden="true" />
          <span>Files, photos and links you hand it.</span>
        </li>
        <li>
          <Check size={16} strokeWidth={2.6} aria-hidden="true" />
          <span>One old journal entry or learning a day, to write Remember when.</span>
        </li>
        {health ? (
          <li>
            <Check size={16} strokeWidth={2.6} aria-hidden="true" />
            <span>A short health summary (scores, last night’s sleep, vitals against your normal), only when you ask the coach.</span>
          </li>
        ) : null}
      </ul>
    </section>
    <section className="card pv-list never" aria-labelledby="pv-never">
      <h2 id="pv-never" className="pv-h">
        Never sent
      </h2>
      <ul>
        <li>
          <X size={16} strokeWidth={2.6} aria-hidden="true" />
          <span>Strava data.</span>
        </li>
        <li>
          <X size={16} strokeWidth={2.6} aria-hidden="true" />
          <span>Your email and password.</span>
        </li>
        <li>
          <X size={16} strokeWidth={2.6} aria-hidden="true" />
          <span>{health ? 'Raw Apple Health samples, and workouts the Strava app writes to Apple Health.' : 'Health data. You’re asked first, in Settings › Privacy.'}</span>
        </li>
      </ul>
    </section>
  </div>
);
