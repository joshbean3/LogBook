import type * as React from 'react';
import { Fragment, memo } from 'react';

/**
 * An answer's words with the little formatting it uses: paragraphs, **bold**, *italic*, `code`, bulleted and numbered
 * lists, and a short "### heading" line. Built as React elements from the text (never as HTML), so nothing in an answer
 * can inject markup; anything else shows as written. Safe on half-written text: an unclosed ** shows as plain words.
 */
type Block = { kind: 'p'; lines: string[] } | { kind: 'ul' | 'ol'; items: string[] } | { kind: 'h'; text: string };

export const blocksOf = (text: string): Block[] => {
  const out: Block[] = [];
  for (const raw of text.replace(/\r/g, '').split('\n')) {
    const line = raw.trimEnd();
    const last = out[out.length - 1];
    const bullet = /^\s*[-*•]\s+(.*)$/.exec(line);
    const num = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    const head = /^#{1,4}\s+(.*)$/.exec(line);
    if (!line.trim()) {
      out.push({ kind: 'p', lines: [] });
    } else if (bullet) {
      if (last?.kind === 'ul') last.items.push(bullet[1]!);
      else out.push({ kind: 'ul', items: [bullet[1]!] });
    } else if (num) {
      if (last?.kind === 'ol') last.items.push(num[1]!);
      else out.push({ kind: 'ol', items: [num[1]!] });
    } else if (head) {
      out.push({ kind: 'h', text: head[1]! });
    } else if (last?.kind === 'p') last.lines.push(line);
    else out.push({ kind: 'p', lines: [line] });
  }
  return out.filter((b) => !(b.kind === 'p' && b.lines.length === 0));
};

/** **bold**, *italic* or _italic_, `code`; only closed pairs count. */
const INLINE = /(\*\*[^*\n]+?\*\*|`[^`\n]+?`|\*[^*\s][^*\n]*?\*|_[^_\s][^_\n]*?_)/g;
export const inline = (s: string): React.ReactNode[] =>
  s.split(INLINE).map((part, i) => {
    if (i % 2 === 0) return <Fragment key={i}>{part}</Fragment>;
    if (part.startsWith('**')) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith('`')) return <code key={i}>{part.slice(1, -1)}</code>;
    return <em key={i}>{part.slice(1, -1)}</em>;
  });

export const Rich = memo(function Rich({ text, after }: { text: string; after?: React.ReactNode }) {
  const blocks = blocksOf(text);
  return (
    <div className="as-rich">
      {blocks.map((b, i) => {
        const tail = i === blocks.length - 1 ? after : null;
        if (b.kind === 'h') {
          return (
            <p key={i} className="as-rich-h">
              {inline(b.text)}
              {tail}
            </p>
          );
        }
        if (b.kind === 'p') {
          return (
            <p key={i}>
              {b.lines.map((l, j) => (
                <Fragment key={j}>
                  {j ? <br /> : null}
                  {inline(l)}
                </Fragment>
              ))}
              {tail}
            </p>
          );
        }
        const List = b.kind;
        return (
          <List key={i}>
            {b.items.map((it, j) => (
              <li key={j}>
                {inline(it)}
                {j === b.items.length - 1 ? tail : null}
              </li>
            ))}
          </List>
        );
      })}
      {blocks.length === 0 ? after : null}
    </div>
  );
});
