import { useEffect, useState } from 'react';
import { isNative } from '@/lib/native';
import pkg from '../../../package.json';
import { versionStamp } from './format';

/** The web build's version (apps/web/package.json). */
export const WEB_VERSION: string = pkg.version;

/**
 * "1.0.0 (922ade2)": the version and the short commit this bundle was built from (vite.config.ts). On the phone the
 * version is the app's own, read from iOS. The commit is how to tell a stale build from a fresh one.
 */
export const useAppVersion = (): string => {
  const [line, setLine] = useState(() => versionStamp(WEB_VERSION, __BUILD_COMMIT__));
  useEffect(() => {
    if (!isNative) return;
    let live = true;
    void import('@capacitor/app')
      .then(({ App }) => App.getInfo())
      .then((info) => {
        if (live) setLine(versionStamp(info.version, __BUILD_COMMIT__));
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);
  return line;
};
