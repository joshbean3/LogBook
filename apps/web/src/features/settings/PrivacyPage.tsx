import { CONSENT_VERSION } from '@logbook/shared';
import { FileText, HeartPulse, Mail, ShieldCheck } from 'lucide-react';
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
      <section className="card s-hero" aria-label="The promise">
        <span className="s-hero-ic" aria-hidden="true">
          <ShieldCheck size={20} />
        </span>
        <p className="s-hero-line display">{PRIVACY_PROMISE}</p>
      </section>
      <SGroup
        title="The assistant"
        meta={consentWord(c)}
        foot={c ? consentFoot(c) : consent.isError ? 'Couldn’t load your choices. Check your connection.' : ' '}
      >
        {CONSENT_SWITCHES.map((s) => (
          <Row key={s.key} className="s-wrap s-wrap-title s-consent-row" title={s.title} sub={s.sub} right={<Switch on={switchOn(c, s.key)} label={s.title} disabled={!c} onChange={(next) => change(s.key, next)} />} />
        ))}
      </SGroup>
      {c ? <PrivacyFacts consent={c} /> : null}
      <SGroup title="Policies and requests" foot={`Anthropic runs the assistant and sees only what you allow. Fly.io hosts Orby. The Privacy Policy lists everyone who handles your data.`}>
        <GoRow icon={FileText} className="s-wrap-title" title="Privacy Policy" onPress={() => void openExternal(LEGAL.privacy)} />
        <GoRow icon={HeartPulse} className="s-wrap-title" title="Consumer health data privacy policy" onPress={() => void openExternal(LEGAL.healthPrivacy)} />
        <GoRow icon={Mail} className="s-wrap-title" title="Privacy requests" sub={`Ask for a copy of your data, a correction or deletion. We answer within ${REQUEST_DAYS} days.`} href={supportMail('Privacy request')} label="Privacy requests: email us" />
      </SGroup>
    </div>
  );
};
