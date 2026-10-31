import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const STARTED = Date.now();

let cached: string | null = null;
/** `@logbook/api`'s version from its package.json (next to dist/ in the image, two levels up from src/services/ops in dev). */
export const appVersion = (): string => {
  if (cached) return cached;
  for (const up of [1, 2, 3, 4]) {
    const p = path.join(here, ...Array(up).fill('..'), 'package.json');
    try {
      const pkg = JSON.parse(fs.readFileSync(p, 'utf8')) as { name?: string; version?: string };
      if (pkg.name === '@logbook/api' && pkg.version) return (cached = pkg.version);
    } catch {
      // keep looking
    }
  }
  return (cached = '0.0.0');
};

export const uptimeSeconds = (now = Date.now()) => Math.round((now - STARTED) / 1000);
