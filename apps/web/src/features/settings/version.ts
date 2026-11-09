import { useEffect, useState } from 'react';
import { isNative } from '@/lib/native';
import pkg from '../../../package.json';
import { versionLine } from './format';

/** The web build's version (apps/web/package.json). */
export const WEB_VERSION: string = pkg.version;

/** "Version 1.0.0", or on the phone the app's own version and build ("Version 1.2 (34)"), read from iOS. */
export const useAppVersion = (): string => {
  const [line, setLine] = useState(() => versionLine(WEB_VERSION));
  useEffect(() => {
    if (!isNative) return;
    let live = true;
    void import('@capacitor/app')
      .then(({ App }) => App.getInfo())
      .then((info) => {
        if (live) setLine(versionLine(info.version, info.build));
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);
  return line;
};

/** "Built 922ade2 · Nov 9, 8:41 PM": the commit and time this bundle was built (vite.config.ts). */
export const buildLine = (): string => {
  const at = new Date(__BUILD_AT__);
  const when = Number.isNaN(+at) ? '' : ` · ${at.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`;
  return `Built ${__BUILD_COMMIT__}${when}`;
};
