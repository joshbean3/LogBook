import type * as React from 'react';
import { useConsent, useSaveConsent } from '@/features/auth/consent';
import { CONSENT_TITLE, consentSub, PRIVACY_PROMISE, PrivacyFacts } from '@/features/auth/PrivacyFacts';
import { haptics } from '@/lib/haptics';
import { ShieldCheck } from 'lucide-react';
import { PushedBar, Row, useSheet, useToast } from '@/ui';
import { HealthConsentPanel } from './AppleHealth';
import { GoRow, SGroup, Switch } from './parts';

/** "Chose Nov 8" under the switch: when the choice was made, so the page says it is a decision, not a default. */
const choseOn = (at: string | null) => (at ? `You chose this on ${new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(at))}.` : 'The default. You haven’t changed it.');

/**
 * /settings/privacy: the promise, the one choice made on the privacy page before the account (the assistant may read the
 * training data), and the same list of what is sent to Claude and what never is. The switch saves at once and goes back,
 * with a toast, if the save fails.
 */
export const PrivacyPage = (): React.JSX.Element => {
  const consent = useConsent();
  const save = useSaveConsent();
  const toast = useToast();
  const sheet = useSheet();
  const c = consent.data;
  const on = c?.training ?? true;
  return (
    <div className="page s-set s-sub">
      <PushedBar title="Privacy" />
      <section className="card s-hero" aria-label="The promise">
        <span className="s-hero-ic" aria-hidden="true">
          <ShieldCheck size={20} strokeWidth={2} />
        </span>
        <p className="s-hero-line display">{PRIVACY_PROMISE}</p>
      </section>
      <SGroup title="The assistant">
        <Row
          className="s-wrap s-wrap-title"
          title={CONSENT_TITLE}
          sub={c ? `${consentSub(on)} ${choseOn(c.at)}` : consent.isError ? 'Couldn’t load your choice. Check your connection.' : '–'}
          right={
            <Switch
              on={on}
              label={CONSENT_TITLE}
              onChange={(next) => {
                if (!c) return;
                save.mutate(
                  { training: next },
                  {
                    onError: () => {
                      haptics.error();
                      toast('Couldn’t save that. Try again.');
                    },
                  },
                );
              }}
            />
          }
        />
        <GoRow
          title="Let the coach read your health"
          sub={c?.health === true ? 'On. A short health summary goes with your question.' : c?.health === false ? 'Off. The coach answers without your health data.' : 'Not asked yet. Nothing from Apple Health reaches the coach.'}
          value={c?.health === true ? 'On' : c?.health === false ? 'Off' : 'Not asked'}
          onPress={() => sheet.open({ title: 'Coach access', body: <HealthConsentPanel /> })}
        />
      </SGroup>
      <PrivacyFacts on={on} health={c?.health ?? null} />
    </div>
  );
};
