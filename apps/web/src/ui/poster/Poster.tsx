import { ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { Pressable } from '@/ui/Pressable';
import { PosterScene } from './PosterScene';
import './poster.css';

/** The band: one Deep Sky strip of words on the far hill (Night Ink at dusk). */
export interface PosterBand {
  /** The caption over the words, set in caps: "An idea · from Fitness", "To-dos today". */
  label: ReactNode;
  /** The words: "Bike 40 min, before lunch", "1 of 3 done". */
  words: ReactNode;
  /** Quieter words after them on the same line, after a dot (it wraps under where there is no room). */
  second?: ReactNode;
  /** A control at the band's right end: a check, a pill. It is not part of the band's button. */
  trailing?: ReactNode;
  /** The band's words are a button; a chevron follows the caption. */
  onPress?: () => void;
  /** What VoiceOver says for the button. Default: the caption and the words as written. */
  pressLabel?: string;
}

export interface PosterProps {
  /** day: Haze sky over Paper, a Deep Sky band. dusk: Night Ink to Twilight, a Night Ink band (What I learned). Default day. */
  ground?: 'day' | 'dusk';
  /** full: the card a page leads with. slim: under another poster on the same page (no second sun). Default full. */
  size?: 'full' | 'slim';
  /** The title, in Fraunces. It may take two lines. */
  title: ReactNode;
  /** lead: the page's question (32/36). goal: the person's own words, one step smaller (30/34). Default lead. */
  titleSize?: 'lead' | 'goal';
  /** The title's element. Default h2. */
  titleAs?: 'h2' | 'h3' | 'p';
  /** The first words of the meta line, in the now color (Ember on day, Haze at dusk): "Today", "Today’s goal". */
  now?: ReactNode;
  /** The rest of the meta line: "14 h left". With `now`, a dot joins them. */
  meta?: ReactNode;
  /** The picture between the words and the band. Default on day: `<PosterScene size={size} />`. Pass null for none. */
  scene?: ReactNode;
  band?: PosterBand;
  /** A `<PathLine>` under the band, edge to edge: its line starts at the band. */
  path?: ReactNode;
  /** The controls under the band, on Paper, padded. */
  children?: ReactNode;
  /** The card's accessible name (it is a region when given). */
  label?: string;
  className?: string;
}

const Band = ({ label, words, second, trailing, onPress, pressLabel }: PosterBand) => {
  const said = (
    <span className="po-read-in">
      <span className="po-label">
        <span>{label}</span>
        {onPress ? <ChevronRight size={12} aria-hidden="true" /> : null}
      </span>
      <span className="po-said">
        <span className="po-words-b">{words}</span>
        {second ? <span className="po-second">{second}</span> : null}
      </span>
    </span>
  );
  return (
    <div className="po-band">
      {onPress ? (
        <Pressable className="po-read" press="dim" label={pressLabel} onPress={() => onPress()}>
          {said}
        </Pressable>
      ) : (
        <div className="po-read">{said}</div>
      )}
      {trailing ? <span className="po-band-end">{trailing}</span> : null}
    </div>
  );
};

/**
 * The poster: the card every screen leads with, built like the training card. A Fraunces title and a meta line on the sky,
 * a picture, one band of words, then the controls on Paper. Presentational: it holds no state.
 */
export const Poster = ({ ground = 'day', size = 'full', title, titleSize = 'lead', titleAs: Title = 'h2', now, meta, scene, band, path, children, label, className = '' }: PosterProps) => (
  <section className={`po is-${ground} is-${size} ${className}`.trim()} aria-label={label}>
    <div className="po-top">
      <span className="po-sky" aria-hidden="true" />
      <div className="po-words">
        <Title className={`po-title is-${titleSize}`}>{title}</Title>
        {now || meta ? (
          <p className="po-meta">
            {now ? <b className="po-now">{now}</b> : null}
            {now && meta ? ' · ' : null}
            {meta}
          </p>
        ) : null}
      </div>
      {scene === undefined ? ground === 'day' ? <PosterScene size={size} /> : null : scene}
      {band ? <Band {...band} /> : null}
    </div>
    {path ? <div className="po-path">{path}</div> : null}
    {children ? <div className="po-ctl">{children}</div> : null}
  </section>
);
