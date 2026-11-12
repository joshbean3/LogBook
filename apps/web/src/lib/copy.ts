/** Sentences more than one screen shows, so they read the same everywhere. */
export const DISCLAIMER = 'Orby is for fitness and wellness. It is not medical advice. Talk to a doctor before changing your training, and if something feels wrong.';
/** With Fitness switched off (lib/prefs.ts) the same notice, without the words about training. */
export const DISCLAIMER_PLAIN = 'Orby is for wellness. It is not medical advice. Talk to a doctor if something feels wrong.';
export const disclaimer = (fitness: boolean): string => (fitness ? DISCLAIMER : DISCLAIMER_PLAIN);
export const AI_LABEL = 'AI assistant, powered by Claude. It can be wrong. Check anything important.';
export const MIN_AGE = 18;
