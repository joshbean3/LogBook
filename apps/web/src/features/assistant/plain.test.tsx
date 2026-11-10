import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { plainOf } from './plain';
import { Rich } from './Rich';

describe('underscores', () => {
  const html = (t: string) => renderToStaticMarkup(<Rich text={t} />);
  it('keep their place inside snake_case, file names, ids and URLs', () => {
    for (const t of ['half_marathon_plan_v2.pdf', 'the id p_abc_123', 'ANTHROPIC_API_KEY', 'see https://example.com/a_b_c/d_e', 'file_name.ts and other_file.ts']) {
      expect(html(t)).not.toContain('<em>');
      expect(html(t)).toContain(t.replace(/&/g, '&amp;'));
      expect(plainOf(t)).toBe(t);
    }
  });
  it('still make a word of its own italic', () => {
    expect(html('Run _easy_ today')).toContain('<em>easy</em>');
    expect(html('(_two words_), then')).toContain('<em>two words</em>');
    expect(html('_x_')).toContain('<em>x</em>');
    expect(plainOf('Run _easy_ today, *very* easy')).toBe('Run easy today, very easy');
  });
  it('plain words drop table bars and the rule under the header', () => {
    expect(plainOf('| Day | Run |\n|---|---|\n| Wed | Tempo |')).toBe('Day  Run\nWed  Tempo');
  });
});
