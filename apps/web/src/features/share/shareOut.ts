import { isNative } from '@/lib/native';

export type ShareResult = 'shared' | 'copied' | 'cancelled';

const isCancel = (e: unknown) => (e instanceof Error && (e.name === 'AbortError' || /cancel/i.test(e.message))) || (typeof e === 'object' && e !== null && /cancel/i.test(String((e as { message?: string }).message ?? '')));

/**
 * Hand a text to the system: the native share sheet in the app, the Web Share API in a browser that has it, else the
 * clipboard.
 */
export const shareText = async (text: string, title: string): Promise<ShareResult> => {
  if (isNative) {
    const { Share } = await import('@capacitor/share');
    try {
      await Share.share({ title, text });
      return 'shared';
    } catch (e) {
      if (isCancel(e)) return 'cancelled';
      throw e;
    }
  }
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ title, text });
      return 'shared';
    } catch (e) {
      if (isCancel(e)) return 'cancelled';
      /* a browser that refuses text: the clipboard */
    }
  }
  await navigator.clipboard.writeText(text);
  return 'copied';
};
