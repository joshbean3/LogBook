import { CONSENT_VERSION } from '@logbook/shared';
import { FileText, HeartPulse, Mail } from 'lucide-react';
import type * as React from 'react';
import { PRIVACY_PROMISE, PrivacyFacts } from '@/features/auth/PrivacyFacts';
import { useConsent, useSaveConsent } from '@/lib/consent';
import { haptics } from '@/lib/haptics';
import { LEGAL, openExternal, SUPPORT_EMAIL } from '@/lib/siteLinks';
import { PushedBar, Row, useToast } from '@/ui';
import { GoRow, SGroup, Switch } from './parts';
import { CONSENT_SWITCHES, consentFoot, consentWord, firstAnswer, mailto, switchOn, type ConsentSwitch } from './privacyModel';

/** How long a privacy request takes to answer, in days (the consumer health data laws allow 45). */
export const REQUEST_DAYS = 45;

/** A letter to the support address, as a link the system hands to Mail. */
export const supportMail = (subject: string): string => mailto(SUPPORT_EMAIL, subject);

/**
 * /settings/privacy: the promise (the same sentence as before sign-up), then the three choices of the consent record
 * (training data, Remember when, the daily read), each with one line on what is sent. A switch saves at once and goes
 * back, with a toast, if the save fails. An account that was never asked reads "Not asked" with every switch off. Under
 * them: what is sent and what is not (the list sign-up shows), the two policies, and where to send a privacy request.
 */
export const PrivacyPage = (): React.JSX.Element => {
  const consent = useConsent();
  const save = useSaveConsent();
  const toast = useToast();
  const c = consent.data;
  const change = (key: ConsentSwitch, next: boolean) => {
    if (!c) return;
    // The first answer is the whole page as it was shown: every switch off but the one just turned on. An account that
    // was never asked may hold an old default, and that must not ride along as if it had been chosen.
    const answer = c.at === null ? { ...firstAnswer(), [key]: next } : { [key]: next };
    save.mutate(
      { ...answer, version: CONSENT_VERSION },
      {
        onError: () => {
          haptics.error();
          toast('Couldn’t save that. Try again.');
        },
      },
    );
  };
  return (
    <div className="page s-set s-sub">
      <PushedBar title="Privacy" />
      {/* the promise at the card's full width: three lines at 390 (layout standard 3.3.6) */}
      <section className="card s-hero" aria-label="The promise">
        <p className="s-hero-line display">{PRIVACY_PROMISE}</p>
      </section>
      <SGroup
        title="The assistant"
        // never asked: the footnote says so, so the title does not say it twice
        meta={c?.at === null ? undefined : consentWord(c)}
        foot={c ? consentFoot(c) : consent.isError ? 'Couldn’t load your choices. Check your connection.' : ' '}
      >
        {CONSENT_SWITCHES.map((s) => (
          <Row key={s.key} className="s-wrap-title s-consent-row" title={s.title} sub={s.sub} right={<Switch on={switchOn(c, s.key)} label={s.title} disabled={!c} onChange={(next) => change(s.key, next)} />} />
        ))}
      </SGroup>
      {/* the whole of what goes and what does not, word for word the list sign-up shows, as one inset group (S5) */}
      {c ? <PrivacyFacts consent={c} title="What is sent" /> : null}
      <SGroup title="Policies and requests" foot={`We answer a privacy request within ${REQUEST_DAYS} days. Anthropic runs the assistant and sees only what you allow. Fly.io hosts Orby. The Privacy Policy lists everyone who handles your data.`}>
        <GoRow icon={FileText} className="s-wrap-title" title="Privacy policy" onPress={() => void openExternal(LEGAL.privacy)} />
        <GoRow icon={HeartPulse} className="s-wrap-title" title="Consumer health data privacy policy" onPress={() => void openExternal(LEGAL.healthPrivacy)} />
        <GoRow icon={Mail} title="Privacy requests" sub="A copy, a correction or deletion" href={supportMail('Privacy request')} label={`Privacy requests: email us for a copy of your data, a correction or deletion. We answer within ${REQUEST_DAYS} days.`} />
      </SGroup>
    </div>
  );
};
