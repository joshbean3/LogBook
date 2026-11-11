import { applyPlanPatch, PLAN_ASSIST_WORDS_MAX, shareableSettings, type AnswersFromRuns, type BuilderAnswers, type ISODate } from '@logbook/shared';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowUp, CircleAlert } from 'lucide-react';
import { animate, AnimatePresence, usePresence } from 'motion/react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { createPortal, flushSync } from 'react-dom';
import { consentKey, useConsent } from '@/lib/consent';
import { AI_LABEL } from '@/lib/copy';
import { haptics } from '@/lib/haptics';
import { revealField } from '@/lib/keyboard';
import { fadeIn, fadeOut, reducedFade, springs, useReduced } from '@/lib/motion';
import { Orb } from '@/ui/Orb';
import { assistFailure, assistSaid, flashKeys, type AssistSaid, type FlashKey } from './assistModel';
import { requestShape } from './assistRequest';
import './assist.css';

/*
 * The plan builder's assistant (guide 6.16; layout standard 6.11). One Paper container at the top of the builder:
 *
 *   pill      the 28 px Orb and "Describe your plan" (the dock's ask bar, in place);
 *   composer  the same container opened: a field, Send, the provider line under it;
 *   veil      while it thinks: Cloud at low opacity and a soft blur over the builder, the Orb lifted from its pill to the
 *             middle in its thinking state, one status line and Stop. It shows only after 150 ms and then stays at least
 *             600 ms, so a fast answer never flashes it;
 *   line      what changed, written from the difference in the answers ("Set 4 run days, long run Sunday."), with Undo;
 *             or one plain line and Try again when the request did not go through.
 *
 * The words and the builder's settings go to `POST /plans/template/assist`; the patch that comes back is applied here to
 * the builder's own answers (`applyPlanPatch`). Nothing is sent before the account has answered the permission step, and
 * a setting the builder read from tracked runs is never sent (`shareableSettings`).
 */

/** The veil waits this long, so an answer that comes at once never flashes it. */
export const VEIL_AFTER_MS = 150;
/** Once up, the veil stays at least this long: long enough to read as a pause, not a flicker. */
export const VEIL_MIN_MS = 600;
/** After this long the status line says it is still working. */
const VEIL_LONG_MS = 8000;
/** Under Reduce Motion the still Orb's opacity goes to this and back, once every `ORB_PULSE_S` seconds (one orbit's time). */
const ORB_PULSE_TO = 0.6;
const ORB_PULSE_S = 1.2;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export interface AssistHost {
  /** The assistant is set up on the server (`features.claude`). Off: the builder shows no pill. */
  enabled: boolean;
  today: ISODate;
  /** The builder's answers and which of them were read from tracked runs, as they are at the time of the call. */
  answers: () => BuilderAnswers;
  fromRuns: () => AnswersFromRuns;
  /** The answers change: an update (`assisted` 1) or its Undo (-1). `flash` is the controls that moved, top to bottom. */
  onChange: (next: BuilderAnswers, flash: FlashKey[], fromRuns: AnswersFromRuns, assisted: 1 | -1) => void;
}

interface Snapshot {
  answers: BuilderAnswers;
  fromRuns: AnswersFromRuns;
  keys: FlashKey[];
}

/** The assistant's state for one open builder: what the bar and the veil draw, and what the builder's body asks of it. */
export const useBuilderAssist = (host: AssistHost) => {
  const qc = useQueryClient();
  const consentQ = useConsent();
  const consent = consentQ.data ?? null;
  const [mode, setMode] = useState<'pill' | 'compose'>('pill');
  const [draft, setDraftState] = useState('');
  const [focused, setFocused] = useState(false);
  const [busy, setBusy] = useState(false);
  const [veil, setVeil] = useState(false);
  /** The veil's Orb is out of its pill: from the veil showing until it is gone again. */
  const [orbAway, setOrbAway] = useState(false);
  const [said, setSaid] = useState<(AssistSaid & { undo: Snapshot | null }) | null>(null);
  const [failure, setFailure] = useState<{ line: string; retry: boolean } | null>(null);
  const [asking, setAsking] = useState(false);
  /** The server said no choice is stored, whatever this phone believed: ask again. */
  const [refused, setRefused] = useState(false);

  const field = useRef<HTMLTextAreaElement>(null);
  const orb = useRef<HTMLSpanElement>(null);
  const ctl = useRef<AbortController | null>(null);
  /** Set in the tap itself, before any render: a double tap sends once. */
  const sending = useRef(false);
  /** A send that waits on the permission step. */
  const held = useRef(false);
  const wantFocus = useRef(false);
  const alive = useRef(true);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const hostRef = useRef(host);
  hostRef.current = host;
  useEffect(() => {
    // set again on every mount (StrictMode runs the cleanup once on the dev build)
    alive.current = true;
    return () => {
      alive.current = false;
      // leaving the sheet stops the wait: an answer nobody is waiting for is never applied
      ctl.current?.abort();
    };
  }, []);

  const setDraft = useCallback((text: string) => setDraftState(text.slice(0, PLAN_ASSIST_WORDS_MAX)), []);
  /** Nothing is sent until the account has answered. Unknown (not on this phone yet) is not a no: the server decides. */
  const needsAsk = refused || (consent != null && consent.at == null);
  const needsAskRef = useRef(needsAsk);
  needsAskRef.current = needsAsk;

  const openComposer = useCallback((inTap: boolean) => {
    // the line about the last try gives way to the words being changed
    setFailure(null);
    if (inTap) {
      // focus inside the tap, so the keyboard comes up with it
      flushSync(() => setMode('compose'));
      field.current?.focus();
    } else {
      wantFocus.current = true;
      setMode('compose');
    }
  }, []);
  useLayoutEffect(() => {
    if (mode !== 'compose' || !wantFocus.current) return;
    wantFocus.current = false;
    field.current?.focus();
  }, [mode]);

  const send = useCallback(async () => {
    const words = draftRef.current.trim();
    if (!words || sending.current) return;
    if (needsAskRef.current) {
      held.current = true;
      setAsking(true);
      return;
    }
    sending.current = true;
    const ac = (ctl.current = new AbortController());
    field.current?.blur();
    setFailure(null);
    setSaid(null);
    setBusy(true);
    let shownAt: number | null = null;
    const show = setTimeout(() => {
      if (!alive.current || ac.signal.aborted) return;
      shownAt = performance.now();
      setOrbAway(true);
      setVeil(true);
    }, VEIL_AFTER_MS);
    const h = hostRef.current;
    const outcome = await requestShape({ kind: 'shape', words, settings: shareableSettings(h.answers(), h.today, h.fromRuns()) }, ac.signal).then(
      (result) => ({ ok: true as const, result }),
      (error: unknown) => ({ ok: false as const, error }),
    );
    clearTimeout(show);
    // once the veil is up it stays long enough to be read; a Stop ends it at once
    if (shownAt != null && !ac.signal.aborted) await sleep(Math.max(0, VEIL_MIN_MS - (performance.now() - shownAt)));
    if (!alive.current) return;
    sending.current = false;
    ctl.current = null;
    setBusy(false);
    setVeil(false);
    if (shownAt == null) setOrbAway(false);
    // stopped while the veil held an answer that had already come: the answer is dropped
    const failed = outcome.ok ? (ac.signal.aborted ? ({ kind: 'stopped' } as const) : null) : assistFailure(outcome.error);
    if (outcome.ok && !failed) {
      const now = hostRef.current;
      const before = now.answers();
      const beforeRuns = now.fromRuns();
      const applied = applyPlanPatch(before, outcome.result.patch, now.today);
      const keys = flashKeys(applied.changes);
      if (applied.changes.length) {
        // a setting the request gave in full is the person's own answer now. One it only moved (a count, a day added,
        // "four more miles") was worked out from what was there, so what was read from tracked runs still is
        now.onChange(applied.next, keys, { runDays: beforeRuns.runDays && !applied.own.runDays, weeklyMiles: beforeRuns.weeklyMiles && !applied.own.weeklyMiles }, 1);
        haptics.success();
      }
      setSaid({ ...assistSaid(applied, outcome.result), undo: applied.changes.length ? { answers: before, fromRuns: beforeRuns, keys } : null });
      setDraftState('');
      setMode('pill');
      return;
    }
    if (failed?.kind === 'stopped') {
      // the words stay in the composer, ready to change or send again
      setMode('compose');
      return;
    }
    if (failed?.kind === 'consent') {
      setRefused(true);
      void qc.invalidateQueries({ queryKey: consentKey });
      held.current = true;
      setAsking(true);
      return;
    }
    if (failed?.kind === 'line') {
      haptics.error();
      setFailure({ line: failed.line, retry: failed.retry });
      setMode('pill');
    }
  }, [qc]);
  const sendRef = useRef(send);
  sendRef.current = send;

  // the permission step was answered: the builder comes back, and what was waiting goes
  const at = consent?.at ?? null;
  const lastAt = useRef(at);
  useEffect(() => {
    if (at === lastAt.current) return;
    lastAt.current = at;
    if (!asking || at == null) return;
    setRefused(false);
    needsAskRef.current = false;
    setAsking(false);
    if (held.current) {
      held.current = false;
      void sendRef.current();
    } else openComposer(false);
  }, [at]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    enabled: host.enabled,
    mode,
    draft,
    setDraft,
    busy,
    veil,
    orbAway,
    said,
    failure,
    asking,
    /** The composer has the keyboard: the builder hides its foot so the composer is never covered. */
    composing: mode === 'compose' && focused,
    /** The composer holds words: the builder's own verb steps back, so one Sky button shows. */
    typing: mode === 'compose' && draft.trim() !== '',
    field,
    orb,
    /** Where the permission step stands, for `AssistantPermission`. */
    gate: (refused || consent ? 'ask' : consentQ.isError ? 'unknown' : 'checking') as 'ask' | 'unknown' | 'checking',
    retryConsent: () => void consentQ.refetch(),
    /** The pill was tapped. */
    open: () => {
      if (sending.current) return;
      if (needsAskRef.current) {
        held.current = false;
        setAsking(true);
        return;
      }
      openComposer(true);
    },
    onFocus: () => setFocused(true),
    onBlur: () => {
      setFocused(false);
      // an empty composer folds back into the pill; one with words stays open
      if (!draftRef.current.trim() && !sending.current) setMode('pill');
    },
    send: () => void send(),
    stop: () => ctl.current?.abort(),
    /** Try again: the same words, with the answers as they are now. */
    retry: () => void send(),
    undo: () => {
      const u = said?.undo;
      if (!u) return;
      hostRef.current.onChange(u.answers, u.keys, u.fromRuns, -1);
      haptics.select();
      setSaid(null);
    },
    /** A control was changed by hand: the line and its Undo no longer describe the answers. */
    retire: () => {
      setSaid((s) => (s ? null : s));
      setFailure((f) => (f ? null : f));
    },
    /** Not now on the permission step: nothing stored, nothing sent, back to the builder. */
    notNow: () => {
      held.current = false;
      setAsking(false);
    },
    veilGone: () => setOrbAway(false),
  };
};
export type BuilderAssistApi = ReturnType<typeof useBuilderAssist>;

/** The pill, the composer, and the line under them. */
export const AssistBar = ({ assist }: { assist: BuilderAssistApi }) => {
  const { mode, draft, said, failure, busy } = assist;
  const ready = draft.trim() !== '' && !busy;
  // The field grows with its words. `field-sizing: content` (assist.css) does that where the engine has it. Where it
  // does not (WebKit before it shipped), the height is set here, the way the assistant's own composer sets its own.
  useLayoutEffect(() => {
    const el = assist.field.current;
    if (mode !== 'compose' || !el) return;
    if (getComputedStyle(el).getPropertyValue('field-sizing') === 'content') return;
    el.style.height = 'auto';
    let h = el.scrollHeight;
    if (!el.value) {
      // an empty field is as tall as its hint: measured with the hint as its text, which is put back at once
      el.value = el.placeholder;
      h = el.scrollHeight;
      el.value = '';
    }
    el.style.height = `${h}px`;
  }, [draft, mode]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className={`pa${mode === 'compose' ? ' is-open' : ''}${assist.orbAway ? ' is-away' : ''}`} data-pa>
      <div className="pa-box">
        {mode === 'compose' ? (
          <div className="pa-compose">
            <textarea
              ref={assist.field}
              className="pa-input"
              rows={2}
              maxLength={PLAN_ASSIST_WORDS_MAX}
              placeholder="4 runs a week, long run Sunday, race on March 14"
              aria-label="Describe the plan you want"
              enterKeyHint="send"
              value={draft}
              readOnly={busy}
              onFocus={(e) => {
                assist.onFocus();
                // the whole composer clears the keyboard, Send included (the app reveals the field itself, lib/keyboard.ts)
                const box = e.currentTarget.closest<HTMLElement>('.pa-box');
                if (box) revealField(box);
              }}
              onBlur={assist.onBlur}
              onChange={(e) => assist.setDraft(e.target.value)}
              onKeyDown={(e) => {
                // Enter that confirms an IME's word only picks the word: it never sends
                if (e.nativeEvent.isComposing || e.keyCode === 229) return;
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  assist.send();
                } else if (e.key === 'Escape' && !draft.trim()) e.currentTarget.blur();
              }}
            />
            <div className="pa-tools">
              <span className="pa-orb" ref={assist.orb}>
                <Orb size={28} state="still" />
              </span>
              <button type="button" className="pa-send" aria-label="Send" disabled={!ready} onClick={assist.send}>
                <ArrowUp size={18} strokeWidth={1.75} aria-hidden="true" />
              </button>
            </div>
          </div>
        ) : (
          // a plain button: the tap itself opens the composer and takes focus, so the keyboard comes up with it
          <button type="button" className="pa-pill" aria-label={draft.trim() ? `Assistant. Your words: ${draft.trim()}` : 'Assistant. Describe your plan'} onClick={assist.open}>
            <span className="pa-orb" ref={assist.orb}>
              <Orb size={28} state="still" />
            </span>
            {draft.trim() ? <span className="pa-pill-text is-draft">{draft.trim()}</span> : <span className="pa-pill-text">Describe your plan</span>}
          </button>
        )}
        {said ? (
          <div className="pa-row" role="status">
            <p className="pa-row-text">
              {said.set ? <span className="pa-set">{said.set}</span> : null}
              {said.set && said.notes.length ? ' ' : null}
              {said.notes.length ? <span className="pa-notes">{said.notes.join(' ')}</span> : null}
            </p>
            {said.undo ? (
              <button type="button" className="pa-link" onClick={assist.undo}>
                Undo
              </button>
            ) : null}
          </div>
        ) : null}
        {failure ? (
          <div className="pa-row is-failure" role="alert">
            <CircleAlert size={18} strokeWidth={1.75} className="pa-row-ic" aria-hidden="true" />
            <p className="pa-row-text">{failure.line}</p>
            {failure.retry ? (
              <button type="button" className="pa-link" disabled={busy} onClick={assist.retry}>
                Try again
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
      {mode === 'compose' ? <p className="pa-ai">{AI_LABEL}</p> : null}
    </div>
  );
};

/** Where a point of the page sits, for the Orb's flight: the center of the pill's Orb and its size. */
const homeOf = (el: HTMLElement | null) => {
  if (!el || !el.isConnected) return null;
  const r = el.getBoundingClientRect();
  if (r.width <= 0 || r.bottom < 0 || r.top > window.innerHeight) return null;
  return { x: r.left + r.width / 2, y: r.top + r.height / 2, size: r.width };
};

const VeilInner = ({ shown, home, onStop, onGone }: { shown: boolean; home: RefObject<HTMLSpanElement | null>; onStop: () => void; onGone: () => void }) => {
  const reduce = useReduced();
  const [isPresent, safeToRemove] = usePresence();
  const scrim = useRef<HTMLDivElement>(null);
  const mid = useRef<HTMLDivElement>(null);
  const orb = useRef<HTMLSpanElement>(null);
  const stop = useRef<HTMLButtonElement>(null);
  const wasShown = useRef(false);
  // a slow answer: the line says it is still at it, so the wait never reads as stuck
  const [long, setLong] = useState(false);
  useEffect(() => {
    if (!shown) return;
    const t = setTimeout(() => setLong(true), VEIL_LONG_MS);
    return () => clearTimeout(t);
  }, [shown]);
  /** The move that puts the veil's Orb on the pill's Orb: an offset and a scale, or null when the pill is out of view. */
  const toHome = () => {
    const h = homeOf(home.current);
    const el = orb.current;
    if (!h || !el) return null;
    const r = el.getBoundingClientRect();
    // the Orb's own box at rest (a transform in flight changes its rect, not its layout size)
    const size = el.offsetWidth || r.width;
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    return { dx: h.x - cx, dy: h.y - cy, scale: h.size / size };
  };

  // it shows: the blur and the Cloud tint fade in, and the Orb lifts from its pill to the middle
  useLayoutEffect(() => {
    if (!shown || wasShown.current) return;
    wasShown.current = true;
    const fade = reduce ? reducedFade : fadeIn;
    if (scrim.current) animate(scrim.current, { opacity: [0, 1] }, fade);
    if (mid.current) animate(mid.current, { opacity: [0, 1] }, fade);
    const el = orb.current;
    const from = reduce ? null : toHome();
    if (el && from) animate(el, { x: [from.dx, 0], y: [from.dy, 0], scale: [from.scale, 1], opacity: [1, 1] }, springs.page);
    else if (el) animate(el, { opacity: [0, 1] }, fade);
    stop.current?.focus({ preventScroll: true });
    if (!el || !reduce) return;
    // Reduce Motion: the Orb holds still (no flight, no orbit) and its opacity pulses slowly, 1 to 0.6 and back every
    // 1.2 s, so a covered builder still shows it is working (guide 9.4's one named exception). Driven here, not in CSS:
    // the app's reduced-motion reset stops every CSS animation, by design.
    const pulse = animate(el, { opacity: [1, ORB_PULSE_TO, 1] }, { duration: ORB_PULSE_S, repeat: Infinity, ease: 'easeInOut', delay: reducedFade.duration });
    return () => pulse.stop();
  }, [shown]); // eslint-disable-line react-hooks/exhaustive-deps

  // it leaves: the tint clears and the Orb settles back into its pill, then the pill's own Orb takes over
  useEffect(() => {
    if (isPresent) return;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      onGone();
      safeToRemove();
    };
    if (!wasShown.current) return finish();
    const fade = reduce ? reducedFade : fadeOut;
    if (scrim.current) animate(scrim.current, { opacity: 0 }, fade);
    if (mid.current) animate(mid.current, { opacity: 0 }, fade);
    const el = orb.current;
    const to = reduce ? null : toHome();
    const last = el && to ? animate(el, { x: to.dx, y: to.dy, scale: to.scale }, springs.page) : el ? animate(el, { opacity: 0 }, fade) : null;
    // a stalled animation (a hidden tab) never holds the builder shut
    const guard = setTimeout(finish, 900);
    void Promise.resolve(last).then(finish, finish);
    return () => clearTimeout(guard);
  }, [isPresent]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <div ref={scrim} className="pa-veil-scrim" aria-hidden="true" />
      <span ref={orb} className="pa-veil-orb" aria-hidden="true">
        {shown ? <Orb size={56} state="think" /> : null}
      </span>
      <div ref={mid} className="pa-veil-mid">
        {shown ? (
          <>
            <p className="pa-veil-line" role="status">
              {long ? 'Still shaping your plan' : 'Shaping your plan'}
            </p>
            <button ref={stop} type="button" className="btn pa-stop" onClick={onStop}>
              Stop
            </button>
          </>
        ) : null}
      </div>
    </>
  );
};

/**
 * The veil over the builder while the assistant works, drawn inside the sheet over its header and body (the title and
 * Close stay clear of it). From the tap it takes every touch, so nothing changes under a request in flight; what it shows
 * comes 150 ms later.
 */
export const AssistVeil = ({ assist, anchor }: { assist: BuilderAssistApi; anchor: RefObject<HTMLElement | null> }) => {
  const [host, setHost] = useState<{ el: HTMLElement; top: number } | null>(null);
  useLayoutEffect(() => {
    if (!assist.busy) return;
    const sheet = anchor.current?.closest<HTMLElement>('.sheet') ?? null;
    if (!sheet) return;
    setHost({ el: sheet, top: sheet.querySelector<HTMLElement>('.sheet-grab')?.offsetHeight ?? 0 });
    // what is under the veil takes no focus and no touch until it lifts
    const under = [...sheet.querySelectorAll<HTMLElement>(':scope > .sheet-header, :scope > .sheet-stack')];
    under.forEach((el) => el.setAttribute('inert', ''));
    return () => under.forEach((el) => el.removeAttribute('inert'));
  }, [assist.busy, anchor]);
  if (!host) return null;
  return createPortal(
    <AnimatePresence>
      {assist.busy ? (
        <div key="veil" className={`pa-veil${assist.veil ? ' is-shown' : ''}`} style={{ top: host.top }}>
          <VeilInner shown={assist.veil} home={assist.orb} onStop={assist.stop} onGone={assist.veilGone} />
        </div>
      ) : null}
    </AnimatePresence>,
    host.el,
  );
};
