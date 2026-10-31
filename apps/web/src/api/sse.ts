/**
 * Server-sent events, parsed from a growing buffer: each blank-line-terminated block is one event (`event:` name,
 * `data:` lines joined with newlines and read as JSON when they are). Pure, so it is tested without a network.
 */
export interface SSEEvent {
  event: string;
  data: unknown;
}

export const parseSSE = (buffer: string, flush = false): { events: SSEEvent[]; rest: string } => {
  const events: SSEEvent[] = [];
  const text = buffer.replace(/\r\n/g, '\n');
  const parts = text.split('\n\n');
  const rest = flush ? '' : (parts.pop() ?? '');
  for (const block of parts) {
    if (!block.trim()) continue;
    let event = 'message';
    const data: string[] = [];
    for (const line of block.split('\n')) {
      if (line.startsWith(':')) continue;
      const i = line.indexOf(':');
      const field = i < 0 ? line : line.slice(0, i);
      const value = i < 0 ? '' : line.slice(i + 1).replace(/^ /, '');
      if (field === 'event') event = value;
      else if (field === 'data') data.push(value);
    }
    const raw = data.join('\n');
    let parsed: unknown = raw;
    try {
      parsed = JSON.parse(raw);
    } catch {
      /* plain text */
    }
    events.push({ event, data: parsed });
  }
  return { events, rest };
};
