import { isNative } from './native';

type Kind = 'tick' | 'success' | 'warn';
let native: typeof import('@capacitor/haptics') | null = null;
if (isNative) void import('@capacitor/haptics').then((m) => (native = m));

/** A small tap of feedback where the platform offers it. Silent everywhere else. */
export const haptic = (kind: Kind = 'tick') => {
  try {
    if (native) {
      if (kind === 'tick') void native.Haptics.impact({ style: native.ImpactStyle.Light });
      else void native.Haptics.notification({ type: kind === 'success' ? native.NotificationType.Success : native.NotificationType.Warning });
      return;
    }
    if (!('vibrate' in navigator)) return;
    navigator.vibrate(kind === 'tick' ? 8 : kind === 'success' ? [10, 30, 14] : [20, 40, 20]);
  } catch {
    /* unsupported */
  }
};
