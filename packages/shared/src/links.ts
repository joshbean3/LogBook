/**
 * A saved link's name when its page never said one (no title tag, or the page could not be read): the domain and the
 * path's last readable segment, "nytimes.com · the-quiet-mile". Never the raw address.
 */

/** The WHATWG URL parser (Node and browsers both have it; this package is built without the DOM types). */
interface ParsedUrl {
  hostname: string;
  pathname: string;
}
const URLParser = (globalThis as unknown as { URL: new (u: string) => ParsedUrl }).URL;

const parse = (url: string): ParsedUrl | null => {
  try {
    return new URLParser(/^[a-z][a-z0-9+.-]*:\/\//i.test(url.trim()) ? url.trim() : `https://${url.trim()}`);
  } catch {
    return null;
  }
};

/** "nytimes.com" from any address ("https://www.nytimes.com/…"), or '' when it is not one. */
export const linkDomain = (url: string): string => parse(url)?.hostname.replace(/^www\./, '') ?? '';

/** A segment a person can read: has letters, is not an id or a hash, not "index" or "amp". */
const readable = (seg: string) => /[a-z]/i.test(seg) && !/^[0-9a-f-]{12,}$/i.test(seg) && !/^[a-z]?\d+[a-z]?$/i.test(seg) && !/^(index|default|amp|story|article|p|a)$/i.test(seg);

/** The last readable path segment, decoded, its file extension and stray separators trimmed: "the-quiet-mile". */
export const linkSlug = (url: string): string => {
  const u = parse(url);
  if (!u) return '';
  const segs = u.pathname
    .split('/')
    .map((s: string) => {
      let v = s;
      try {
        v = decodeURIComponent(s);
      } catch {
        /* keep it as it is */
      }
      return v
        .replace(/\.(html?|php|aspx?|jsp)$/i, '')
        .replace(/[\s_+]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .toLowerCase();
    })
    .filter(Boolean);
  for (let i = segs.length - 1; i >= 0; i--) if (readable(segs[i]!)) return segs[i]!.slice(0, 80);
  return '';
};

/** "nytimes.com · the-quiet-mile", or just "nytimes.com" when the path has nothing readable. */
export const linkTitleFromUrl = (url: string): string => {
  const d = linkDomain(url);
  const s = linkSlug(url);
  return d && s ? `${d} · ${s}` : d || s || url;
};

/**
 * Whether a stored title is only the address: the raw URL or "example.com/long/path" (what an earlier build saved when a
 * page had no title), or the name `linkTitleFromUrl` gives it. The row then says `linkTitleFromUrl`, and leaves the
 * site out of its meta line (the title already names it).
 */
export const isAddressTitle = (title: string, url: string): boolean => {
  const t = title.trim().replace(/\/+$/, '').toLowerCase();
  if (!t) return true;
  if (/^https?:\/\//.test(t)) return true;
  // the name this module gives a page with no title of its own
  if (t === linkTitleFromUrl(url).toLowerCase()) return true;
  const u = parse(url);
  if (!u) return false;
  const host = u.hostname.toLowerCase();
  const bare = host.replace(/^www\./, '');
  const path = u.pathname.replace(/\/+$/, '').toLowerCase();
  let decoded = path;
  try {
    decoded = decodeURI(path);
  } catch {
    /* keep it encoded */
  }
  return [host, bare].some((h) => t === h || t === `${h}${path}` || t === `${h}${decoded}`);
};

/** The name a saved link goes by: its own title, unless that is only its address. */
export const linkTitle = (title: string | null | undefined, url: string): string => (title && !isAddressTitle(title, url) ? title : linkTitleFromUrl(url));
