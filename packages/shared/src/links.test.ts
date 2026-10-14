import { describe, expect, it } from 'vitest';
import { isAddressTitle, linkTitle, linkTitleFromUrl } from './links.js';

describe('a saved link with no title', () => {
  it('is the domain and the path\'s last readable segment, never the raw address', () => {
    expect(linkTitleFromUrl('https://www.nytimes.com/2026/10/12/well/the-quiet-mile.html')).toBe('nytimes.com · the-quiet-mile');
    expect(linkTitleFromUrl('https://longreads.com/2026/10/the-quiet-mile/')).toBe('longreads.com · the-quiet-mile');
    expect(linkTitleFromUrl('https://medium.com/@x/why-easy-runs-feel-slow-3f9a1c2b7d4e')).toBe('medium.com · why-easy-runs-feel-slow-3f9a1c2b7d4e');
    expect(linkTitleFromUrl('https://example.com/article/12345')).toBe('example.com');
    expect(linkTitleFromUrl('https://example.com/')).toBe('example.com');
    expect(linkTitleFromUrl('runnersworld.com/training/The%20Long%20Run')).toBe('runnersworld.com · the-long-run');
  });
  it('recognises a title that is only the address, and keeps a real one', () => {
    expect(isAddressTitle('example.com/long/path', 'https://www.example.com/long/path')).toBe(true);
    expect(isAddressTitle('https://example.com/x', 'https://example.com/x')).toBe(true);
    expect(isAddressTitle('longreads.com · the-quiet-mile', 'https://longreads.com/2026/10/the-quiet-mile/')).toBe(true);
    expect(linkTitle('example.com/long/path', 'https://www.example.com/long/path')).toBe('example.com · path');
    expect(linkTitle('The quiet mile', 'https://longreads.com/the-quiet-mile')).toBe('The quiet mile');
    expect(linkTitle(null, 'https://longreads.com/the-quiet-mile')).toBe('longreads.com · the-quiet-mile');
  });
});
