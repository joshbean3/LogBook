import { Check, X } from 'lucide-react';
import type * as React from 'react';
import type { Consent } from '@logbook/shared';
import { STRAVA_BUILT } from '@/lib/features';
import { Footnote, PageSection } from '@/ui/layout';
import './privacy.css';

/** The promise, in one line: on the privacy page before the account, and at the top of Settings, Privacy. */
export const PRIVACY_PROMISE = 'Your data is yours. It is never sold. It goes to Claude only when you say so.';

/** The choice itself, worded the same in both places. */
export const CONSENT_TITLE = 'Let the assistant read my training data';
export const consentSub = (on: boolean) => (on ? 'On. When you ask, it reads your plan, sessions, training status, goals and to-dos to answer.' : 'Off. The assistant answers without your training data.');

/** One row of the lists: what it is, and (for a row that is switched off) why it is not going anywhere. */
export interface Fact {
  key: string;
  text: string;
}
export interface Facts {
  /** False until the person has answered: nothing at all goes to Claude, and the first list reads "If you allow". */
  asked: boolean;
  sent: Fact[];
  notSent: Fact[];
}

const TYPED = 'What you type to the assistant and the files you attach';
const TRAINING = 'Your plan, sessions, training status, goals and to-dos';
const RECALL = 'One past journal entry or learning at a time, with your first name, to write Remember when';
const READS = 'Your saved links, notes and tags, to pick a daily read';

/**
 * The two lists, built from the consent record: the same switches the server checks before every call to Claude
 * (training, recall, reads), and `at`, which is null until the person has answered at all. A row sits under "Sent" only
 * while its switch is on. With no answer yet the first list says what Allow would send, and nothing is sent.
 */
export const privacyFacts = (consent: Consent | null | undefined): Facts => {
  const asked = !!consent?.at;
  const training = asked ? consent!.training : true;
  const recall = asked && consent!.recall;
  const reads = asked && consent!.reads;
  const off = asked ? 'off' : 'off until you turn it on';
  const sent: Fact[] = [{ key: 'typed', text: `${TYPED}.` }];
  const notSent: Fact[] = [];
  if (training) sent.push({ key: 'training', text: `${TRAINING}, only when you ask the assistant, draft a plan or review a goal.` });
  else notSent.push({ key: 'training', text: `${TRAINING}: off.` });
  if (recall) sent.push({ key: 'recall', text: `${RECALL}.` });
  else notSent.push({ key: 'recall', text: `${RECALL}: ${off}.` });
  if (reads) sent.push({ key: 'reads', text: `${READS}.` });
  else notSent.push({ key: 'reads', text: `${READS}: ${off}.` });
  notSent.push({ key: 'account', text: 'Your email and password.' });
  notSent.push({ key: 'health', text: 'Health data: not sent.' });
  // only in a build that has the connection at all: a release build carries no word of it
  if (STRAVA_BUILT) notSent.push({ key: 'strava', text: 'Strava data.' });
  return { asked, sent, notSent };
};

/** The line under the list that names who receives the checked items (the list itself is the same either way). */
export const factsWho = (asked: boolean): string => (asked ? 'Checked items go to Claude, by Anthropic. Crossed items are not sent.' : 'If you allow, checked items go to Claude, by Anthropic. Crossed items are not sent.');

/**
 * What goes to Claude (made by Anthropic) and what does not, in plain words. Shared by the privacy page and Settings so
 * the two can never say different things. One inset group of check and cross rows (layout standard 5.2: one container,
 * not a card per list), with a Dusk line under it that names who receives the checked ones; `title` heads it as a
 * list-page group (Settings). Pass the account's consent record (`null` before there is one). `on` and `health` are the
 * older props: `on` alone reads as an answered record with only the training switch set.
 */
export const PrivacyFacts = ({ consent, on, title, className = '' }: { /** The Contract 1 record, or null when the person has not answered yet. */ consent?: Consent | null; on?: boolean; health?: boolean | null; /** A list-page group title over the list (Settings, Privacy). */ title?: string; className?: string }): React.JSX.Element => {
  const record: Consent | null = consent ?? (on === undefined ? null : { training: on, recall: false, reads: false, health: null, at: 'set', version: null });
  const f = privacyFacts(record);
  const list = (
    <>
      <ul className="group pv-list" aria-label={title ?? 'What is sent'}>
        {f.sent.map((r) => (
          <li key={r.key} className="is-sent">
            <Check className="pv-ic" size={16} strokeWidth={2.25} aria-hidden="true" />
            <span>
              <span className="sr-only">Sent: </span>
              {r.text}
            </span>
          </li>
        ))}
        {f.notSent.map((r) => (
          <li key={r.key} className="is-not">
            <X className="pv-ic" size={16} strokeWidth={2.25} aria-hidden="true" />
            <span>
              <span className="sr-only">Not sent: </span>
              {r.text}
            </span>
          </li>
        ))}
      </ul>
      <Footnote className="pv-who">{factsWho(f.asked)}</Footnote>
    </>
  );
  return title ? (
    <PageSection size="sm" title={title} className={`pv-facts ${className}`.trim()}>
      {list}
    </PageSection>
  ) : (
    <div className={`pv-facts ${className}`.trim()}>{list}</div>
  );
};
