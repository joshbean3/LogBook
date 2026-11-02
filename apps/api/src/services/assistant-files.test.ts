import { describe, expect, it } from 'vitest';
import { messagesFor } from './assistant.js';

const jpg = { name: 'week.jpg', mediaType: 'image/jpeg' as const, data: 'QUJD' };
const pdf = { name: 'plan.pdf', mediaType: 'application/pdf' as const, data: 'JVBERi0=' };

describe('the messages for an ask with files', () => {
  it('puts the files before the words, the context on the last turn, and one cache mark on the newest file', () => {
    const m = messagesFor(
      [
        { role: 'user', text: 'Here is my plan', attachments: [pdf] },
        { role: 'assistant', text: 'Got it. When does it start?' },
        { role: 'user', text: 'Monday. And this is my week', attachments: [jpg] },
      ],
      'TODAY: 2026-11-02',
    );
    expect(m.map((x) => x.role)).toEqual(['user', 'assistant', 'user']);
    const first = m[0]!.content as unknown as Array<Record<string, unknown>>;
    expect(first.map((b) => b.type)).toEqual(['document', 'text']);
    expect(first[0]).toMatchObject({ source: { type: 'base64', media_type: 'application/pdf', data: 'JVBERi0=' }, title: 'plan.pdf' });
    expect(first[0]!.cache_control).toBeUndefined();
    const last = m[2]!.content as unknown as Array<Record<string, unknown>>;
    expect(last.map((b) => b.type)).toEqual(['image', 'text', 'text']);
    expect(last[0]).toMatchObject({ source: { type: 'base64', media_type: 'image/jpeg', data: 'QUJD' }, cache_control: { type: 'ephemeral' } });
    expect(last[1]).toMatchObject({ text: 'CONTEXT\nTODAY: 2026-11-02' });
    expect(last[2]).toMatchObject({ text: 'Monday. And this is my week' });
  });

  it('gives a file sent with no words a line to answer, and leaves plain turns as they were', () => {
    const m = messagesFor([{ role: 'user', text: '', attachments: [jpg] }], 'C');
    expect((m[0]!.content as unknown as Array<{ type: string; text?: string }>).map((b) => b.text ?? b.type)).toEqual(['image', 'CONTEXT\nC', 'Take a look at this.']);
    const plain = messagesFor([{ role: 'user', text: 'What is left this week?' }], 'C');
    expect((plain[0]!.content as unknown as Array<{ type: string }>).map((b) => b.type)).toEqual(['text', 'text']);
  });
});
