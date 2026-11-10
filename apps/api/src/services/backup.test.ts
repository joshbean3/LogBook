import Database from 'better-sqlite3';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openDatabase } from '../db/index.js';
import { users } from '../db/schema.js';
import { BACKUP_KEEP_DAYS_DEFAULT, backupConfigFrom, backupDay, expiredBackups, listBackups, runBackup, scheduleBackups, signV4, type BackupConfig } from './backup.js';

/** The nightly backup: a real SQLite copy lands in the bucket, and copies past the retention window leave it. */

describe('signV4', () => {
  // the worked examples from Amazon's "Signature Calculations for the Authorization Header" (S3 API reference)
  const base = { host: 'examplebucket.s3.amazonaws.com', accessKeyId: 'AKIAIOSFODNN7EXAMPLE', secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY', region: 'us-east-1', now: new Date('2013-05-24T00:00:00Z'), payloadHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' };
  it('signs a GET for an object as Amazon documents it', () => {
    const s = signV4({ ...base, method: 'GET', path: '/test.txt', headers: { Range: 'bytes=0-9' } });
    expect(s.signature).toBe('f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41');
    expect(s.headers.authorization).toBe('AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE/20130524/us-east-1/s3/aws4_request,SignedHeaders=host;range;x-amz-content-sha256;x-amz-date,Signature=f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41');
  });
  it('signs a bucket listing with query parameters as Amazon documents it', () => {
    const s = signV4({ ...base, method: 'GET', path: '/', query: { 'max-keys': '2', prefix: 'J' } });
    expect(s.signature).toBe('34b48302e7b5fa45bde8084f4b7868a86f0a534bc59db6670ed5711ef69dc6f7');
    expect(s.queryString).toBe('max-keys=2&prefix=J');
  });
});

describe('the retention window', () => {
  const obj = (key: string, lastModified = '') => ({ key, lastModified });
  it('expires copies older than the keep days, by the day in their name', () => {
    const all = ['2026-11-10', '2026-11-09', '2026-11-06', '2026-11-05', '2026-11-04', '2026-10-01'].map((d) => obj(`logbook/${d}/logbook-${d}T08-00-00-000Z.db.gz`));
    expect(expiredBackups(all, 5, '2026-11-10').map(backupDay)).toEqual(['2026-11-04', '2026-10-01']);
    expect(expiredBackups(all, 1, '2026-11-10').map(backupDay)).toEqual(['2026-11-06', '2026-11-05', '2026-11-04', '2026-10-01']);
    // a file with no day in its name is judged by the store's own date; one with neither is left alone
    expect(expiredBackups([obj('logbook/manual.db.gz', '2026-10-01T00:00:00.000Z'), obj('logbook/readme.txt')], 5, '2026-11-10').map((o) => o.key)).toEqual(['logbook/manual.db.gz']);
  });
  it('defaults to 5 days, the volume snapshot window, and is off without the four settings', () => {
    const full = { BACKUP_S3_ENDPOINT: 'https://acct.r2.cloudflarestorage.com/', BACKUP_S3_BUCKET: 'b', BACKUP_S3_ACCESS_KEY_ID: 'k', BACKUP_S3_SECRET_ACCESS_KEY: 's' };
    expect(backupConfigFrom(full)).toEqual({ endpoint: 'https://acct.r2.cloudflarestorage.com', bucket: 'b', accessKeyId: 'k', secretAccessKey: 's', region: 'auto', prefix: 'logbook', keepDays: 5 });
    expect(BACKUP_KEEP_DAYS_DEFAULT).toBe(5);
    expect(backupConfigFrom({ ...full, BACKUP_KEEP_DAYS: '14', BACKUP_S3_REGION: 'us-west-002', BACKUP_S3_PREFIX: '/prod/' })).toMatchObject({ keepDays: 14, region: 'us-west-002', prefix: 'prod' });
    expect(backupConfigFrom({ ...full, BACKUP_KEEP_DAYS: 'soon' })!.keepDays).toBe(5);
    for (const k of Object.keys(full)) expect(backupConfigFrom({ ...full, [k]: '' })).toBeNull();
  });
});

describe('a backup run against an S3-compatible store', () => {
  let server: http.Server;
  let cfg: BackupConfig;
  let store: Map<string, { body: Buffer; lastModified: string }>;
  let requests: Array<{ method: string; url: string; auth: string }>;
  let tmp: string;

  beforeEach(async () => {
    store = new Map();
    requests = [];
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'logbook-backup-test-'));
    // the smallest store that speaks the three calls: PUT object, GET ?list-type=2, DELETE object (path-style)
    server = http.createServer((req, res) => {
      const url = new URL(req.url ?? '/', 'http://x');
      requests.push({ method: req.method ?? '', url: req.url ?? '', auth: String(req.headers.authorization ?? '') });
      const key = decodeURIComponent(url.pathname.replace(/^\/bucket-1\/?/, ''));
      const chunks: Buffer[] = [];
      req.on('data', (c: Buffer) => chunks.push(c));
      req.on('end', () => {
        if (!/^AWS4-HMAC-SHA256 Credential=key-id\/\d{8}\/auto\/s3\/aws4_request,SignedHeaders=[a-z0-9;-]+,Signature=[0-9a-f]{64}$/.test(String(req.headers.authorization))) {
          res.writeHead(403).end('<Error><Code>SignatureDoesNotMatch</Code></Error>');
        } else if (req.method === 'PUT') {
          store.set(key, { body: Buffer.concat(chunks), lastModified: new Date().toISOString() });
          res.writeHead(200).end();
        } else if (req.method === 'DELETE') {
          store.delete(key);
          res.writeHead(204).end();
        } else if (req.method === 'GET' && url.searchParams.get('list-type') === '2') {
          const prefix = url.searchParams.get('prefix') ?? '';
          const items = [...store.entries()].filter(([k]) => k.startsWith(prefix));
          res.writeHead(200, { 'content-type': 'application/xml' }).end(`<?xml version="1.0"?><ListBucketResult><IsTruncated>false</IsTruncated>${items.map(([k, v]) => `<Contents><Key>${k}</Key><LastModified>${v.lastModified}</LastModified><Size>${v.body.length}</Size></Contents>`).join('')}</ListBucketResult>`);
        } else res.writeHead(400).end();
      });
    });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    const port = (server.address() as { port: number }).port;
    cfg = { endpoint: `http://127.0.0.1:${port}`, bucket: 'bucket-1', accessKeyId: 'key-id', secretAccessKey: 'secret', region: 'auto', prefix: 'logbook', keepDays: 5 };
  });
  afterEach(async () => {
    await new Promise((r) => server.close(r));
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  const liveDb = () => {
    const file = path.join(tmp, 'live.db');
    const { db, sqlite } = openDatabase(file);
    for (let i = 0; i < 25; i++) db.insert(users).values({ id: `u${i}`, email: `u${i}@example.com`, passwordHash: 'x', createdAt: new Date().toISOString() }).run();
    return { db, sqlite, file };
  };

  it('uploads a gzipped copy that restores to the same database', async () => {
    const { sqlite } = liveDb();
    const now = new Date('2026-11-10T08:00:03.000Z');
    const r = await runBackup(sqlite, cfg, now);
    expect(r.key).toBe('logbook/2026-11-10/logbook-2026-11-10T08-00-03-000Z.db.gz');
    expect(r.deleted).toEqual([]);
    expect([...store.keys()]).toEqual([r.key]);
    expect(r.bytes).toBe(store.get(r.key)!.body.length);
    // restore: gunzip, open, read
    const restored = path.join(tmp, 'restored.db');
    fs.writeFileSync(restored, zlib.gunzipSync(store.get(r.key)!.body));
    const back = new Database(restored, { readonly: true });
    expect(back.prepare('select count(*) n from users').get()).toEqual({ n: 25 });
    expect(back.prepare('pragma integrity_check').get()).toEqual({ integrity_check: 'ok' });
    expect((back.prepare("select count(*) n from sqlite_master where type = 'table'").get() as { n: number }).n).toBeGreaterThan(30);
    back.close();
    sqlite.close();
  });

  it('removes remote objects older than BACKUP_KEEP_DAYS and keeps the rest', async () => {
    const { sqlite } = liveDb();
    const old = (day: string) => `logbook/${day}/logbook-${day}T08-00-00-000Z.db.gz`;
    for (const day of ['2026-10-20', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-08', '2026-11-09']) store.set(old(day), { body: Buffer.from('x'), lastModified: `${day}T08:00:00.000Z` });
    // something else in the bucket is never touched
    store.set('other-app/2020-01-01/file.gz', { body: Buffer.from('y'), lastModified: '2020-01-01T00:00:00.000Z' });
    const r = await runBackup(sqlite, cfg, new Date('2026-11-10T08:00:00.000Z'));
    expect(r.deleted.sort()).toEqual([old('2026-10-20'), old('2026-11-03'), old('2026-11-04')]);
    expect([...store.keys()].sort()).toEqual([old('2026-11-05'), old('2026-11-08'), old('2026-11-09'), r.key, 'other-app/2020-01-01/file.gz'].sort());
    expect(r.kept).toBe(4);
    expect((await listBackups(cfg)).map((o) => o.key).sort()).toEqual([old('2026-11-05'), old('2026-11-08'), old('2026-11-09'), r.key].sort());
    // a longer window keeps more
    store.set(old('2026-11-01'), { body: Buffer.from('x'), lastModified: '2026-11-01T08:00:00.000Z' });
    expect((await runBackup(sqlite, { ...cfg, keepDays: 30 }, new Date('2026-11-10T09:00:00.000Z'))).deleted).toEqual([]);
    sqlite.close();
  });

  it('fails loudly when the store refuses, and leaves no local copy behind', async () => {
    const { sqlite } = liveDb();
    const before = fs.readdirSync(os.tmpdir()).filter((f) => f.startsWith('logbook-backup-') && !f.startsWith('logbook-backup-test-')).length;
    await expect(runBackup(sqlite, { ...cfg, accessKeyId: 'wrong' }, new Date())).rejects.toThrow(/backup storage answered 403/);
    expect(store.size).toBe(0);
    expect(fs.readdirSync(os.tmpdir()).filter((f) => f.startsWith('logbook-backup-') && !f.startsWith('logbook-backup-test-')).length).toBe(before);
    sqlite.close();
  });

  it('the schedule runs once a day, from the set hour, and remembers the day across restarts', async () => {
    const { sqlite, file } = liveDb();
    const lines: string[] = [];
    const job = scheduleBackups(sqlite, cfg, { databasePath: file, hourUtc: 0, log: (l) => lines.push(l) });
    await job.tick();
    await job.tick();
    job.stop();
    expect(store.size).toBe(1);
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0]!)).toMatchObject({ evt: 'backup', ok: true, deleted: 0 });
    expect(fs.readFileSync(`${file}.last-backup`, 'utf8')).toBe(new Date().toISOString().slice(0, 10));
    // a restarted server sees today's is done
    const again = scheduleBackups(sqlite, cfg, { databasePath: file, hourUtc: 0, log: (l) => lines.push(l) });
    await again.tick();
    again.stop();
    expect(store.size).toBe(1);
    // before the hour nothing runs
    fs.rmSync(`${file}.last-backup`);
    const late = scheduleBackups(sqlite, cfg, { databasePath: file, hourUtc: 24, log: (l) => lines.push(l) });
    await late.tick();
    late.stop();
    expect(store.size).toBe(1);
    sqlite.close();
  });
});
