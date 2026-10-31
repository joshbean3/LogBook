import { describe, expect, it } from 'vitest';
import { parseSSE } from './sse';

describe('parseSSE', () => {
  it('reads whole events and keeps a partial one for the next chunk', () => {
    const chunk = 'event: text\ndata: "Hel"\n\nevent: text\ndata: "lo"\n\nevent: done\ndata: {"text":"Hello","propo';
    const { events, rest } = parseSSE(chunk);
    expect(events).toEqual([
      { event: 'text', data: 'Hel' },
      { event: 'text', data: 'lo' },
    ]);
    expect(rest).toBe('event: done\ndata: {"text":"Hello","propo');
    const next = parseSSE(`${rest}sal":null}\n\n`);
    expect(next.events).toEqual([{ event: 'done', data: { text: 'Hello', proposal: null } }]);
    expect(next.rest).toBe('');
  });

  it('joins multi-line data, skips comments, defaults the event name, and flushes at the end', () => {
    const { events } = parseSSE(': keep-alive\nevent: text\ndata: "a"\ndata: "b"\n\ndata: plain', true);
    expect(events).toEqual([
      { event: 'text', data: '"a"\n"b"' },
      { event: 'message', data: 'plain' },
    ]);
    expect(parseSSE('event: x\r\ndata: 1\r\n\r\n').events).toEqual([{ event: 'x', data: 1 }]);
  });
});
