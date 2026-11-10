import lockupFlatInk from './brand/lockup-horizontal-flat-ink.svg?url';
import wordmarkInk from './brand/wordmark-ink.svg?url';

/*
 * Orby's logo, never live text (guide 2.2 to 2.4): the outlined wordmark and the horizontal lockup, copied unmodified from
 * docs/brand/assets. Each SVG is under Vite's inline limit, so it ships as a data URI (no request, no flash).
 */

/** The wordmark box: 4393 x 1988 units (guide 2.2). */
const WORD_RATIO = 1988 / 4393;
/** The horizontal lockup box: 5783 x 1988 units. */
const LOCKUP_RATIO = 5783 / 1988;

/** The outlined "Orby", Night Ink on a light ground. At least 64 pt wide on screen (guide 2.4). */
export const Wordmark = ({ width = 64, className }: { width?: number; className?: string }) => (
  <img className={className ? `lb-wordmark ${className}` : 'lb-wordmark'} src={wordmarkInk} width={width} height={Math.round(width * WORD_RATIO)} alt="Orby" draggable={false} />
);

/**
 * The horizontal lockup for a header (the welcome and sign-in screens): 24 pt cap height, a 34 pt tall box (guide 2.4). Its
 * Orb renders under 28 px there, so this is the flat file, where the Orb is the flat Sky disc.
 */
export const Lockup = ({ height = 34, className }: { height?: number; className?: string }) => (
  <img className={className ? `lb-lockup ${className}` : 'lb-lockup'} src={lockupFlatInk} width={Math.round(height * LOCKUP_RATIO)} height={height} alt="Orby" draggable={false} />
);
