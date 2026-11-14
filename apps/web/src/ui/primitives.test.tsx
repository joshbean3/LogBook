import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { DateGutter, NoData, SectionEmpty, StatTile, StatusPill, sparkPath } from './primitives';

describe('DateGutter', () => {
  it('shows the day numeral and the weekday in sentence case', () => {
    const html = renderToStaticMarkup(<DateGutter date="2026-11-11" />);
    expect(html).toContain('>11<');
    expect(html).toContain('>Wed<');
    expect(html).not.toContain('is-today');
  });
  it('rings today', () => {
    expect(renderToStaticMarkup(<DateGutter date="2026-11-09" today />)).toContain('date-gutter is-today');
  });
});

describe('StatTile', () => {
  it('reads as one line and draws no sparkline under 7 points', () => {
    const html = renderToStaticMarkup(<StatTile label="Resting heart rate" value="52" unit="bpm" context="30 days" spark={[1, 2, 3]} />);
    expect(html).toContain('aria-label="Resting heart rate 52 beats per minute, 30 days"');
    expect(html).not.toContain('tile-spark');
  });
  it('draws the sparkline from 7 points', () => {
    expect(renderToStaticMarkup(<StatTile label="Miles" value="12" spark={[1, 2, 3, 4, 5, 6, 7]} />)).toContain('tile-spark');
  });
  it('is a button with a chevron when it opens something', () => {
    const html = renderToStaticMarkup(<StatTile label="Miles" value="12" onPress={() => {}} />);
    expect(html.startsWith('<button')).toBe(true);
    expect(html).toContain('tile-chev');
  });
});

describe('sparkPath', () => {
  it('fills the box from min to max', () => {
    expect(sparkPath([0, 10])).toBe('M0.00 30.00 L100.00 2.00');
  });
  it('holds a flat series in the box', () => {
    expect(sparkPath([5, 5, 5])).toBe('M0.00 30.00 L50.00 30.00 L100.00 30.00');
  });
});

describe('SectionEmpty, NoData, StatusPill', () => {
  it('renders one 64 row in a group', () => {
    const html = renderToStaticMarkup(<SectionEmpty icon={<i />} title="No trends yet" line="Your first week shows here." />);
    expect(html).toMatch(/^<div class="group"><div class="lrow two section-empty">/);
  });
  it('says no data in a word', () => {
    expect(renderToStaticMarkup(<NoData />)).toBe('<span class="no-data">None yet</span>');
  });
  it('gives the pill its whole state to VoiceOver', () => {
    const html = renderToStaticMarkup(<StatusPill label="Week 3 of 12" voiceLabel="Half marathon, week 3 of 12. Open Fitness" chevron="right" onPress={() => {}} />);
    expect(html).toContain('aria-label="Half marathon, week 3 of 12. Open Fitness"');
    expect(html).toContain('status-pill-label');
    expect(html).not.toContain('aria-pressed');
  });
  it('a pill with a glyph leads with it, hidden from VoiceOver, and one that stays on says whether it is', () => {
    const html = renderToStaticMarkup(<StatusPill glyph={<i />} label="Tilt" voiceLabel="Tilt. Gravity follows the phone" pressed={false} onPress={() => {}} />);
    expect(html).toMatch(/aria-pressed="false"[^>]*><span class="status-pill-glyph" aria-hidden="true"><i><\/i><\/span><span class="status-pill-label">Tilt<\/span><\/button>$/);
    expect(renderToStaticMarkup(<StatusPill glyph={<i />} label="Float" pressed onPress={() => {}} />)).toContain('aria-pressed="true"');
  });
});
