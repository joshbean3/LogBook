import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

// the now dot asks the page whether it is on screen: outside the app there is no page
vi.mock('@/ui/nowBudget', () => ({ useNowMark: () => 'now', usePageShown: () => true }));
const { RangeBars } = await import('./RangeBars');
const { rangeSpan } = await import('./ranges');

const T = '2026-11-11';
const span = rangeSpan('3M', T);
const marks = span.buckets.map((b, i) => ({ key: b.key, value: i < 4 ? 0 : i === 12 ? 9.3 : 10 + i, ahead: i === 12 ? 14 : 0, current: b.current, future: b.future, missing: false }));
const draw = (over: Partial<Parameters<typeof RangeBars>[0]> = {}) =>
  renderToStaticMarkup(<RangeBars span={span} marks={marks} label="Weekly miles, 3 months." words={(i) => `bucket ${i}`} onScrub={() => undefined} {...over} />);

describe('the hero chart, to a screen reader and the keyboard', () => {
  it('is one slider whose value is the bucket holding today, in words', () => {
    const html = draw();
    expect(html.match(/role="slider"/g)).toHaveLength(1);
    expect(html).toContain('tabindex="0"');
    expect(html).toContain('aria-orientation="horizontal"');
    expect(html).toContain('aria-valuenow="12"');
    expect(html).toContain('aria-valuetext="bucket 12"');
    // the buckets before the log began cannot be reached
    expect(html).toContain('aria-valuemin="4"');
    expect(html).toContain('aria-valuemax="12"');
    expect(html).toContain('aria-label="Weekly miles, 3 months."');
    // no list of buttons beside it: the slider is the one element
    expect(html).not.toContain('<button');
    expect(html).not.toContain('<li');
  });

  it('says how to open a bucket only when a bucket opens', () => {
    expect(draw()).not.toContain('to open');
    expect(draw({ onOpen: () => undefined })).toContain('aria-label="Weekly miles, 3 months. Double tap or press Enter to open."');
  });

  it('shows the first-use hint only while it is asked to', () => {
    expect(draw()).not.toContain('rb-hint');
    // it is for the eye and the finger: the slider itself tells VoiceOver how it is moved
    expect(draw({ hint: 'Drag across to see each week' })).toContain('<p class="rb-hint" aria-hidden="true">Drag across to see each week</p>');
    // once read its words fade and its room stays (the class), so nothing moves under the finger
    expect(draw({ hint: 'Drag across to see each week', hintRead: true })).toContain('<p class="rb-hint is-read" aria-hidden="true">');
  });

  it('draws nothing it cannot measure, and never a NaN', () => {
    // before the plot has a width there is only its box, as tall as it will draw
    for (const html of [draw(), draw({ marks: marks.map((m) => ({ ...m, value: 0, ahead: 0 })) }), draw({ span: { ...span, buckets: [] }, marks: [] })]) {
      expect(html).not.toContain('NaN');
      expect(html).not.toContain('Infinity');
    }
    // an empty range is still a slider that says nothing false
    expect(draw({ span: { ...span, buckets: [] }, marks: [] })).not.toContain('aria-valuetext');
  });
});
