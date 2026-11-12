import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { PathLine, PathStop } from '@/ui/poster';
import { focusAfterMove, STOP_ROW } from './moveFocus';

// Pressable reads the app's context menu and navigation (mounted in main.tsx): a plain button stands in, with its class
vi.mock('@/ui/Pressable', () => ({
  Pressable: ({ children, className = '', label, press, onPress, ...rest }: { children?: ReactNode; className?: string; label?: string; press?: string; onPress?: () => void } & Record<string, unknown>) => (
    <button type="button" className={`pressable ${className}`} data-press={press} aria-label={label} {...rest}>
      {children}
    </button>
  ),
}));

/**
 * After a move (or an add) the sheet closes and focus goes to the session's row on the page. The lookup named the old
 * week rows (`[data-session-id] .pl-line`, `[data-plan-day]`), which nothing draws since the week became a line of stops,
 * so focus always fell back to the pager. These pin the lookup to what the line of days draws.
 */
describe('the row a moved session is found by', () => {
  it('is the stop the line of days draws for it', () => {
    const html = renderToStaticMarkup(
      <PathLine label="The days ahead">
        <PathStop id="s-1" node="dot" state="ahead" title="Easy 4" chevron onPress={() => undefined} />
      </PathLine>,
    );
    // `[data-stop="…"] .pth-main`: the stop carries the session's id, and its row is the button inside it
    expect(STOP_ROW('s-1')).toBe('[data-stop="s-1"] .pth-main');
    expect(html).toMatch(/<li[^>]*data-stop="s-1"[^>]*>[\s\S]*<button[^>]*class="[^"]*\bpth-main\b/);
  });
  it('escapes an id that is not a plain word', () => {
    expect(STOP_ROW('a"b')).toBe('[data-stop="a\\"b"] .pth-main');
  });
});

describe('focusAfterMove: where focus goes once the sheet has let go of it', () => {
  const base = { pageMon: '2026-11-09', to: '2026-11-14', hasRow: false, hasFold: false, waited: 0 };
  it('goes to the row when it is on the page', () => {
    expect(focusAfterMove({ ...base, hasRow: true })).toBe('row');
  });
  it('waits for the row while its day is in the shown week (the write renders a frame later)', () => {
    expect(focusAfterMove(base)).toBe('wait');
    expect(focusAfterMove({ ...base, to: '2026-11-09' })).toBe('wait');
    expect(focusAfterMove({ ...base, to: '2026-11-15' })).toBe('wait');
  });
  it('gives up waiting after 600 ms: the fold that holds an earlier day, else the pager', () => {
    expect(focusAfterMove({ ...base, waited: 601, hasFold: true })).toBe('fold');
    expect(focusAfterMove({ ...base, waited: 601 })).toBe('pager');
  });
  it('goes to the pager at once when the day is in another week, or no week is shown', () => {
    expect(focusAfterMove({ ...base, to: '2026-11-16' })).toBe('pager');
    expect(focusAfterMove({ ...base, to: '2026-11-08' })).toBe('pager');
    expect(focusAfterMove({ ...base, pageMon: null })).toBe('pager');
    expect(focusAfterMove({ ...base, pageMon: '2026-11' })).toBe('pager');
  });
});
