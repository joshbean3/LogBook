import type * as React from 'react';
import { Fragment, memo } from 'react';
import { STAR_ITALIC, UNDERSCORE_ITALIC } from './plain';

/**
 * An answer's words with the formatting chat answers use: paragraphs, **bold**, *italic*, `code`, bulleted and numbered
 * lists, a short "### heading" line, a table (| a | b |) and a fenced code block. Built as React elements from the text
 * (never as HTML), so nothing in an answer can inject markup; anything else shows as written. Safe on half-written text:
 * an unclosed ** shows as plain words, an unclosed fence or table shows what has arrived.
 *
 * `fade`: while an answer is written, each new word fades in as it arrives (the ChatGPT and Claude feel). Words are spans
 * keyed by their place, so a word already shown is never redrawn and only the new ones animate.
 */
type Block =
  | { kind: 'p'; lines: string[] }
  | { kind: 'ul' | 'ol'; items: string[] }
  | { kind: 'h'; text: string }
  | { kind: 'table'; rows: string[][] }
  | { kind: 'code'; text: string; open: boolean };

const cells = (line: string) =>
  line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim());

export const blocksOf = (text: string): Block[] => {
  const out: Block[] = [];
  for (const raw of text.replace(/\r/g, '').split('\n')) {
    const line = raw.trimEnd();
    const last = out[out.length - 1];
    if (last?.kind === 'code' && last.open) {
      if (/^\s*```/.test(line)) last.open = false;
      else last.text += (last.text ? '\n' : '') + raw;
      continue;
    }
    if (/^\s*```/.test(line)) {
      out.push({ kind: 'code', text: '', open: true });
      continue;
    }
    const bullet = /^\s*[-*•]\s+(.*)$/.exec(line);
    const num = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    const head = /^#{1,4}\s+(.*)$/.exec(line);
    const row = /^\s*\|.*\|?\s*$/.test(line) && line.includes('|', line.indexOf('|') + 1);
    if (!line.trim()) {
      out.push({ kind: 'p', lines: [] });
    } else if (row) {
      // the |---|---| line under the header only marks it
      if (/^\s*\|?[\s:|-]+\|?\s*$/.test(line) && line.includes('-')) continue;
      if (last?.kind === 'table') last.rows.push(cells(line));
      else out.push({ kind: 'table', rows: [cells(line)] });
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

/** Plain words, or (fading) one span per word with its following space, keyed by place. */
const words = (s: string, fade: boolean, key: string): React.ReactNode => {
  if (!fade) return s;
  return s.split(/(?<=\s)/).filter(Boolean).map((w, i) => (
    <span key={`${key}.${i}`} className="as-w">
      {w}
    </span>
  ));
};

/** **bold**, *italic* or _italic_ (a word of its own, never inside snake_case), `code`; only closed pairs count. */
const INLINE = new RegExp(`(\\*\\*[^*\\n]+?\\*\\*|\`[^\`\\n]+?\`|${STAR_ITALIC.source}|${UNDERSCORE_ITALIC.source})`, 'g');
export const inline = (s: string, fade = false, key = ''): React.ReactNode[] =>
  s.split(INLINE).map((part, i) => {
    const k = `${key}-${i}`;
    if (i % 2 === 0) return <Fragment key={k}>{words(part, fade, k)}</Fragment>;
    if (part.startsWith('**')) return <strong key={k}>{words(part.slice(2, -2), fade, k)}</strong>;
    if (part.startsWith('`')) return <code key={k}>{part.slice(1, -1)}</code>;
    return <em key={k}>{words(part.slice(1, -1), fade, k)}</em>;
  });

export const Rich = memo(function Rich({ text, after, fade = false }: { text: string; after?: React.ReactNode; fade?: boolean }) {
  const blocks = blocksOf(text);
  return (
    <div className={`as-rich${fade ? ' is-fading' : ''}`}>
      {blocks.map((b, i) => {
        const tail = i === blocks.length - 1 ? after : null;
        const k = String(i);
        if (b.kind === 'h') {
          return (
            <p key={i} className="as-rich-h">
              {inline(b.text, fade, k)}
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
                  {inline(l, fade, `${k}.${j}`)}
                </Fragment>
              ))}
              {tail}
            </p>
          );
        }
        if (b.kind === 'code') {
          return (
            <Fragment key={i}>
              <pre className="as-rich-code">
                <code>{b.text}</code>
              </pre>
              {tail}
            </Fragment>
          );
        }
        if (b.kind === 'table') {
          const [head, ...body] = b.rows;
          const width = Math.max(...b.rows.map((r) => r.length));
          return (
            <Fragment key={i}>
              <div className="as-rich-table" role="region" aria-label="Table" tabIndex={0}>
                <table>
                  <thead>
                    <tr>
                      {Array.from({ length: width }, (_, c) => (
                        <th key={c}>{inline(head![c] ?? '')}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {body.map((r, ri) => (
                      <tr key={ri}>
                        {Array.from({ length: width }, (_, c) => (
                          <td key={c}>{inline(r[c] ?? '')}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {tail}
            </Fragment>
          );
        }
        const List = b.kind;
        return (
          <List key={i}>
            {b.items.map((it, j) => (
              <li key={j}>
                {inline(it, fade, `${k}.${j}`)}
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
