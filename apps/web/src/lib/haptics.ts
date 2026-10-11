/** A small tap of feedback where the platform offers it. Silent everywhere else. */
export const haptic = (kind: 'tick' | 'success' | 'warn' = 'tick') => {
  try {
    if (!('vibrate' in navigator)) return;
    navigator.vibrate(kind === 'tick' ? 8 : kind === 'success' ? [10, 30, 14] : [20, 40, 20]);
  } catch {
    /* unsupported */
  }
};
