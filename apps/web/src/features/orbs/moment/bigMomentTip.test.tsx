import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MomentPage } from '@/features/goals/Celebrate';
import { TIP_WAITS_FOR } from '@/features/tips/useTabTip';

/**
 * A first-visit tip never rises under a full-screen moment. On a second phone every tip is unseen and the account's
 * big moments are waiting: the tip's sheet rose half a second after the moment, under it, and took the focus from
 * "Keep going". The tip's wait and the moment's page meet in one class name; this holds the two together.
 */
describe('a tip and a full-screen moment', () => {
  it('the tip waits for what the moment page is', () => {
    const html = renderToStaticMarkup(<MomentPage label="4 weeks in a row" disc="4" title="4 weeks in a row" line="One thing a day. Two days off a week." onClose={() => undefined} />);
    const cls = /^<div class="([^"]+)"/.exec(html)?.[1]?.split(' ') ?? [];
    const waits = TIP_WAITS_FOR.split(',').map((s) => s.trim().replace(/^\./, ''));
    expect(cls.some((c) => waits.includes(c))).toBe(true);
  });
  it('the moment is a modal dialog with its name, a heading and one button', () => {
    const html = renderToStaticMarkup(<MomentPage label="Goal done" title="Goal done" line="A whole week, done." quote="Run three times" onClose={() => undefined} />);
    expect(html).toMatch(/role="dialog"/);
    expect(html).toMatch(/aria-modal="true"/);
    expect(html).toMatch(/aria-label="Goal done"/);
    expect(html.split('<h2').length - 1).toBe(1);
    expect(html.split('<button').length - 1).toBe(1);
    expect(html).toContain('Keep going');
    // the title is read before the button
    expect(html.indexOf('<h2')).toBeLessThan(html.indexOf('<button'));
  });
});
