import { useEffect, useState } from 'react';

export type ThemePref = 'system' | 'light' | 'dark';
const KEY = 'logbook.theme';

export const readTheme = (): ThemePref => {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
};

const apply = (pref: ThemePref) => {
  const root = document.documentElement;
  if (pref === 'system') delete root.dataset.theme;
  else root.dataset.theme = pref;
  const dark = pref === 'dark' || (pref === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  for (const m of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) m.content = dark ? '#111110' : '#f5f3ee';
};

export const useTheme = () => {
  const [pref, setPref] = useState<ThemePref>(readTheme);
  useEffect(() => {
    apply(pref);
    try {
      if (pref === 'system') localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, pref);
    } catch {
      /* private mode */
    }
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => apply(pref);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [pref]);
  return [pref, setPref] as const;
};
