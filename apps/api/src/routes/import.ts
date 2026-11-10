import { Hono } from 'hono';
import type { AuthEnv } from '../auth.js';
import type { DB } from '../db/index.js';
import { ApiError } from '../lib/util.js';
import { exportAccount, importV2Chunked, zExportV2 } from '../services/exporter.js';
import { hitLimit, tooMany } from '../services/throttle.js';

/** Imports per account: a few an hour is plenty for moving an account, and a file is up to 20 MB of work. */
export const IMPORT_LIMIT = { max: 5, windowMs: 3600_000 } as const;
export const NOT_EXPORT = 'That is not a Logbook export file.';

export const importRoutes = (db: DB) => {
  const r = new Hono<AuthEnv>();

  /** Contract 3: the whole account as one JSON document (version 2). Settings → Export saves this as a file. */
  r.get('/export', (c) => {
    const userId = c.get('user').id;
    c.header('content-disposition', `attachment; filename="logbook-export-${c.get('today')}.json"`);
    return c.json(exportAccount(db, userId));
  });

  /**
   * Bring a version 2 export (`GET /export`) back in, into this account or a fresh one, idempotently by id (see
   * `importV2`). Nothing else imports: the original dashboard's bundle format was dropped for the public release.
   * Answers `{ ok, version, imported }`; 413 over 20 MB (index.ts), 422 for anything that is not an export, 429 past
   * five an hour.
   */
  r.post('/import', async (c) => {
    const userId = c.get('user').id;
    const raw = await c.req.json().catch(() => null);
    if (!raw || typeof raw !== 'object' || (raw as { version?: unknown }).version !== 2) throw new ApiError(422, NOT_EXPORT, 'not_export');
    // counted once the file looks like an export: that is where the work starts
    const wait = hitLimit(db, `import:${userId}`, IMPORT_LIMIT.max, IMPORT_LIMIT.windowMs);
    if (wait) throw tooMany(wait, 'Too many imports. Try again in an hour.');
    const v2 = zExportV2.safeParse(raw);
    // the file is a Logbook export but something in it is off (edited by hand, or too many rows): one plain line
    if (!v2.success) throw new ApiError(422, 'That export file could not be read. Export it again from Logbook and try once more.', 'bad_bundle');
    return c.json({ ok: true, version: 2, imported: await importV2Chunked(db, userId, v2.data) });
  });

  return r;
};
