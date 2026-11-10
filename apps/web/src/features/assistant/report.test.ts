import { describe, expect, it, vi } from 'vitest';
import { reportMail } from './Report';

vi.mock('@/lib/siteLinks', () => ({ SUPPORT_EMAIL: 'help@example.com' }));

describe('the report mail', () => {
  it('goes to the support address with the reason, the note and the answer as words', () => {
    const url = reportMail('Wrong', 'It moved the wrong run', 'Move **Tempo 6** to _Friday_');
    expect(url.startsWith('mailto:help@example.com?')).toBe(true);
    const q = new URLSearchParams(url.slice(url.indexOf('?') + 1));
    expect(q.get('subject')).toBe('Assistant answer: Wrong');
    expect(q.get('body')).toBe('What was wrong: Wrong\n\nNote: It moved the wrong run\n\nThe answer:\nMove Tempo 6 to Friday');
  });
  it('keeps a long answer short enough for a mail link', () => {
    const body = new URLSearchParams(reportMail('Other', '', 'x '.repeat(3000)).split('?')[1]).get('body')!;
    expect(body.length).toBeLessThan(1600);
  });
});
