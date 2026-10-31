/** Google encoded polyline → [lat, lng][] (Strava's map.summary_polyline uses it). */
export const decodePolyline = (s: string): Array<[number, number]> => {
  const out: Array<[number, number]> = [];
  let i = 0;
  let lat = 0;
  let lng = 0;
  while (i < s.length) {
    for (const k of [0, 1]) {
      let shift = 0;
      let result = 0;
      let b: number;
      do {
        b = s.charCodeAt(i++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const d = result & 1 ? ~(result >> 1) : result >> 1;
      if (k === 0) lat += d;
      else lng += d;
    }
    out.push([lat / 1e5, lng / 1e5]);
  }
  return out;
};

/** [lat, lng][] → the points in a w×h box with padding, aspect preserved, lat flipped so north is up; and the path through them. */
export const routeGeometry = (pts: Array<[number, number]>, w: number, h: number, pad = 8): { d: string; xy: Array<[number, number]> } => {
  if (pts.length < 2) return { d: '', xy: [] };
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
  for (const [la, ln] of pts) {
    if (la < minLat) minLat = la;
    if (la > maxLat) maxLat = la;
    if (ln < minLng) minLng = ln;
    if (ln > maxLng) maxLng = ln;
  }
  const cos = Math.cos(((minLat + maxLat) / 2) * (Math.PI / 180));
  const spanX = (maxLng - minLng) * cos || 1e-9;
  const spanY = maxLat - minLat || 1e-9;
  const scale = Math.min((w - pad * 2) / spanX, (h - pad * 2) / spanY);
  const ox = (w - spanX * scale) / 2;
  const oy = (h - spanY * scale) / 2;
  const xy = pts.map(([la, ln]): [number, number] => [ox + (ln - minLng) * cos * scale, oy + (maxLat - la) * scale]);
  return { d: xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(''), xy };
};

/** [lat, lng][] → an SVG path in a w×h box with padding, aspect preserved, lat flipped so north is up. */
export const routePath = (pts: Array<[number, number]>, w: number, h: number, pad = 8): string => routeGeometry(pts, w, h, pad).d;

const metersBetween = ([a1, o1]: [number, number], [a2, o2]: [number, number]) => {
  const r = Math.PI / 180;
  const x = (o2 - o1) * r * Math.cos(((a1 + a2) / 2) * r);
  const y = (a2 - a1) * r;
  return Math.hypot(x, y) * 6371e3;
};

/** The index of the route point a fraction (0 to 1) of the way along it, by distance. */
export const indexAlong = (pts: Array<[number, number]>, frac: number): number => {
  if (pts.length < 2) return 0;
  const seg = pts.slice(1).map((p, i) => metersBetween(pts[i]!, p));
  const total = seg.reduce((t, d) => t + d, 0);
  let want = Math.max(0, Math.min(1, frac)) * total;
  for (let i = 0; i < seg.length; i++) {
    want -= seg[i]!;
    if (want <= 0) return i + 1;
  }
  return pts.length - 1;
};

/** Encoder, for seeds and tests. */
export const encodePolyline = (pts: Array<[number, number]>): string => {
  let out = '';
  let pl = 0;
  let pg = 0;
  const enc = (v: number) => {
    let n = v < 0 ? ~(v << 1) : v << 1;
    let s = '';
    while (n >= 0x20) {
      s += String.fromCharCode((0x20 | (n & 0x1f)) + 63);
      n >>= 5;
    }
    return s + String.fromCharCode(n + 63);
  };
  for (const [la, ln] of pts) {
    const a = Math.round(la * 1e5);
    const b = Math.round(ln * 1e5);
    out += enc(a - pl) + enc(b - pg);
    pl = a;
    pg = b;
  }
  return out;
};
