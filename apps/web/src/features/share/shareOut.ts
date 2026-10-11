import { isNative } from '@/lib/native';

export type ShareMode = 'share' | 'save';
export type ShareResult = 'shared' | 'saved' | 'cancelled';

const toBase64 = (blob: Blob) =>
  new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onerror = () => rej(r.error ?? new Error('Could not read image'));
    r.onload = () => res(String(r.result).split(',')[1] ?? '');
    r.readAsDataURL(blob);
  });

const download = (blob: Blob, name: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
};

const isCancel = (e: unknown) => (e instanceof Error && (e.name === 'AbortError' || /cancel/i.test(e.message))) || (typeof e === 'object' && e !== null && /cancel/i.test(String((e as { message?: string }).message ?? '')));

/**
 * Hand the PNG to the system. In the app the file is written to the cache and the native share sheet opens
 * (where "Save Image" lives too); in a browser, the Web Share API when it takes files, else a download.
 */
export const shareImage = async (blob: Blob, name: string, mode: ShareMode): Promise<ShareResult> => {
  if (isNative) {
    const [{ Filesystem, Directory }, { Share }] = await Promise.all([import('@capacitor/filesystem'), import('@capacitor/share')]);
    const data = await toBase64(blob);
    const { uri } = await Filesystem.writeFile({ path: name, data, directory: Directory.Cache });
    try {
      await Share.share({ files: [uri] });
      return 'shared';
    } catch (e) {
      if (isCancel(e)) return 'cancelled';
      throw e;
    }
  }
  const file = new File([blob], name, { type: 'image/png' });
  if (mode === 'share' && typeof navigator.share === 'function' && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return 'shared';
    } catch (e) {
      if (isCancel(e)) return 'cancelled';
      throw e;
    }
  }
  download(blob, name);
  return 'saved';
};
