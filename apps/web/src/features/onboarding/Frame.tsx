import { ChevronLeft } from 'lucide-react';
import type * as React from 'react';
import { Pressable } from '@/ui';
import { SetupBar } from './beats';
import './onboarding.css';

/**
 * The question frame: one layout for every setup question, so the flow reads as one thing and looks like the app it
 * leads into.
 *
 *   FrameBar   the top bar: Back, the progress marks (the account already filled), nothing else
 *   Frame      the question in Fraunces (the size the tabs use for a title inside a page), one plain line, the poster
 *              (a real piece of the app that this answer changes, live), the controls on Paper, and one Sky button
 *              pinned at the foot, with a quiet link over it only where skipping is real
 *
 * The frame is presentational: the flow (Welcome.tsx) owns the answers and hands each step its poster and its controls.
 * The shared type and spacing live at the top of onboarding.css under `ob-bar`, `ob-title`, `ob-lede`, `ob-poster`,
 * `ob-controls`, `ob-foot` and `ob-cta`; the welcome pager, the account screens and the tour use the same names.
 */

export interface FrameBarProps {
  /** How many questions this path asks, and which one is on screen (0 first). */
  steps: number;
  index: number;
  /** Back is offered (not on the first question). Hidden, it keeps its place and is inert. */
  canBack: boolean;
  onBack: () => void;
}

/** The top bar. It stays put while the questions slide under it. */
export const FrameBar = ({ steps, index, canBack, onBack }: FrameBarProps): React.JSX.Element => (
  <header className="ob-bar ob-top">
    {/* Back fades with its slot when a step has none, never a one-frame cut; hidden, it is out of the tab order, the
        accessibility tree and hit-testing. The fade is the slot's, so the button keeps its own press */}
    <span className={`ob-slot ${canBack ? '' : 'is-gone'}`} inert={!canBack}>
      <button type="button" className="icon-btn ob-back" aria-label="Back" onClick={canBack ? onBack : undefined}>
        <ChevronLeft size={18} aria-hidden="true" />
      </button>
    </span>
    <SetupBar steps={steps} index={index} />
    <span aria-hidden="true" />
  </header>
);

export interface FrameProps {
  /** The question. Focus lands on it when the step arrives. */
  title: string;
  /** One plain line under it. */
  lede: React.ReactNode;
  /** The picture this answer changes: a real piece of the app. */
  poster?: React.ReactNode;
  /** What the picture says, for VoiceOver (the picture itself is hidden from it). Read again, politely, when it changes. */
  posterLabel?: string;
  /** false: the label is not read again on a change (the name, which is already spoken as it is typed). Default true. */
  posterLive?: boolean;
  /** The controls. */
  children?: React.ReactNode;
  /** The Sky button. */
  next: { label?: string; onPress: () => void; disabled?: boolean; busy?: boolean };
  /** One quiet link over the button, only where skipping is real ("Skip for now"). */
  quiet?: React.ReactNode;
  /** One line over the button, only when a step has something the picture cannot say (a warning's way out is a control). */
  note?: React.ReactNode;
}

/** One question to a screen. */
export const Frame = ({ title, lede, poster, posterLabel, posterLive = true, children, next, quiet, note }: FrameProps): React.JSX.Element => (
  <div className="ob-step ob-frame">
    <h1 className="ob-title display" tabIndex={-1}>
      {title}
    </h1>
    <p className="ob-lede">{lede}</p>
    {poster ? (
      // the picture is a picture: VoiceOver gets one sentence for it, and nothing inside it takes a tap or the focus
      <div className="ob-poster" role={posterLabel ? 'img' : undefined} aria-label={posterLabel}>
        <div className="ob-poster-in" aria-hidden={posterLabel ? true : undefined} inert={posterLabel ? true : undefined}>
          {poster}
        </div>
      </div>
    ) : null}
    {posterLabel && posterLive ? (
      <p className="sr-only" role="status" aria-live="polite">
        {posterLabel}
      </p>
    ) : null}
    {children ? <div className="ob-controls">{children}</div> : null}
    <div className="ob-foot">
      {note ? <p className="ob-later">{note}</p> : null}
      {/* a quiet link stands over the button, so the button is in the same place on every question */}
      {quiet}
      <Pressable className="btn primary block ob-cta" disabled={next.disabled || next.busy} onPress={next.onPress}>
        {next.label ?? 'Next'}
      </Pressable>
    </div>
  </div>
);

/** A quiet link by the Sky button: Deep Sky words on the ground, 44 tall. */
export const QuietLink = ({ children, onPress, disabled, label }: { children: React.ReactNode; onPress: () => void; disabled?: boolean; label?: string }): React.JSX.Element => (
  <Pressable className="ob-quiet" press="dim" disabled={disabled} label={label} onPress={onPress}>
    {children}
  </Pressable>
);
