import { describe, expect, it } from 'vitest';
import { ASK_LIMITS, ATTACHMENT_LIMITS, base64Bytes, base64Head, sniffMediaType, zAssistantAsk } from './assistant';

const HEAD = { jpeg: [0xff, 0xd8, 0xff, 0xe0], pdf: [0x25, 0x50, 0x44, 0x46, 0x2d] };
/** Base64 of `bytes` bytes that start like a real file of that kind. */
const b64 = (bytes: number, kind: keyof typeof HEAD = 'jpeg') => {
  const data = new Uint8Array(Math.ceil(bytes / 3) * 3);
  data.set(HEAD[kind]);
  return Buffer.from(data).toString('base64');
};
const photo = (name = 'plan.jpg', bytes = 1000) => ({ name, mediaType: 'image/jpeg' as const, data: b64(bytes) });
const ask = (turns: unknown) => zAssistantAsk.safeParse({ date: '2026-11-02', turns });

describe('files sent to the assistant', () => {
  it('counts decoded bytes from base64', () => {
    expect(base64Bytes('QUJD')).toBe(3);
    expect(base64Bytes('QUI=')).toBe(2);
    expect(base64Bytes('QQ==')).toBe(1);
  });

  it('takes a photo or a PDF with words, or on its own', () => {
    expect(ask([{ role: 'user', text: 'Put this plan in', attachments: [photo()] }]).success).toBe(true);
    expect(ask([{ role: 'user', text: '', attachments: [{ name: 'plan.pdf', mediaType: 'application/pdf', data: b64(5000, 'pdf') }] }]).success).toBe(true);
  });

  it('refuses an empty turn, a strange type, line breaks in the data, and files over the limits', () => {
    expect(ask([{ role: 'user', text: '  ' }]).success).toBe(false);
    expect(ask([{ role: 'user', text: 'x', attachments: [{ name: 'a.heic', mediaType: 'image/heic', data: b64(10) }] }]).success).toBe(false);
    expect(ask([{ role: 'user', text: 'x', attachments: [{ ...photo(), data: 'QUJD\nQUJD' }] }]).success).toBe(false);
    expect(ask([{ role: 'user', text: 'x', attachments: [photo('big.jpg', ATTACHMENT_LIMITS.imageBytes + 10)] }]).success).toBe(false);
    // bytes that are not what the type says: a PDF called a photo, or text called a PDF (sec-28)
    expect(ask([{ role: 'user', text: 'x', attachments: [{ ...photo(), data: b64(1000, 'pdf') }] }]).success).toBe(false);
    expect(ask([{ role: 'user', text: 'x', attachments: [{ name: 'a.pdf', mediaType: 'application/pdf', data: Buffer.from('hello there, not a pdf').toString('base64') }] }]).success).toBe(false);
    const five = Array.from({ length: 5 }, (_, i) => photo(`p${i}.jpg`));
    expect(ask([{ role: 'user', text: 'x', attachments: five }]).success).toBe(false);
    // four across two turns is fine; five across two turns is not
    expect(ask([{ role: 'user', text: 'a', attachments: [photo(), photo()] }, { role: 'assistant', text: 'ok' }, { role: 'user', text: 'b', attachments: [photo(), photo()] }]).success).toBe(true);
    expect(ask([{ role: 'user', text: 'a', attachments: [photo(), photo(), photo()] }, { role: 'assistant', text: 'ok' }, { role: 'user', text: 'b', attachments: [photo(), photo()] }]).success).toBe(false);
  });
});

describe('sniffing a file from its bytes', () => {
  it('knows PDF, JPEG, PNG, WebP and GIF, and nothing else', () => {
    const b = (s: string | number[]) => (typeof s === 'string' ? [...s].map((c) => c.charCodeAt(0)) : s);
    expect(sniffMediaType(b('%PDF-1.7'))).toBe('application/pdf');
    expect(sniffMediaType(b([0xff, 0xd8, 0xff, 0xdb]))).toBe('image/jpeg');
    expect(sniffMediaType(b([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]))).toBe('image/png');
    expect(sniffMediaType(b('RIFF\x00\x00\x00\x00WEBPVP8 '))).toBe('image/webp');
    expect(sniffMediaType(b('GIF89a'))).toBe('image/gif');
    for (const x of ['<html>', 'PK\x03\x04', '', 'RIFF....WAVE']) expect(sniffMediaType(b(x))).toBeNull();
    expect(base64Head(Buffer.from('%PDF-1.4 rest').toString('base64'), 5)).toEqual(b('%PDF-'));
  });
});

describe('a long chat', () => {
  const chat = (n: number) => Array.from({ length: n }, (_, i) => ({ role: i % 2 === 0 ? ('user' as const) : ('assistant' as const), text: `turn ${i}` }));

  it('60 turns are accepted and cut to the newest 40, not refused', () => {
    const r = ask([...chat(60), { role: 'user', text: 'the newest' }]);
    expect(r.success).toBe(true);
    const turns = r.data!.turns;
    expect(turns).toHaveLength(ASK_LIMITS.turns);
    expect(turns.at(-1)).toMatchObject({ role: 'user', text: 'the newest' });
    expect(turns[0]!.text).toBe('turn 21');
  });

  it('a 30,000 character answer is accepted whole, and a longer one is cut to the cap, not refused', () => {
    const long = ask([{ role: 'user', text: 'a' }, { role: 'assistant', text: 'x'.repeat(30_000) }, { role: 'user', text: 'b' }]);
    expect(long.success).toBe(true);
    expect(long.data!.turns[1]!.text).toHaveLength(30_000);
    const huge = ask([{ role: 'user', text: 'a' }, { role: 'assistant', text: 'y'.repeat(90_000) }, { role: 'user', text: 'b' }]);
    expect(huge.success).toBe(true);
    expect(huge.data!.turns[1]!.text).toHaveLength(ASK_LIMITS.assistantText);
  });

  it('an old turn outside the newest 40 can never break the chat, and what the person types is still held to 8,000', () => {
    const bad = { role: 'user', text: 'z'.repeat(9_000) };
    expect(ask([bad, ...chat(41), { role: 'user', text: 'ok' }]).success).toBe(true);
    const r = ask([{ role: 'user', text: 'z'.repeat(9_000) }]);
    expect(r.success).toBe(false);
    expect(r.error!.issues[0]!.message).toBe('Keep a message under 8000 characters');
    expect(ask([]).success).toBe(false);
  });
});
