/**
 * _italic_ only as a word of its own: the opening underscore follows the start, a space or punctuation, and the closing
 * one is followed by the end, a space or punctuation. So snake_case, file_name.ts, ids like p_abc_123 and URLs keep their
 * underscores. Shared by the answer's formatting (Rich.tsx) and its plain words (plainOf).
 */
export const UNDERSCORE_ITALIC = /(?<!\w)_[^_\s](?:[^_\n]*?[^_\s])?_(?!\w)/;
/** *italic*: a star, then a word start, then a closing star. */
export const STAR_ITALIC = /\*[^*\s][^*\n]*?\*/;

const stripUnderscores = new RegExp(`(?<!\\w)_([^_\\s](?:[^_\\n]*?[^_\\s])?)_(?!\\w)`, 'g');

/** An answer as plain words, for Copy, Share, Read aloud and the History preview: no stars, ticks or table bars. */
export const plainOf = (text: string) =>
  text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/(^|\s)\*(\S[^*\n]*?)\*/g, '$1$2')
    .replace(stripUnderscores, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^#{1,4}\s+/gm, '')
    .replace(/^[ \t]*\|?[ \t:|-]*-[ \t:|-]*\|?[ \t]*(\n|$)/gm, '')
    .replace(/^[ \t]*\|(.*)\|[ \t]*$/gm, (_, row: string) =>
      row
        .split('|')
        .map((c) => c.trim())
        .join('  '),
    )
    .replace(/\n{3,}/g, '\n\n')
    .trim();
