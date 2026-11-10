import { isNative } from '@/lib/native';
import type { ExportOutcome } from './accountModel';

const isCancel = (e: unknown) => /cancel|abort/i.test(e instanceof Error ? `${e.name} ${e.message}` : String((e as { message?: unknown } | null)?.message ?? e ?? ''));

/** The web: a download through a Blob link. */
const download = (text: string, name: string) => {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
};

/**
 * Hand the export file to the person. On the web it downloads. In the iPhone app a web view cannot download, so the JSON
 * is written to the app's cache folder and the system share sheet opens on it (Save to Files, AirDrop, Mail): the answer
 * is `shared` only when that sheet finishes, and `cancelled` when it is closed. The cache copy is removed afterwards
 * either way, so the whole log is not left lying in a temporary folder.
 */
export const deliverExport = async (data: unknown, name: string): Promise<ExportOutcome> => {
  const text = JSON.stringify(data, null, 2);
  if (!isNative) {
    download(text, name);
    return 'saved';
  }
  const [{ Filesystem, Directory, Encoding }, { Share }] = await Promise.all([import('@capacitor/filesystem'), import('@capacitor/share')]);
  const { uri } = await Filesystem.writeFile({ path: name, data: text, directory: Directory.Cache, encoding: Encoding.UTF8 });
  try {
    await Share.share({ title: name, files: [uri] });
    return 'shared';
  } catch (e) {
    if (isCancel(e)) return 'cancelled';
    throw e;
  } finally {
    await Filesystem.deleteFile({ path: name, directory: Directory.Cache }).catch(() => undefined);
  }
};
