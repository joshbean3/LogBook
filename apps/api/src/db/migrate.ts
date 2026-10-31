import { openDatabase } from './index.js';
import { log } from '../lib/log.js';

// `pnpm db:migrate`: apply the pending migrations (under the same lease the server boot uses) and leave.
const { sqlite, path } = openDatabase(undefined, { migrate: true });
sqlite.close();
log.info('database is up to date', { path });
