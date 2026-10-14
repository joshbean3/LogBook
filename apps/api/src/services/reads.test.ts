import http from 'node:http';
import zlib from 'node:zlib';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { cleanPick, decodeEntities, extractMeta, fetchPage, isPrivateAddress, normalizeUrl, readPage, sameResource, tasteProfile } from './reads.js';

describe('normalizeUrl', () => {
  it('adds https, drops fragments and tracking parameters', () => {
    expect(normalizeUrl('example.com/a?utm_source=x&id=2#top')).toBe('https://example.com/a?id=2');
    expect(normalizeUrl('  HTTP://Example.com/Path/ ')).toBe('http://example.com/Path/');
  });
  it('refuses anything that is not a web link', () => {
    expect(() => normalizeUrl('mailto:a@b.c')).toThrow();
    expect(() => normalizeUrl('javascript:alert(1)')).toThrow();
    expect(() => normalizeUrl('notalink')).toThrow();
    for (const u of ['http://[::ffff:7f00:1]:8804/x', 'http://[64:ff9b::7f00:1]/x', 'http://[2002:7f00:1::]/x', 'http://169.254.169.254/latest', 'http://127.1/']) expect(() => normalizeUrl(u), u).toThrow(expect.objectContaining({ code: 'private_host' }));
    expect(normalizeUrl('http://[2606:4700::1111]/x')).toBe('http://[2606:4700::1111]/x');
  });
});

describe('sameResource', () => {
  it('ignores www, scheme, trailing slash and query', () => {
    expect(sameResource('https://www.a.com/x/', 'http://a.com/x?y=1')).toBe(true);
    expect(sameResource('https://a.com/x', 'https://a.com/y')).toBe(false);
  });
});

describe('isPrivateAddress', () => {
  it('knows the private ranges', () => {
    for (const ip of ['127.0.0.1', '10.1.2.3', '172.16.0.1', '172.31.255.255', '192.168.1.1', '169.254.169.254', '0.0.0.0', '100.64.0.1', '::1', '::', 'fc00::1', 'fd12::1', 'fe80::1', '::ffff:10.0.0.1', '224.0.0.1']) expect(isPrivateAddress(ip), ip).toBe(true);
    for (const ip of ['8.8.8.8', '172.32.0.1', '93.184.216.34', '2606:4700::1111', '::ffff:8.8.8.8', '::ffff:808:808', '64:ff9b::808:808', '2002:808:808::']) expect(isPrivateAddress(ip), ip).toBe(false);
  });
  it('sees a private v4 carried inside a v6 address in any spelling', () => {
    for (const ip of ['::ffff:7f00:1', '0:0:0:0:0:ffff:a00:1', '::FFFF:C0A8:101', '64:ff9b::7f00:1', '2002:7f00:1::', '::7f00:1', '::ffff:7f00:1%eth0', '[::ffff:7f00:1]']) expect(isPrivateAddress(ip), ip).toBe(true);
    expect(isPrivateAddress('not:an:address')).toBe(true);
  });
});

describe('decodeEntities', () => {
  it('handles named, decimal and hex entities', () => {
    expect(decodeEntities('A &amp; B &#39;c&#x27; &mdash; &rsquo;d&rsquo; &unknown;')).toBe("A & B 'c' — ’d’ &unknown;");
  });
});

const FIXTURE = `<!doctype html><html><head>
<meta charset="utf-8">
<title>Fallback &amp; title | Site</title>
<meta property="og:title" content="The real title &mdash; with a dash" />
<meta name="description" content="Plain description">
<meta property="og:description" content="OG   description
across lines">
<meta property="og:image" content="/img/cover.jpg">
<meta property="og:site_name" content="Example Journal">
</head><body><h1>Hello</h1></body></html>`;

describe('extractMeta', () => {
  it('prefers Open Graph, decodes entities and resolves the image', () => {
    const m = extractMeta(FIXTURE, 'https://www.example.com/posts/1');
    expect(m).toEqual({ title: 'The real title — with a dash', siteName: 'Example Journal', description: 'OG description across lines', imageUrl: 'https://www.example.com/img/cover.jpg' });
  });
  it('falls back to the title tag and the hostname', () => {
    const m = extractMeta('<html><head><title> Only &lt;a&gt; title </title></head></html>', 'https://news.example.org/x');
    expect(m).toEqual({ title: 'Only <a> title', siteName: 'news.example.org', description: null, imageUrl: null });
  });
  it('names the page after its address when there is no title at all', () => {
    const m = extractMeta('<html></html>', 'https://www.example.com/long/path');
    expect(m.title).toBe('example.com · path');
    expect(m.siteName).toBe('example.com');
  });
  it('ignores non-web images', () => {
    expect(extractMeta('<meta property="og:image" content="data:image/png;base64,xx">', 'https://a.com/').imageUrl).toBeNull();
  });
});

describe('fetchPage against a local server', () => {
  let server: http.Server;
  let base = '';
  beforeAll(async () => {
    server = http.createServer((req, res) => {
      const u = new URL(req.url ?? '/', 'http://x');
      if (u.pathname === '/page') return res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(FIXTURE);
      if (u.pathname === '/redirect') return res.writeHead(302, { location: '/page' }).end();
      if (u.pathname === '/loop') return res.writeHead(302, { location: '/loop' }).end();
      if (u.pathname === '/json') return res.writeHead(200, { 'content-type': 'application/json' }).end('{}');
      if (u.pathname === '/gzip') return res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'content-encoding': 'gzip' }).end(zlib.gzipSync(FIXTURE));
      if (u.pathname === '/gzip-big') {
        res.writeHead(200, { 'content-type': 'text/html', 'content-encoding': 'gzip' });
        return res.end(zlib.gzipSync('<html><head><title>Big gz</title></head><body>' + 'y'.repeat(600 * 1024) + '</body></html>'));
      }
      if (u.pathname === '/big') {
        res.writeHead(200, { 'content-type': 'text/html' });
        res.write('<html><head><title>Big</title></head><body>');
        const chunk = 'x'.repeat(64 * 1024);
        for (let i = 0; i < 40; i++) res.write(chunk);
        return res.end('</body></html>');
      }
      if (u.pathname === '/slow') return void setTimeout(() => res.writeHead(200, { 'content-type': 'text/html' }).end('<title>late</title>'), 2000);
      if (u.pathname === '/private') return res.writeHead(302, { location: 'http://10.0.0.1:1/' }).end();
      if (u.pathname === '/private6') return res.writeHead(302, { location: `http://[::ffff:7f00:1]:${(server.address() as { port: number }).port}/page` }).end();
      res.writeHead(404).end();
    });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  });
  afterAll(() => new Promise<void>((r) => server.close(() => r())));

  it('reads a page and follows a redirect', async () => {
    const r = await fetchPage(`${base}/redirect`, { allowPrivate: true });
    expect(r.finalUrl).toBe(`${base}/page`);
    expect(extractMeta(r.html, r.finalUrl).title).toBe('The real title — with a dash');
  });
  it('refuses private hosts unless told otherwise', async () => {
    await expect(fetchPage(`${base}/page`)).rejects.toMatchObject({ code: 'private_host' });
    const port = (server.address() as { port: number }).port;
    await expect(fetchPage(`http://[::ffff:7f00:1]:${port}/page`)).rejects.toMatchObject({ code: 'private_host' });
    // a name that resolves to loopback is refused by the resolver the socket uses, not only by a literal check
    await expect(fetchPage(`http://localtest.me:${port}/page`)).rejects.toMatchObject({ code: expect.stringMatching(/private_host|unknown_host/) });
  });
  it('refuses a redirect that lands on a private address, in v4 or mapped-v6 spelling', async () => {
    // only the test server's own address is let through; the hop it redirects to is still checked
    await expect(fetchPage(`${base}/page`, { allowPrivate: ['127.0.0.1'] })).resolves.toMatchObject({ finalUrl: `${base}/page` });
    await expect(fetchPage(`${base}/private`, { allowPrivate: ['127.0.0.1'] })).rejects.toMatchObject({ code: 'private_host' });
    await expect(fetchPage(`${base}/private6`, { allowPrivate: ['127.0.0.1'] })).rejects.toMatchObject({ code: 'private_host' });
  });
  it('refuses a redirect loop', async () => {
    await expect(fetchPage(`${base}/loop`, { allowPrivate: true })).rejects.toMatchObject({ code: 'bad_redirect' });
  });
  it('unpacks a response the server compressed unasked, and caps the unpacked bytes', async () => {
    const r = await fetchPage(`${base}/gzip`, { allowPrivate: true });
    expect(extractMeta(r.html, r.finalUrl).title).toBe('The real title — with a dash');
    const big = await fetchPage(`${base}/gzip-big`, { allowPrivate: true, maxBytes: 100_000 });
    expect(big.html.length).toBeLessThanOrEqual(100_000);
    expect(extractMeta(big.html, big.finalUrl).title).toBe('Big gz');
  });
  it('refuses non-HTML', async () => {
    await expect(fetchPage(`${base}/json`, { allowPrivate: true })).rejects.toMatchObject({ code: 'not_html' });
  });
  it('caps the body at the byte limit', async () => {
    const r = await fetchPage(`${base}/big`, { allowPrivate: true, maxBytes: 100_000 });
    expect(r.html.length).toBeLessThanOrEqual(100_000);
    expect(extractMeta(r.html, r.finalUrl).title).toBe('Big');
  });
  it('gives up after the timeout', async () => {
    await expect(fetchPage(`${base}/slow`, { allowPrivate: true, timeoutMs: 300 })).rejects.toMatchObject({ code: 'timeout' });
  });
  it('readPage never throws: an unreadable page is named after its address', async () => {
    const r = await readPage(`${base}/missing`, { allowPrivate: true });
    expect(r.fetched).toBe(false);
    expect(r.meta.title).toBe(`127.0.0.1 · missing`);
  });
});

const link = (p: Partial<import('@logbook/shared').Link>): import('@logbook/shared').Link => ({ id: 'l1', url: 'https://a.com/x', title: 'T', siteName: 'a.com', description: null, imageUrl: null, note: null, tags: [], addedAt: '2026-10-01T00:00:00Z', readAt: null, source: 'me', pickReason: null, pickDate: null, verdict: null, ...p });

describe('tasteProfile', () => {
  it('splits finished from waiting, lists skipped picks and known URLs', () => {
    const t = tasteProfile({
      today: '2026-10-13',
      saved: [link({ title: 'Base building', tags: ['running'], note: 'Loved the pacing table', readAt: '2026-10-02T00:00:00Z' }), link({ id: 'l2', url: 'https://b.com/y', siteName: 'b.com', title: 'Sleep and HRV' })],
      dismissed: [link({ id: 'l3', url: 'https://c.com/z', siteName: 'c.com', title: 'Crypto for runners', source: 'pick', verdict: 'dismissed', pickReason: 'Because' })],
      known: ['https://a.com/x', 'https://b.com/y', 'https://c.com/z'],
    });
    expect(t).toContain('Finished:\n- “Base building” — a.com [running] — note: “Loved the pacing table” (read)');
    expect(t).toContain('Waiting:\n- “Sleep and HRV” — b.com (unread)');
    expect(t).toContain('PICKS THEY SKIPPED');
    expect(t).toContain('“Crypto for runners” — c.com (offered because: Because)');
    expect(t).toContain('- https://c.com/z');
  });
});

describe('cleanPick', () => {
  it('normalizes and refuses a known piece', () => {
    expect(cleanPick({ url: 'www.new.com/post?utm_source=x', title: ' A  title ', why: 'Because you read X!', tags: ['Running', 'running', 'Z'] }, ['https://a.com/x'])).toEqual({ url: 'https://www.new.com/post', title: 'A title', why: 'Because you read X.', tags: ['running', 'z'] });
    expect(() => cleanPick({ url: 'https://a.com/x/', title: 'T', why: '', tags: [] }, ['https://www.a.com/x'])).toThrow();
  });
});
