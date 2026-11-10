import type Database from 'better-sqlite3';
import { createHash, createHmac } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import zlib from 'node:zlib';

/**
 * The nightly off-site backup (apps/api/RUNBOOK.md has the restore steps).
 *
 * Once a day the server takes a consistent copy of the SQLite file with SQLite's own online backup (safe while the app
 * is writing), gzips it, and puts it in an S3-compatible bucket with a different provider than the one the server runs
 * on. Copies older than BACKUP_KEEP_DAYS (default 5, the same window as the volume snapshots) are deleted in the same
 * run, so "deleted data is gone from backups within 5 days" stays true. Nothing runs unless the BACKUP_S3_* variables
 * are set.
 *
 * No SDK: the three calls it needs (put, list, delete) are signed here with AWS Signature Version 4.
 */
export interface BackupConfig {
  /** `https://<account>.r2.cloudflarestorage.com`, `https://s3.us-west-002.backblazeb2.com`, ... */
  endpoint: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** `auto` for Cloudflare R2; the bucket's region elsewhere. */
  region: string;
  /** Folder inside the bucket. */
  prefix: string;
  keepDays: number;
}

export const BACKUP_KEEP_DAYS_DEFAULT = 5;

/** The backup settings from the environment, or null when the job is off (any of the four required ones missing). */
export const backupConfigFrom = (e: Record<string, string | undefined>): BackupConfig | null => {
  const { BACKUP_S3_ENDPOINT: endpoint, BACKUP_S3_BUCKET: bucket, BACKUP_S3_ACCESS_KEY_ID: accessKeyId, BACKUP_S3_SECRET_ACCESS_KEY: secretAccessKey } = e;
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) return null;
  const keep = Number(e.BACKUP_KEEP_DAYS);
  return { endpoint: endpoint.replace(/\/+$/, ''), bucket, accessKeyId, secretAccessKey, region: e.BACKUP_S3_REGION || 'auto', prefix: (e.BACKUP_S3_PREFIX || 'logbook').replace(/^\/+|\/+$/g, ''), keepDays: Number.isFinite(keep) && keep >= 1 ? Math.floor(keep) : BACKUP_KEEP_DAYS_DEFAULT };
};

// ---------- AWS Signature Version 4 ----------
const sha256 = (data: string | Buffer) => createHash('sha256').update(data).digest('hex');
const hmac = (key: string | Buffer, data: string) => createHmac('sha256', key).update(data).digest();
/** RFC 3986 encoding as S3 wants it: everything but unreserved characters, and `/` kept in a path. */
const enc = (s: string, keepSlash = false) =>
  encodeURIComponent(s)
    .replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
    .replace(/%2F/g, keepSlash ? '/' : '%2F');

export interface SignInput {
  method: string;
  host: string;
  /** The path as sent, already a string ("/bucket/folder/file.gz"). */
  path: string;
  query?: Record<string, string>;
  headers?: Record<string, string>;
  /** The payload's SHA-256, or `UNSIGNED-PAYLOAD` for a streamed upload over TLS. */
  payloadHash: string;
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  now: Date;
}
/** The headers to send (the given ones plus host, x-amz-date, x-amz-content-sha256 and authorization) and the signature. */
export const signV4 = (i: SignInput): { headers: Record<string, string>; signature: string; queryString: string } => {
  const amzDate = i.now.toISOString().replace(/[-:]|\.\d{3}/g, '');
  const day = amzDate.slice(0, 8);
  const headers: Record<string, string> = { ...Object.fromEntries(Object.entries(i.headers ?? {}).map(([k, v]) => [k.toLowerCase(), String(v).trim()])), host: i.host, 'x-amz-content-sha256': i.payloadHash, 'x-amz-date': amzDate };
  const names = Object.keys(headers).sort();
  const queryString = Object.entries(i.query ?? {})
    .map(([k, v]) => [enc(k), enc(v)] as const)
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join('&');
  const canonical = [i.method, i.path.split('/').map((p) => enc(decodeURIComponent(p))).join('/'), queryString, ...names.map((n) => `${n}:${headers[n]}`), '', names.join(';'), i.payloadHash].join('\n');
  const scope = `${day}/${i.region}/s3/aws4_request`;
  const toSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256(canonical)].join('\n');
  const key = hmac(hmac(hmac(hmac(`AWS4${i.secretAccessKey}`, day), i.region), 's3'), 'aws4_request');
  const signature = createHmac('sha256', key).update(toSign).digest('hex');
  headers.authorization = `AWS4-HMAC-SHA256 Credential=${i.accessKeyId}/${scope},SignedHeaders=${names.join(';')},Signature=${signature}`;
  return { headers, signature, queryString };
};

// ---------- the three calls ----------
const EMPTY = sha256('');
const call = async (cfg: BackupConfig, method: string, key: string, opts: { query?: Record<string, string>; body?: RequestInit['body']; headers?: Record<string, string>; payloadHash?: string; now?: Date } = {}) => {
  const url = new URL(cfg.endpoint);
  // path-style addressing: every S3-compatible store takes it, and it needs no DNS name per bucket
  const p = `${url.pathname.replace(/\/+$/, '')}/${cfg.bucket}${key ? `/${key}` : ''}`;
  const signed = signV4({ method, host: url.host, path: p, query: opts.query, headers: opts.headers, payloadHash: opts.payloadHash ?? EMPTY, accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey, region: cfg.region, now: opts.now ?? new Date() });
  const { host: _host, ...send } = signed.headers;
  const target = `${url.origin}${p.split('/').map((s) => enc(decodeURIComponent(s))).join('/')}${signed.queryString ? `?${signed.queryString}` : ''}`;
  const res = await fetch(target, { method, headers: send, body: opts.body, ...(opts.body ? { duplex: 'half' } : {}), signal: AbortSignal.timeout(10 * 60_000) } as RequestInit);
  if (!res.ok) throw new Error(`backup storage answered ${res.status} to ${method} ${key || '(list)'}: ${(await res.text()).slice(0, 200)}`);
  return res;
};

export interface RemoteObject {
  key: string;
  lastModified: string;
}
/** Every object under the backup folder. */
export const listBackups = async (cfg: BackupConfig): Promise<RemoteObject[]> => {
  const out: RemoteObject[] = [];
  let token: string | null = null;
  for (let page = 0; page < 50; page++) {
    const query: Record<string, string> = { 'list-type': '2', prefix: `${cfg.prefix}/`, ...(token ? { 'continuation-token': token } : {}) };
    const xml = await (await call(cfg, 'GET', '', { query })).text();
    for (const m of xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)) {
      const key = /<Key>([\s\S]*?)<\/Key>/.exec(m[1]!)?.[1];
      const lastModified = /<LastModified>([\s\S]*?)<\/LastModified>/.exec(m[1]!)?.[1];
      if (key) out.push({ key: key.replace(/&amp;/g, '&'), lastModified: lastModified ?? '' });
    }
    token = /<IsTruncated>true<\/IsTruncated>/.test(xml) ? (/<NextContinuationToken>([\s\S]*?)<\/NextContinuationToken>/.exec(xml)?.[1] ?? null) : null;
    if (!token) break;
  }
  return out;
};

/** The day a backup was taken, from its name (`.../2026-11-10/logbook-...`), else from the store's own date. */
export const backupDay = (o: RemoteObject): string | null => /\/(\d{4}-\d{2}-\d{2})\//.exec(`/${o.key}`)?.[1] ?? (o.lastModified ? o.lastModified.slice(0, 10) : null);

/** Which remote copies are past the retention window on `today` (UTC): older than `keepDays` days. */
export const expiredBackups = (objects: RemoteObject[], keepDays: number, today: string): RemoteObject[] => {
  const cutoff = new Date(Date.parse(`${today}T00:00:00Z`) - keepDays * 864e5).toISOString().slice(0, 10);
  return objects.filter((o) => {
    const day = backupDay(o);
    return day !== null && day < cutoff;
  });
};

export interface BackupResult {
  key: string;
  bytes: number;
  deleted: string[];
  kept: number;
}

/**
 * One backup run: copy, gzip, upload, then delete the remote copies older than the retention window. The local copy
 * lives in the temp folder only while the run lasts.
 */
export const runBackup = async (sqlite: Database.Database, cfg: BackupConfig, now = new Date()): Promise<BackupResult> => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'logbook-backup-'));
  const copy = path.join(dir, 'logbook.db');
  const packed = `${copy}.gz`;
  try {
    await sqlite.backup(copy);
    await pipeline(fs.createReadStream(copy), zlib.createGzip({ level: 6 }), fs.createWriteStream(packed));
    fs.rmSync(copy, { force: true });
    const bytes = fs.statSync(packed).size;
    const stamp = now.toISOString().replace(/[:.]/g, '-');
    const key = `${cfg.prefix}/${stamp.slice(0, 10)}/logbook-${stamp}.db.gz`;
    await call(cfg, 'PUT', key, { body: Readable.toWeb(fs.createReadStream(packed)) as unknown as RequestInit['body'], headers: { 'content-length': String(bytes), 'content-type': 'application/gzip' }, payloadHash: 'UNSIGNED-PAYLOAD', now });
    const all = await listBackups(cfg);
    const expired = expiredBackups(all, cfg.keepDays, now.toISOString().slice(0, 10)).filter((o) => o.key !== key);
    for (const o of expired) await call(cfg, 'DELETE', o.key);
    return { key, bytes, deleted: expired.map((o) => o.key), kept: all.length - expired.length };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
};

/**
 * Run the backup once a day while the server is up: checked every half hour, due when today's (UTC) has not succeeded
 * yet and the hour has come. The last good day is remembered in a small file beside the database, so a restart neither
 * skips a night nor uploads twice. A failure is logged and tried again on the next check.
 */
export const scheduleBackups = (sqlite: Database.Database, cfg: BackupConfig, opts: { databasePath: string; hourUtc?: number; log?: (line: string) => void }) => {
  const marker = `${opts.databasePath}.last-backup`;
  const hour = opts.hourUtc ?? 8;
  const log = opts.log ?? ((l: string) => console.log(l));
  let running = false;
  const tick = async () => {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    if (running || now.getUTCHours() < hour) return;
    let last = '';
    try {
      last = fs.readFileSync(marker, 'utf8').trim();
    } catch {
      /* never backed up from this volume */
    }
    if (last === today) return;
    running = true;
    try {
      const r = await runBackup(sqlite, cfg, now);
      fs.writeFileSync(marker, today);
      log(JSON.stringify({ evt: 'backup', ok: true, key: r.key, bytes: r.bytes, deleted: r.deleted.length, kept: r.kept, at: now.toISOString() }));
    } catch (e) {
      console.error(JSON.stringify({ evt: 'backup', ok: false, error: e instanceof Error ? e.message : String(e), at: now.toISOString() }));
    } finally {
      running = false;
    }
  };
  const timer = setInterval(() => void tick(), 30 * 60_000);
  timer.unref();
  setTimeout(() => void tick(), 60_000).unref();
  return { tick, stop: () => clearInterval(timer) };
};
