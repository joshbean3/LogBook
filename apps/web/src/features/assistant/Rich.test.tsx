import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { blocksOf, Rich } from './Rich';

describe('an answer’s formatting', () => {
  it('splits paragraphs, lists and a heading', () => {
    expect(blocksOf('One line\nand the next\n\n- a\n- b\n\n1. first\n2. second\n### Next week')).toEqual([
      { kind: 'p', lines: ['One line', 'and the next'] },
      { kind: 'ul', items: ['a', 'b'] },
      { kind: 'ol', items: ['first', 'second'] },
      { kind: 'h', text: 'Next week' },
    ]);
  });
  it('renders bold, italic and code, and never markup from the text', () => {
    const html = renderToStaticMarkup(<Rich text={'Run **easy**, *very* easy: `Z2`. <b>no</b>'} />);
    expect(html).toContain('<strong>easy</strong>');
    expect(html).toContain('<em>very</em>');
    expect(html).toContain('<code>Z2</code>');
    expect(html).toContain('&lt;b&gt;no&lt;/b&gt;');
  });
  it('shows half-written formatting as plain words', () => {
    expect(renderToStaticMarkup(<Rich text="Run **eas" />)).toContain('Run **eas');
  });
  it('reads a table, skipping the line under its header, and a fenced code block', () => {
    expect(blocksOf('| Day | Run |\n|---|---|\n| Wed | Tempo 6 |\n| Sat | Long 10 |\n\n```\nA: 1\n```\nAfter')).toEqual([
      { kind: 'table', rows: [['Day', 'Run'], ['Wed', 'Tempo 6'], ['Sat', 'Long 10']] },
      { kind: 'code', text: 'A: 1', open: false },
      { kind: 'p', lines: ['After'] },
    ]);
    const html = renderToStaticMarkup(<Rich text={'| Day | Run |\n|---|---|\n| Wed | **Tempo** |'} />);
    expect(html).toContain('<th>Day</th>');
    expect(html).toContain('<td><strong>Tempo</strong></td>');
  });
  it('fading, gives each word its own span so only new words animate', () => {
    const html = renderToStaticMarkup(<Rich text="Two runs **left**" fade />);
    expect(html.match(/class="as-w"/g)).toHaveLength(3);
    expect(html).toContain('<strong><span class="as-w">left</span></strong>');
  });
});
