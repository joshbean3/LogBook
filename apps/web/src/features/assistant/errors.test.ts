import { describe, expect, it } from 'vitest';
import { ApiError, NetworkError } from '@/api/client';
import { failureText, proposalFailure } from './errors';
import { AskError } from './poll';

const RAW = /turns|expected|ANTHROPIC|Claude key|server may have restarted|Request failed/;

describe('what a failed ask says', () => {
  const cases: [unknown, RegExp][] = [
    [new ApiError('turns: Too big: expected array to have <=40 items', 413, null), /too long to send/],
    [new ApiError('turns.0.text: Too big', 422, 'validation'), /too long to send/],
    [new ApiError('Too many requests', 429, 'rate_limited'), /asked a lot in a short time/],
    [new ApiError('Sign in to continue', 401, 'unauthenticated'), /Sign in to continue/],
    [new ApiError('Internal Server Error: stack at line 4', 500, null), /went wrong on our side/],
    [new ApiError('Bad Gateway', 502, null), /went wrong on our side/],
    [new AskError('That answer is no longer here (the server may have restarted). Send it again.', 404, 'job_gone'), /went wrong on our side/],
    [new ApiError('The assistant needs ANTHROPIC_API_KEY on the server.', 503, 'claude_not_configured'), /not available right now/],
    [new AskError('This is taking longer than it should.', 504, 'too_slow'), /taking longer than it should/],
    [new NetworkError(), /Couldn’t reach Logbook/],
    [new Error('some developer text'), /went wrong on our side/],
    [null, /went wrong on our side/],
  ];
  it.each(cases)('%s', (e, want) => {
    const text = failureText(e);
    expect(text).toMatch(/^That didn’t go through\. /);
    expect(text).toMatch(want);
    expect(text).not.toMatch(RAW);
  });
  it('a proposal that failed never shows the server’s words either', () => {
    expect(proposalFailure(new ApiError('Cannot move s_1 into the past (2026-11-01). Ask again for a fresh proposal.', 409, 'stale_proposal'))).toBe('A change no longer fits your plan. Ask again for a fresh proposal.');
    expect(proposalFailure(new ApiError('skip: this proposal has 3 changes.', 422, 'validation'))).not.toMatch(/skip:/);
    expect(proposalFailure(new ApiError('Already applied.', 409, null))).toMatch(/closed/);
  });
});
