import type * as React from 'react';
import { useConsent, useSaveConsent } from '@/features/auth/consent';
import { CONSENT_TITLE, consentSub, PRIVACY_PROMISE, PrivacyFacts } from '@/features/auth/PrivacyFacts';
import { haptics } from '@/lib/haptics';
import { PushedBar, Row, useToast } from '@/ui';
import { SGroup, Switch } from './parts';

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
  const c = consent.data;
  const on = c?.training ?? true;
  return (
    <div className="page s-set s-sub">
      <PushedBar title="Privacy" />
      <p className="s-lede s-promise">{PRIVACY_PROMISE}</p>
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
        <Row className="s-wrap" title="Health data" sub="Asked separately when Apple Health arrives. Nothing is read until then." right={<span className="s-value">Not yet</span>} />
      </SGroup>
      <div className="s-privacy-facts">
        <PrivacyFacts on={on} />
      </div>
    </div>
  );
};
