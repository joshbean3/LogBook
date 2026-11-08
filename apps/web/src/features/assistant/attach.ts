import { ATTACHMENT_LIMITS, base64Bytes, type AssistantFileShown, type AssistantTurn, type Attachment } from '@logbook/shared';

/** A file ready to send: the data the server gets, and what the thread shows for it. */
export interface PreparedFile {
  file: Attachment;
  shown: AssistantFileShown;
}

export class AttachError extends Error {}

/** Claude reads a photo best at up to 1568 px on the long edge; larger only costs upload time and tokens. */
const MAX_EDGE = 1568;
const THUMB_EDGE = 160;

const loadImage = (blob: Blob) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('decode'));
    };
    img.src = url;
  });

/** The photo as a JPEG data URL, scaled so its long edge is at most `edge` (a transparent PNG gets a white ground). */
const jpegOf = (img: HTMLImageElement, edge: number, quality: number) => {
  const scale = Math.min(1, edge / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
  const w = Math.max(1, Math.round((img.naturalWidth || 1) * scale));
  const h = Math.max(1, Math.round((img.naturalHeight || 1) * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new AttachError('This device could not prepare the photo.');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL('image/jpeg', quality);
};

const base64Of = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '');
    r.onerror = () => reject(r.error ?? new Error('read'));
    r.readAsDataURL(blob);
  });

const isPdf = (f: File) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name);
const isPhoto = (f: File) => f.type.startsWith('image/') || /\.(jpe?g|png|webp|gif|heic|heif)$/i.test(f.name);

/**
 * A picked file, ready for the assistant. A PDF goes as it is (up to 10 MB). A photo, in any format the phone can show
 * (HEIC included), becomes a JPEG at most 1568 px on its long edge, with a small preview for the thread.
 */
export const prepareFile = async (f: File): Promise<PreparedFile> => {
  if (isPdf(f)) {
    const name = f.name || 'file.pdf';
    if (f.size > ATTACHMENT_LIMITS.pdfBytes) throw new AttachError(`${name} is over 10 MB. Try a smaller PDF, or a photo of the page that matters.`);
    return { file: { name, mediaType: 'application/pdf', data: await base64Of(f) }, shown: { name, mediaType: 'application/pdf' } };
  }
  if (isPhoto(f)) {
    const name = f.name || 'photo.jpg';
    let img: HTMLImageElement;
    try {
      img = await loadImage(f);
    } catch {
      throw new AttachError(`Couldn’t open ${name}. Try a JPEG or PNG, or a screenshot.`);
    }
    let url = jpegOf(img, MAX_EDGE, 0.85);
    if (base64Bytes(url.split(',')[1] ?? '') > ATTACHMENT_LIMITS.imageBytes) url = jpegOf(img, 1200, 0.7);
    const data = url.split(',')[1] ?? '';
    return { file: { name: name.replace(/\.[^.]+$/, '') + '.jpg', mediaType: 'image/jpeg', data }, shown: { name, mediaType: 'image/jpeg', thumb: jpegOf(img, THUMB_EDGE, 0.7) } };
  }
  throw new AttachError(`${f.name || 'That file'} isn’t a photo or a PDF.`);
};

/** A turn as the server reads it. */
export interface RequestTurn {
  role: 'user' | 'assistant';
  text: string;
  attachments?: Attachment[];
}

const wordsOf = (t: AssistantTurn) => {
  const p = t.proposal;
  if (!p) return t.text;
  const left = p.skipped?.length ? ` He left out: ${p.skipped.map((i) => p.changes[i]?.label ?? `change ${i + 1}`).join('; ')}.` : '';
  return `${t.text}\n[Proposed: ${p.summary} Status: ${p.status}.${left}]`.trim();
};

/**
 * The conversation as sent: newest files first, as many as fit the limits (4 files, 20 MB), so the assistant can still
 * look at a photo sent a few turns back. A turn whose files are not resent (too many, or the app was reopened and the
 * data is gone) names them, so the assistant knows something was shown there. An ask that did not go through is the
 * app's message, not the assistant's: it is never sent back.
 */
export const requestTurns = (all: readonly AssistantTurn[], dataOf: (t: AssistantTurn) => Attachment[] | undefined): RequestTurn[] => {
  const turns = all.filter((t) => !t.error);
  const out: RequestTurn[] = turns.map((t) => ({ role: t.role, text: wordsOf(t) }));
  let count = 0;
  let bytes = 0;
  for (let i = turns.length - 1; i >= 0; i--) {
    const data = dataOf(turns[i]!);
    if (!data?.length) continue;
    const size = data.reduce((n, f) => n + base64Bytes(f.data), 0);
    if (count + data.length > ATTACHMENT_LIMITS.perRequest || bytes + size > ATTACHMENT_LIMITS.requestBytes) continue;
    count += data.length;
    bytes += size;
    out[i]!.attachments = data;
  }
  turns.forEach((t, i) => {
    if (t.files?.length && !out[i]!.attachments) out[i]!.text = `${out[i]!.text}\n[Sent earlier: ${t.files.map((f) => f.name).join(', ')}]`.trim();
  });
  return out;
};
