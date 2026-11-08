import { describe, expect, it } from 'vitest';
import { visibleReply } from './assistant.js';

describe('the words of a reply as they stream', () => {
  it('holds back the suggested-replies line, whole or half-written', () => {
    expect(visibleReply('Moved it to Saturday.\n<replies>["Undo that"]</replies>')).toBe('Moved it to Saturday.');
    expect(visibleReply('Moved it to Saturday.\n<repl')).toBe('Moved it to Saturday.');
    expect(visibleReply('Moved it to Saturday.\n<')).toBe('Moved it to Saturday.');
  });
  it('leaves a real angle bracket alone', () => {
    expect(visibleReply('Keep it < 8 miles')).toBe('Keep it < 8 miles');
    expect(visibleReply('Plain words')).toBe('Plain words');
  });
});
