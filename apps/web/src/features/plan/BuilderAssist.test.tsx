import { createRef } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AI_LABEL } from '@/lib/copy';
import { AssistBar, VEIL_AFTER_MS, VEIL_MIN_MS, type BuilderAssistApi } from './BuilderAssist';

/** The bar draws what the assistant's state says; these pin the words and the parts each state shows. */
const noop = () => undefined;
const assist = (over: Partial<BuilderAssistApi>): BuilderAssistApi =>
  ({
    enabled: true,
    mode: 'pill',
    draft: '',
    setDraft: noop,
    busy: false,
    veil: false,
    orbAway: false,
    said: null,
    failure: null,
    asking: false,
    composing: false,
    typing: false,
    field: createRef(),
    orb: createRef(),
    gate: 'ask',
    retryConsent: noop,
    open: noop,
    onFocus: noop,
    onBlur: noop,
    send: noop,
    stop: noop,
    retry: noop,
    undo: noop,
    retire: noop,
    notNow: noop,
    veilGone: noop,
    ...over,
  }) as BuilderAssistApi;
const html = (over: Partial<BuilderAssistApi> = {}) => renderToStaticMarkup(<AssistBar assist={assist(over)} />);

describe('the builder’s assistant bar', () => {
  it('at rest is one pill: the Orb and a few words, a button, with no field and no provider line', () => {
    const h = html();
    expect(h).toContain('>Describe your plan<');
    expect(h).toContain('aria-label="Assistant. Describe your plan"');
    expect(h).toMatch(/<button[^>]*class="[^"]*pa-pill/);
    expect((h.match(/lb-orb/g) ?? []).length).toBeGreaterThan(0);
    expect(h).not.toContain('<textarea');
    expect(h).not.toContain(AI_LABEL);
  });

  it('opened is the composer: a field with an example, Send off until there are words, and the provider line exactly as written', () => {
    const h = html({ mode: 'compose' });
    expect(h).toContain('<textarea');
    expect(h).toContain('placeholder="4 runs a week, long run Sunday, race on March 14"');
    expect(h).toContain('aria-label="Describe the plan you want"');
    expect(h).toContain('maxLength="600"');
    expect(h).toMatch(/<button[^>]*aria-label="Send"[^>]*disabled/);
    expect(h).toContain(`<p class="pa-ai">${AI_LABEL}</p>`);
    expect(AI_LABEL).toBe('AI assistant, powered by Claude. It can be wrong. Check anything important.');
    const typed = html({ mode: 'compose', draft: '4 runs a week' });
    expect(typed).not.toMatch(/<button[^>]*aria-label="Send"[^>]*disabled/);
    // while a request is out, Send is off: a second tap sends nothing
    expect(html({ mode: 'compose', draft: '4 runs a week', busy: true })).toMatch(/<button[^>]*aria-label="Send"[^>]*disabled/);
  });

  it('says what changed in one status line, with Undo only when something did', () => {
    const snap = { answers: {} as never, fromRuns: { runDays: false, weeklyMiles: false }, keys: [] };
    const h = html({ said: { set: 'Set 4 run days, long run Sunday.', notes: ['Paces aren’t set here.'], undo: snap } });
    expect(h).toContain('role="status"');
    expect(h).toContain('<span class="pa-set">Set 4 run days, long run Sunday.</span>');
    expect(h).toContain('<span class="pa-notes">Paces aren’t set here.</span>');
    expect(h).toContain('>Undo<');
    const nothing = html({ said: { set: null, notes: ['This plan holds runs only.'], undo: null } });
    expect(nothing).toContain('This plan holds runs only.');
    expect(nothing).not.toContain('Undo');
    expect(nothing).not.toContain('pa-set');
  });

  it('a request that did not go through is one alert line, with Try again where it can work, and the words kept in the pill', () => {
    const h = html({ draft: 'ten weeks', failure: { line: 'Couldn’t reach Orby. Check your connection.', retry: true } });
    expect(h).toContain('role="alert"');
    expect(h).toContain('Couldn’t reach Orby. Check your connection.');
    expect(h).toContain('>Try again<');
    expect(h).toContain('<span class="pa-pill-text is-draft">ten weeks</span>');
    expect(html({ failure: { line: 'Say it another way.', retry: false } })).not.toContain('Try again');
  });

  it('hides its Orb while the Orb is over the builder, so one Orb shows', () => {
    expect(html({ orbAway: true })).toContain('class="pa is-away"');
    expect(html()).toContain('class="pa"');
  });

  it('waits 150 ms to show the veil and then holds it at least 600 ms', () => {
    expect(VEIL_AFTER_MS).toBe(150);
    expect(VEIL_MIN_MS).toBe(600);
  });
});
