import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { fmtDate, shiftDays, zReadsPickOutput, type ISODate, type Link, type ReadsPickOutput } from '@logbook/shared';
import dns from 'node:dns/promises';
import net from 'node:net';
import { env } from '../env.js';
import { ApiError } from '../lib/util.js';

// =====================================================================================
// 1. URLs and the page fetcher: what a link is, and how its title gets read off the page
// =====================================================================================

const TRACKING = /^(utm_\w+|fbclid|gclid|dclid|mc_cid|mc_eid|igshid|ref_src|_hsenc|_hsmi|yclid)$/i;

/** A pasted link into one canonical form: https when no scheme was given, no fragment, no tracking parameters. */
export const normalizeUrl = (input: string): string => {
  let s = input.trim();
  if (!s) throw new ApiError(422, 'Paste a link first.', 'bad_url');
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(s)?.[1]?.toLowerCase();
  if (scheme && scheme !== 'http' && scheme !== 'https') throw new ApiError(422, 'Only web links (http or https) can be saved.', 'bad_url');
  if (!scheme) s = `https://${s}`;
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    throw new ApiError(422, 'That doesn’t look like a link.', 'bad_url');
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new ApiError(422, 'Only web links (http or https) can be saved.', 'bad_url');
  if (!u.hostname.includes('.') && u.hostname !== 'localhost') throw new ApiError(422, 'That doesn’t look like a link.', 'bad_url');
  u.hash = '';
  for (const k of [...u.searchParams.keys()]) if (TRACKING.test(k)) u.searchParams.delete(k);
  u.hostname = u.hostname.toLowerCase();
  return u.toString();
};

/** Two URLs name the same page when host (minus www) and path agree, ignoring scheme, trailing slash and query. */
export const sameResource = (a: string, b: string): boolean => {
  const key = (s: string) => {
    try {
      const u = new URL(s);
      return `${u.hostname.replace(/^www\./, '')}${u.pathname.replace(/\/+$/, '').toLowerCase()}`;
    } catch {
      return s;
    }
  };
  return key(a) === key(b);
};

/** Loopback, link-local, private, multicast, unspecified: anything a server must never be asked to fetch. */
export const isPrivateAddress = (ip: string): boolean => {
  const kind = net.isIP(ip);
  if (kind === 4) {
    const p = ip.split('.').map(Number) as [number, number, number, number];
    if (p[0] === 0 || p[0] === 10 || p[0] === 127) return true;
    if (p[0] === 100 && p[1] >= 64 && p[1] <= 127) return true;
    if (p[0] === 169 && p[1] === 254) return true;
    if (p[0] === 172 && p[1] >= 16 && p[1] <= 31) return true;
    if (p[0] === 192 && p[1] === 168) return true;
    if (p[0] === 192 && p[1] === 0 && (p[2] === 0 || p[2] === 2)) return true;
    if (p[0] === 198 && (p[1] === 18 || p[1] === 19)) return true;
    if (p[0] === 198 && p[1] === 51 && p[2] === 100) return true;
    if (p[0] === 203 && p[1] === 0 && p[2] === 113) return true;
    if (p[0] >= 224) return true;
    return false;
  }
  if (kind === 6) {
    const v = ip.toLowerCase();
    if (v === '::' || v === '::1') return true;
    const mapped = /^(?:0*:)*:?ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(v);
    if (mapped) return isPrivateAddress(mapped[1]!);
    if (v.startsWith('fc') || v.startsWith('fd')) return true; // fc00::/7
    if (/^fe[89ab]/.test(v)) return true; // fe80::/10
    if (v.startsWith('ff')) return true; // multicast
    return false;
  }
  return true;
};

/** Resolves the host and refuses anything that lands on a private network. */
export const assertPublicHost = async (hostname: string, allowPrivate = false): Promise<void> => {
  if (allowPrivate) return;
  const h = hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal') || h.endsWith('.arpa')) throw new ApiError(422, 'That address can’t be fetched.', 'private_host');
  if (net.isIP(h)) {
    if (isPrivateAddress(h)) throw new ApiError(422, 'That address can’t be fetched.', 'private_host');
    return;
  }
  let addrs: Array<{ address: string }>;
  try {
    addrs = await dns.lookup(h, { all: true });
  } catch {
    throw new ApiError(422, 'That site couldn’t be found.', 'unknown_host');
  }
  if (!addrs.length || addrs.some((a) => isPrivateAddress(a.address))) throw new ApiError(422, 'That address can’t be fetched.', 'private_host');
};

export interface FetchOptions {
  /** Whole-request budget, redirects included. */
  timeoutMs?: number;
  /** Bytes of body read before the rest is dropped. */
  maxBytes?: number;
  maxRedirects?: number;
  /** Tests only: let the fetcher reach a server on this machine. */
  allowPrivate?: boolean;
}

/** GET a page as HTML: 10 s, 1 MB, text/html only, and every redirect hop checked against private networks. */
export const fetchPage = async (url: string, o: FetchOptions = {}): Promise<{ html: string; finalUrl: string }> => {
  const timeoutMs = o.timeoutMs ?? 10_000;
  const maxBytes = o.maxBytes ?? 1024 * 1024;
  const maxRedirects = o.maxRedirects ?? 5;
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    let cur = url;
    for (let hop = 0; hop <= maxRedirects; hop++) {
      const u = new URL(cur);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new ApiError(422, 'Only web links can be fetched.', 'bad_url');
      await assertPublicHost(u.hostname, o.allowPrivate);
      const res = await fetch(cur, {
        redirect: 'manual',
        signal: ac.signal,
        headers: { accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.1', 'accept-language': 'en-US,en;q=0.8', 'user-agent': 'Mozilla/5.0 (compatible; Logbook/1.0; +https://github.com/logbook)' },
      });
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get('location');
        await res.body?.cancel().catch(() => undefined);
        if (!loc) throw new ApiError(422, 'That link redirects nowhere.', 'bad_redirect');
        cur = new URL(loc, cur).toString();
        continue;
      }
      if (!res.ok) {
        await res.body?.cancel().catch(() => undefined);
        throw new ApiError(422, `That page answered ${res.status}.`, 'fetch_failed');
      }
      const ct = (res.headers.get('content-type') ?? '').toLowerCase();
      if (!ct.includes('text/html') && !ct.includes('application/xhtml+xml')) {
        await res.body?.cancel().catch(() => undefined);
        throw new ApiError(422, 'That link isn’t a web page.', 'not_html');
      }
      const chunks: Uint8Array[] = [];
      let total = 0;
      if (res.body) {
        const reader = res.body.getReader();
        while (total < maxBytes) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            const room = maxBytes - total;
            const slice = value.byteLength > room ? value.subarray(0, room) : value;
            chunks.push(slice);
            total += slice.byteLength;
          }
        }
        await reader.cancel().catch(() => undefined);
      }
      const buf = Buffer.concat(chunks.map((c) => Buffer.from(c)));
      const charset = /charset=([\w-]+)/i.exec(ct)?.[1] ?? /<meta[^>]+charset=["']?([\w-]+)/i.exec(buf.subarray(0, 4096).toString('latin1'))?.[1];
      let html: string;
      try {
        html = new TextDecoder(charset ?? 'utf-8', { fatal: false }).decode(buf);
      } catch {
        html = buf.toString('utf8');
      }
      return { html, finalUrl: cur };
    }
    throw new ApiError(422, 'That link redirects too many times.', 'bad_redirect');
  } catch (e) {
    if (e instanceof ApiError) throw e;
    if (ac.signal.aborted) throw new ApiError(422, 'That site took too long to answer.', 'timeout');
    throw new ApiError(422, 'That site couldn’t be reached.', 'fetch_failed');
  } finally {
    clearTimeout(timer);
  }
};

// ---------- reading the head of a page ----------
const NAMED: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', mdash: '—', ndash: '–', hellip: '…', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', laquo: '«', raquo: '»', copy: '©', reg: '®', trade: '™', middot: '·', bull: '•', times: '×' };
export const decodeEntities = (s: string): string =>
  s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, body: string) => {
    if (body[0] === '#') {
      const code = body[1]?.toLowerCase() === 'x' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : m;
    }
    return NAMED[body.toLowerCase()] ?? m;
  });

const clean = (s: string | undefined | null, max: number): string => (s ? decodeEntities(s).replace(/\s+/g, ' ').trim().slice(0, max) : '');

const attrs = (tag: string): Record<string, string> => {
  const out: Record<string, string> = {};
  const re = /([a-zA-Z:_-][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(tag))) out[m[1]!.toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? '';
  return out;
};

export interface PageMeta {
  title: string;
  siteName: string;
  description: string | null;
  imageUrl: string | null;
}

/** The hostname as a site name: no www, no port. */
export const siteOf = (url: string): string => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
};

/** What a page says about itself: Open Graph first, Twitter cards next, then the plain title tag. */
export const extractMeta = (html: string, url: string): PageMeta => {
  const head = html.slice(0, 300_000);
  const meta: Record<string, string> = {};
  for (const m of head.matchAll(/<meta\b[^>]*>/gi)) {
    const a = attrs(m[0]);
    const key = (a.property ?? a.name ?? a.itemprop ?? '').toLowerCase();
    const content = a.content ?? a.value;
    if (key && content && !(key in meta)) meta[key] = content;
  }
  const titleTag = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(head)?.[1];
  const site = siteOf(url);
  const title = clean(meta['og:title'] ?? meta['twitter:title'] ?? titleTag ?? meta['dc.title'], 200) || clean(`${site}${new URL(url).pathname === '/' ? '' : new URL(url).pathname}`, 200) || url;
  const description = clean(meta['og:description'] ?? meta['twitter:description'] ?? meta['description'], 500) || null;
  const rawImg = meta['og:image'] ?? meta['og:image:url'] ?? meta['og:image:secure_url'] ?? meta['twitter:image'] ?? meta['twitter:image:src'];
  let imageUrl: string | null = null;
  if (rawImg) {
    try {
      const abs = new URL(decodeEntities(rawImg.trim()), url);
      if (abs.protocol === 'https:' || abs.protocol === 'http:') imageUrl = abs.toString().slice(0, 1000);
    } catch {
      /* not a usable image */
    }
  }
  const siteName = clean(meta['og:site_name'] ?? meta['application-name'], 80) || site;
  return { title, siteName, description, imageUrl };
};

/** Fetch and read a page's head. A page that cannot be read still gets saved under its address; only a private address is refused. */
export const readPage = async (url: string, o: FetchOptions = {}): Promise<{ meta: PageMeta; finalUrl: string; fetched: boolean }> => {
  try {
    const { html, finalUrl } = await fetchPage(url, o);
    return { meta: extractMeta(html, finalUrl), finalUrl, fetched: true };
  } catch (e) {
    if (e instanceof ApiError && e.code === 'private_host') throw e;
    const site = siteOf(url);
    let path = '';
    try {
      path = new URL(url).pathname.replace(/\/+$/, '');
    } catch {
      /* keep empty */
    }
    return { meta: { title: `${site}${path}`.slice(0, 200) || url, siteName: site, description: null, imageUrl: null }, finalUrl: url, fetched: false };
  }
};

// =====================================================================================
// 2. Taste and the daily pick
// =====================================================================================

export interface TasteInput {
  today: ISODate;
  /** What the athlete saved, newest first: their own links and picks they kept. */
  saved: Link[];
  /** Picks they skipped: what not to bring back. */
  dismissed: Link[];
  /** Every URL ever saved or offered, so the same piece never comes twice. */
  known: string[];
}

const line = (l: Link): string => {
  const bits = [`“${l.title}”`, `— ${l.siteName || siteOf(l.url)}`];
  if (l.tags.length) bits.push(`[${l.tags.join(', ')}]`);
  if (l.note) bits.push(`— note: “${l.note.slice(0, 160)}”`);
  bits.push(l.readAt ? '(read)' : '(unread)');
  if (l.source === 'pick') bits.push('(a pick they kept)');
  return `- ${bits.join(' ')}`;
};

/**
 * The reader, in plain text, from what they saved: the newest 40 links with site, tags, notes and whether each was finished;
 * the picks they skipped as negatives; and every known URL so nothing comes twice. Notes and finished reads weigh most.
 */
export const tasteProfile = (t: TasteInput): string => {
  const saved = t.saved.slice(0, 40);
  const read = saved.filter((l) => l.readAt);
  const unread = saved.filter((l) => !l.readAt);
  const sites = [...saved.reduce((m, l) => m.set(l.siteName || siteOf(l.url), (m.get(l.siteName || siteOf(l.url)) ?? 0) + 1), new Map<string, number>())].sort((a, b) => b[1] - a[1]).slice(0, 8);
  const tags = [...saved.flatMap((l) => l.tags).reduce((m, x) => m.set(x, (m.get(x) ?? 0) + 1), new Map<string, number>())].sort((a, b) => b[1] - a[1]).slice(0, 10);
  const parts = [
    `THE READER'S SAVED LINKS (newest first; ${saved.length} shown). "read" means they finished it; "unread" means it still waits.`,
    ...(read.length ? ['Finished:', ...read.map(line)] : []),
    ...(unread.length ? ['Waiting:', ...unread.map(line)] : []),
    sites.length ? `Sites they come back to: ${sites.map(([s, n]) => (n > 1 ? `${s} (${n})` : s)).join(', ')}.` : '',
    tags.length ? `Tags they use: ${tags.map(([x]) => x).join(', ')}.` : '',
  ];
  if (t.dismissed.length) parts.push('', 'PICKS THEY SKIPPED (do not bring these back, and treat them as what they do not want):', ...t.dismissed.slice(0, 15).map((l) => `- “${l.title}” — ${l.siteName || siteOf(l.url)}${l.pickReason ? ` (offered because: ${l.pickReason})` : ''}`));
  if (t.known.length) parts.push('', 'ALREADY KNOWN (never pick one of these URLs, or the same piece under another address):', ...t.known.slice(0, 80).map((u) => `- ${u}`));
  return parts.filter((p) => p !== undefined).join('\n');
};

const since = (t: ISODate) => shiftDays(t, -14);

/** The ask: one article, fresh, fitting, and not already known. */
export const pickPrompt = (t: TasteInput): string =>
  [
    `Today is ${fmtDate('long', t.today)}, ${t.today.slice(0, 4)} (${t.today}).`,
    '',
    tasteProfile(t),
    '',
    `TASK: Search the web and choose ONE article this reader would want to read today, published on or after ${since(t.today)} (the last 14 days).`,
    '',
    'Rules:',
    '- A specific article, essay, long post or report at its own URL. Not a homepage, a section or tag page, a newsletter sign-up, a podcast or video page, a product page, a press release, a forum thread or a PDF.',
    `- Published on or after ${since(t.today)}. Confirm the date from the page or the search result. If you cannot tell when it was published, choose something else.`,
    '- Not in the known list above, and not the same piece republished elsewhere. Not from a site they skipped, unless their saves also lean on it.',
    '- Fit the reader: the subjects, kinds of writing, publications and tone of what they saved. Weigh their notes and what they finished most; weigh what they skipped against. Favor depth over news, and a piece they would not have seen on their own over the week’s most-shared story.',
    '- Use at most 6 searches. Open the result you choose to confirm it is a real article and the URL is the article itself (no tracking parameters).',
    '- url: the canonical address of the article.',
    '- title: the article’s own title, as published.',
    '- why: one sentence under 140 characters, plain words, addressed to the reader as “you”, naming what in their saves it connects to. No exclamation marks, no marketing words.',
    '- tags: up to 3 lowercase words or short phrases, reusing the reader’s own tags where they fit.',
  ].join('\n');

/** The one call that reaches the model, behind an interface so the rest can run without a key. */
export interface PickGenerator {
  readonly fake: boolean;
  generate(input: TasteInput): Promise<ReadsPickOutput>;
}

let client: Anthropic | null = null;
const anthropic = () => {
  if (!env.claudeConfigured) throw new ApiError(503, 'Daily picks aren’t configured on this server.', 'claude_not_configured');
  return (client ??= new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, timeout: 3 * 60_000, maxRetries: 1 }));
};

const SYSTEM = 'You choose one article a day for a single reader, from what is on the web right now. You read what they saved to understand their taste, search, verify the piece is real and recent, and answer in the requested shape with nothing else.';

/** Web search on the server side plus a structured answer; a paused turn is resumed, up to three times. */
export const claudePicker: PickGenerator = {
  fake: false,
  async generate(input) {
    const c = anthropic();
    const messages: Anthropic.MessageParam[] = [{ role: 'user', content: pickPrompt(input) }];
    const req = () =>
      c.messages
        .stream(
          {
            model: env.ANTHROPIC_MODEL,
            max_tokens: 16000,
            system: SYSTEM,
            tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 6 }],
            output_config: { effort: 'medium', format: zodOutputFormat(zReadsPickOutput) },
            messages,
          },
          { timeout: 120_000 },
        )
        .finalMessage();
    let msg = await req();
    for (let i = 0; i < 3 && msg.stop_reason === 'pause_turn'; i++) {
      messages.push({ role: 'assistant', content: msg.content });
      msg = await req();
    }
    if (msg.stop_reason === 'refusal') throw new ApiError(502, 'No pick came back today.', 'refused');
    if (msg.stop_reason === 'max_tokens' || msg.stop_reason === 'pause_turn') throw new ApiError(502, 'No pick came back today.', 'too_long');
    const text = msg.content.filter((b): b is Anthropic.TextBlock => b.type === 'text').pop()?.text ?? '';
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      throw new ApiError(502, 'No pick came back today.', 'invalid_pick');
    }
    const parsed = zReadsPickOutput.safeParse(json);
    if (!parsed.success) throw new ApiError(502, 'No pick came back today.', 'invalid_pick');
    return parsed.data;
  },
};

/** Dev: a fixed pick so the screen can be built and photographed without a key or the open web. */
const FAKE_PICKS: ReadsPickOutput[] = [
  { url: 'https://www.outsideonline.com/health/running/why-easy-runs-should-feel-slow/', title: 'Why your easy runs should feel embarrassingly slow', why: 'You saved three pieces on aerobic base; this one puts numbers on the pace.', tags: ['running', 'training'] },
  { url: 'https://www.theatlantic.com/health/archive/2026/10/sleep-debt-weekend/', title: 'You can’t pay back sleep debt on the weekend', why: 'You keep notes on sleep and recovery; this one tests the catch-up idea.', tags: ['sleep', 'recovery'] },
  { url: 'https://longreads.com/2026/10/the-quiet-mile/', title: 'The quiet mile', why: 'A long essay on running alone, close to the ones you finish.', tags: ['essay', 'running'] },
  { url: 'https://www.newyorker.com/culture/annals-of-inquiry/the-case-for-boredom/', title: 'The case for boredom', why: 'Your saves lean toward attention and solitude; this one argues for empty time.', tags: ['attention', 'essay'] },
];

/** Dev: fixed picks so the screen can be built and photographed without a key or the open web. Each refresh moves to the next one. */
export const fakePicker: PickGenerator = {
  fake: true,
  async generate(input) {
    await new Promise((r) => setTimeout(r, 1200));
    const next = FAKE_PICKS.find((p) => !input.known.some((k) => sameResource(k, p.url)));
    if (!next) throw new ApiError(502, 'No pick came back today.', 'invalid_pick');
    return next;
  },
};

export const pickerFor = (): PickGenerator | null => (env.readsFakePick ? fakePicker : env.claudeConfigured ? claudePicker : null);

/** Tidy the model's answer and refuse anything already known or not a web address. */
export const cleanPick = (out: ReadsPickOutput, known: string[]): ReadsPickOutput => {
  let url: string;
  try {
    url = normalizeUrl(out.url);
  } catch {
    throw new ApiError(502, 'No pick came back today.', 'invalid_pick');
  }
  if (known.some((k) => sameResource(k, url))) throw new ApiError(502, 'No pick came back today.', 'duplicate_pick');
  const title = out.title.replace(/\s+/g, ' ').trim().slice(0, 200);
  const why = out.why.replace(/\s+/g, ' ').trim().replace(/!+/g, '.').slice(0, 220);
  const tags = [...new Set(out.tags.map((x) => x.trim().toLowerCase().slice(0, 30)).filter(Boolean))].slice(0, 3);
  if (!title) throw new ApiError(502, 'No pick came back today.', 'invalid_pick');
  return { url, title, why, tags };
};
