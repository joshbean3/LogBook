/** "just now", "5 min ago", "3 h ago", "2 days ago": how old a sync is, in words (null when there is none). */
export const ago = (iso: string | null | undefined, now = Date.now()): string | null => {
  if (!iso) return null;
  const m = Math.round((now - new Date(iso).getTime()) / 60e3);
  if (!Number.isFinite(m)) return null;
  return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 48 * 60 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} days ago`;
};

/** "Version 1.0.0", or with the iOS build number when it differs: "Version 1.2 (34)". */
export const versionLine = (v: string, build?: string | null) => `Version ${v}${build && build !== v ? ` (${build})` : ''}`;

/** "1.0.0 (922ade2)": the version with the short commit it was built from; the version alone when there is no commit. */
export const versionStamp = (v: string, commit?: string | null) => `${v}${commit && commit !== 'dev' ? ` (${commit})` : ''}`;

/**
 * A row's accessible name: it starts with the words printed on the row, so "Tap <name>" works in Voice Control (WCAG
 * 2.5.3). A label that adds words keeps them after the printed title ("Sam. Your profile").
 */
export const rowName = (title: unknown, label?: string): string | undefined => {
  if (!label) return undefined;
  if (typeof title !== 'string' || !title.trim()) return label;
  return label.toLowerCase().startsWith(title.trim().toLowerCase()) ? label : `${title.trim()}. ${label}`;
};
