import { CONSENT_VERSION, type AssistantScreen, type ISODate } from '@logbook/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useLayoutEffect, useState } from 'react';
import { useBootstrap } from '@/api/queries';
import { askAssistant, stopAssistant } from './api';
import { consentKey, useConsent, useSaveConsent } from '@/lib/consent';
import { haptics } from '@/lib/haptics';
import { LEGAL, openExternal } from '@/lib/siteLinks';
import { Orb } from '@/ui/Orb';
import { Button } from '@/ui/primitives';
import { useSheet } from '@/ui/Sheet';
import { runAsk } from './conversation';
import { gateOf, type Gate } from './gate';
import { assistantStore, useAssistantConsentNeeded } from './store';

/** The gate for this account: the stored choice (the consent endpoint, or the copy the bootstrap carries), and the server's word. */
export const useAssistantGate = (): { gate: Gate; retry: () => void } => {
  const q = useConsent();
  const boot = useBootstrap().data?.consent;
  const serverAsked = useAssistantConsentNeeded();
  const qc = useQueryClient();
  // the server says no choice is stored: what the phone kept is out of date
  useEffect(() => {
    if (serverAsked) void qc.invalidateQueries({ queryKey: consentKey });
  }, [serverAsked, qc]);
  return { gate: gateOf(q.data ?? boot, serverAsked, q.isError), retry: () => void q.refetch() };
};

/**
 * The assistant's own permission step (Guideline 5.1.2(i)): shown in the sheet, before the composer, to any account with
 * no stored choice. That covers people who signed in instead of signing up. It says what goes to Claude and offers three
 * answers. Allow and Only what I type are stored on the server with the wording version, then the conversation opens.
 * Not now stores nothing and closes the sheet, so the step shows again next time. Nothing is sent before an answer.
 */
/**
 * `chat`: a pane's own chat (AssistantPane), whose held question goes once answered; the open chat when absent. `inPane`:
 * the step sits inside a host's sheet, whose header it leaves alone. `onNotNow`: what Not now does in a host that should
 * stay open (the plan builder goes back to its controls); without it Not now closes the sheet.
 */
export const AssistantPermission = ({ gate, retry, date, screen, chat, inPane, onNotNow }: { gate: Exclude<Gate, 'open'>; retry: () => void; date: ISODate; screen?: AssistantScreen; chat?: string; inPane?: boolean; onNotNow?: () => void }) => {
  const sheet = useSheet();
  const save = useSaveConsent();
  const [failed, setFailed] = useState(false);
  // the header is the sheet's own here: no chat title, no History or New. On the question itself "Before you ask" is the one
  // heading, so the bar's title is left to VoiceOver (layout standard 4.4: no stacked headers)
  useLayoutEffect(() => {
    if (!inPane) sheet.update({ title: gate === 'ask' ? <span className="sr-only">Assistant</span> : 'Assistant', action: undefined });
  }, [gate]); // eslint-disable-line react-hooks/exhaustive-deps

  const choose = async (training: boolean) => {
    if (save.isPending) return;
    haptics.select();
    setFailed(false);
    try {
      await save.mutateAsync({ training, version: CONSENT_VERSION });
    } catch {
      setFailed(true);
      return;
    }
    // a question the server held back until this answer goes now
    const held = assistantStore.consentNeeded();
    assistantStore.setConsentNeeded(false);
    const turns = chat ? assistantStore.turnsFor(chat) : assistantStore.get();
    if (held && turns[turns.length - 1]?.role === 'user') void runAsk(askAssistant, date, screen, Date.now, stopAssistant, chat);
  };

  if (gate === 'checking')
    return (
      <div className="as-ask is-checking" role="status" aria-label="Checking your privacy choice">
        <Orb size={44} state="think" className="as-orb" />
      </div>
    );
  if (gate === 'unknown')
    return (
      <div className="as-ask">
        <div className="as-ask-top">
          <Orb size={56} className="as-ask-mark" />
          <p className="as-ask-lead">Couldn’t check your privacy choice. Check your connection, then try again.</p>
        </div>
        <div className="as-ask-actions">
          <Button variant="primary" block onClick={retry}>
            Try again
          </Button>
        </div>
      </div>
    );
  return (
    <div className="as-ask">
      <div className="as-ask-top">
        <Orb size={56} className="as-ask-mark" />
        <h3 className="as-ask-title">Before you ask</h3>
        <p className="as-ask-lead">What you type and the files you attach go to Claude, by Anthropic, to answer you.</p>
        <ul className="card as-ask-list">
          <li>
            <b>Allow</b>
            <span>The assistant can also read your plan, sessions, training status, goals and to-dos, so its answers fit your training.</span>
          </li>
          <li>
            <b>Only what I type</b>
            <span>It answers in general terms and can’t see your training data.</span>
          </li>
          <li>
            <b>Not now</b>
            <span>Nothing is sent.</span>
          </li>
        </ul>
      </div>
      <div className="as-ask-actions">
        {failed ? (
          <p className="as-ask-error" role="alert">
            Couldn’t save your choice. Check your connection, then try again.
          </p>
        ) : null}
        <Button variant="primary" block disabled={save.isPending} onClick={() => void choose(true)}>
          Allow
        </Button>
        <Button block disabled={save.isPending} onClick={() => void choose(false)}>
          Only what I type
        </Button>
        <Button
          variant="quiet"
          block
          disabled={save.isPending}
          onClick={() => {
            haptics.select();
            if (onNotNow) onNotNow();
            else sheet.close();
          }}
        >
          Not now
        </Button>
        <p className="as-ask-foot">
          You can change this in Settings, Privacy.{' '}
          <button type="button" className="as-ask-link" onClick={() => void openExternal(LEGAL.privacy)}>
            Privacy policy
          </button>
        </p>
      </div>
    </div>
  );
};
