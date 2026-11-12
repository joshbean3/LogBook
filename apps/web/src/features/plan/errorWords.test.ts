import { describe, expect, it } from 'vitest';
import { ApiError, NetworkError } from '@/api/client';
import { errorWords } from './errorWords';

/**
 * A write that fails says one plain line. The server's own words are shown only where it wrote them for a person (a 4xx
 * it answered with a code: "That plan is too long"). A route that is not there, a server error or a proxy's page used to
 * be shown as they came: "Not found", "Bad Gateway", "boom".
 */
describe('errorWords: what a failed write says', () => {
  const plain = 'Couldn’t save the plan. Try again.';
  it('says the server’s line when it wrote one for the person', () => {
    expect(errorWords(new ApiError('That plan is longer than a year. Make it shorter.', 422, 'bad_template'), plain)).toBe('That plan is longer than a year. Make it shorter.');
    expect(errorWords(new ApiError('That session could not be saved. Try again.', 409, 'id_taken'), plain)).toBe('That session could not be saved. Try again.');
    expect(errorWords(new ApiError('Too many requests. Try again in a minute.', 429, 'rate_limited'), plain)).toBe('Too many requests. Try again in a minute.');
  });
  it('says the plain line for a route that is not there, a server error, a proxy, a timeout and no connection', () => {
    expect(errorWords(new ApiError('Not found', 404, 'not_found'), plain)).toBe(plain);
    expect(errorWords(new ApiError('Method Not Allowed', 405), plain)).toBe(plain);
    expect(errorWords(new ApiError('boom', 500), plain)).toBe(plain);
    expect(errorWords(new ApiError('Something went wrong on the server.', 500, 'internal'), plain)).toBe(plain);
    expect(errorWords(new ApiError('Bad Gateway', 502), plain)).toBe(plain);
    expect(errorWords(new ApiError('Request failed', 400), plain)).toBe(plain);
    expect(errorWords(new NetworkError(), plain)).toBe(plain);
    expect(errorWords(new TypeError('x is not a function'), plain)).toBe(plain);
    expect(errorWords(undefined, plain)).toBe(plain);
  });
  it('never shows an empty line', () => {
    expect(errorWords(new ApiError('', 422, 'validation'), plain)).toBe(plain);
    expect(errorWords(new ApiError('   ', 422, 'validation'), plain)).toBe(plain);
  });
});
