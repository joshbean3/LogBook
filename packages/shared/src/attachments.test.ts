import { describe, expect, it } from 'vitest';
import { ATTACHMENT_LIMITS, base64Bytes, zAssistantAsk } from './assistant';

const b64 = (bytes: number) => 'A'.repeat(Math.ceil(bytes / 3) * 4);
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
    expect(ask([{ role: 'user', text: '', attachments: [{ name: 'plan.pdf', mediaType: 'application/pdf', data: b64(5000) }] }]).success).toBe(true);
  });

  it('refuses an empty turn, a strange type, line breaks in the data, and files over the limits', () => {
    expect(ask([{ role: 'user', text: '  ' }]).success).toBe(false);
    expect(ask([{ role: 'user', text: 'x', attachments: [{ name: 'a.heic', mediaType: 'image/heic', data: b64(10) }] }]).success).toBe(false);
    expect(ask([{ role: 'user', text: 'x', attachments: [{ ...photo(), data: 'QUJD\nQUJD' }] }]).success).toBe(false);
    expect(ask([{ role: 'user', text: 'x', attachments: [photo('big.jpg', ATTACHMENT_LIMITS.imageBytes + 10)] }]).success).toBe(false);
    const five = Array.from({ length: 5 }, (_, i) => photo(`p${i}.jpg`));
    expect(ask([{ role: 'user', text: 'x', attachments: five }]).success).toBe(false);
    // four across two turns is fine; five across two turns is not
    expect(ask([{ role: 'user', text: 'a', attachments: [photo(), photo()] }, { role: 'assistant', text: 'ok' }, { role: 'user', text: 'b', attachments: [photo(), photo()] }]).success).toBe(true);
    expect(ask([{ role: 'user', text: 'a', attachments: [photo(), photo(), photo()] }, { role: 'assistant', text: 'ok' }, { role: 'user', text: 'b', attachments: [photo(), photo()] }]).success).toBe(false);
  });
});
