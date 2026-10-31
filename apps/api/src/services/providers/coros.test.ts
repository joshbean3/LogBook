import { createHash } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { openDatabase, type DB } from '../../db/index.js';
import { activities, providerClients, providerConnections } from '../../db/schema.js';
import { env } from '../../env.js';
import { buildApp } from '../../index.js';
import { corosBucket } from './bucket.js';
import { corosAuthorizeUrl, corosProvider, mapActivity, resetCoros } from './coros.js';
import { syncConnection } from './index.js';
import { McpClient, resetMcp } from './mcp.js';
import { discover, ensureClient, resetOAuthCache } from './oauth.js';
import { ProviderError } from './types.js';

/**
 * A fake of COROS's servers as fetch sees them: the MCP endpoint (401 without a token, JSON-RPC with one), the two
 * metadata documents, registration, token and revocation. Every request is recorded; what the tools answer is set per
 * test. Shapes match what was verified on the live server; the tools' field names are the adapter's guesses.
 */
const MCP = 'https://mcp.coros.com/mcp';
const REGION = 'https://mcpus.coros.com';
const ENDPOINT = `${REGION}/mcp`;
const RESOURCE_META = `${REGION}/.well-known/oauth-protected-resource/mcp`;
/** Three days ago at 06:30Z: inside the 120-day window whatever the clock says; -16 quarter hours makes it 02:30 local, the same day. */
const RUN_START = (Math.floor(Date.now() / 86400_000) - 3) * 86400 + 6.5 * 3600;
const RUN_DAY = new Date(RUN_START * 1000).toISOString().slice(0, 10);
const RIDE_DAY = new Date((RUN_START + 86400) * 1000).toISOString().slice(0, 10);

const jwt = (claims: Record<string, unknown>) => `eyJhbGciOiJub25lIn0.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.sig`;
const json = (body: unknown, status = 200, headers: Record<string, string> = {}) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });
const withUrl = (res: Response, url: string) => Object.defineProperty(res, 'url', { value: url });

interface Call {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string;
  rpc?: { id?: number; method: string; params?: { name?: string; arguments?: Record<string, unknown> } & Record<string, unknown> };
}

const TOOLS = [
  { name: 'querySportRecords', inputSchema: { type: 'object', properties: { beginTime: { type: 'integer', description: 'unix seconds' }, endTime: { type: 'integer', description: 'unix seconds' }, sportType: { type: 'string' } }, required: ['beginTime', 'endTime'] } },
  { name: 'getActivityDetail', inputSchema: { type: 'object', properties: { labelId: { type: 'string' }, sportType: { type: 'string' } }, required: ['labelId', 'sportType'] } },
  { name: 'queryActivityLapData', inputSchema: { type: 'object', properties: { labelId: { type: 'string' }, sportType: { type: 'string' } }, required: ['labelId'] } },
  { name: 'queryUserInfo', inputSchema: { type: 'object', properties: {} } },
];

const SAMPLE_RUN = { labelId: '4321', sportType: 'Running', name: 'Morning Run', startTime: RUN_START, endTime: RUN_START + 2500, startTimezone: -16, distance: 8046, duration: 2400, avgHeartRate: 150.4, maxHeartRate: 172, totalElevation: 30 };
const SAMPLE_RIDE = { labelId: '4322', mode: 9, startTime: RUN_START + 86400, startTimezone: -16, distance: 30000, duration: 3600 };

const fake = () => {
  const calls: Call[] = [];
  const state = {
    accessOk: (token: string) => token === 'a1' || token === 'a2',
    tokenAnswer: { access_token: 'a1', refresh_token: 'r1', expires_in: 2592000, scope: 'openid mcp.tools offline_access', id_token: jwt({ sub: 'coros-42' }) } as Record<string, unknown>,
    register: { client_id: 'dyn-1' } as Record<string, unknown> | null,
    sse: false,
    mcpStatus: 0,
    tools: {
      queryUserInfo: () => ({ nickname: 'Josh', userId: 'coros-42' }),
      querySportRecords: (a: Record<string, unknown>) => ({ records: [SAMPLE_RUN, SAMPLE_RIDE].filter((r) => r.startTime >= Number(a.beginTime) && r.startTime <= Number(a.endTime)) }),
      getActivityDetail: (a: Record<string, unknown>) => ({ data: { labelId: a.labelId, avgHeartRate: 151, maxHeartRate: 172, avgCadence: 178 } }),
      queryActivityLapData: () => ({ laps: [{ distance: 1609, duration: 480, avgHeartRate: 145 }, { distance: 1609, duration: 470, avgHeartRate: 152 }] }),
    } as Record<string, (a: Record<string, unknown>) => unknown>,
  };
  const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    const headers = Object.fromEntries(Object.entries((init?.headers as Record<string, string>) ?? {}).map(([k, v]) => [k.toLowerCase(), v]));
    const call: Call = { url, method: init?.method ?? 'GET', headers, body: typeof init?.body === 'string' ? init.body : '' };
    calls.push(call);
    if (url === MCP || url === ENDPOINT) {
      const token = /^Bearer (.+)$/.exec(headers.authorization ?? '')?.[1];
      if (!token) return withUrl(new Response('', { status: 401, headers: { 'www-authenticate': `Bearer resource_metadata="${RESOURCE_META}"` } }), ENDPOINT);
      if (state.mcpStatus) return new Response('', { status: state.mcpStatus });
      if (!state.accessOk(token)) return new Response('', { status: 401 });
      const rpc = JSON.parse(call.body) as NonNullable<Call['rpc']>;
      call.rpc = rpc;
      if (rpc.id === undefined) return new Response('', { status: 202 });
      let result: unknown;
      if (rpc.method === 'initialize') result = { protocolVersion: '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'coros', version: '1' } };
      else if (rpc.method === 'tools/list') result = { tools: TOOLS };
      else if (rpc.method === 'tools/call') {
        const tool = state.tools[rpc.params?.name ?? ''];
        if (!tool) return json({ jsonrpc: '2.0', id: rpc.id, error: { code: -32602, message: `Unknown tool ${rpc.params?.name}` } });
        result = { content: [{ type: 'text', text: JSON.stringify(tool(rpc.params?.arguments ?? {})) }] };
      } else return json({ jsonrpc: '2.0', id: rpc.id, error: { code: -32601, message: 'Method not found' } });
      const reply = { jsonrpc: '2.0', id: rpc.id, result };
      if (state.sse) return new Response(`: keep-alive\n\nevent: ping\ndata: {}\n\nevent: message\ndata: ${JSON.stringify(reply)}\n\n`, { status: 200, headers: { 'content-type': 'text/event-stream' } });
      return json(reply);
    }
    if (url === RESOURCE_META || url === `${REGION}/.well-known/oauth-protected-resource`) return json({ resource: REGION, authorization_servers: [REGION], scopes_supported: ['openid', 'mcp.tools', 'offline_access'], bearer_methods_supported: ['header'] });
    if (url === `${REGION}/.well-known/oauth-authorization-server`)
      return json({ issuer: REGION, authorization_endpoint: `${REGION}/oauth2/authorize`, token_endpoint: `${REGION}/oauth2/token`, device_authorization_endpoint: `${REGION}/oauth2/device_authorization`, revocation_endpoint: `${REGION}/oauth2/revoke`, registration_endpoint: `${REGION}/connect/register`, code_challenge_methods_supported: ['S256'], grant_types_supported: ['authorization_code', 'refresh_token', 'urn:ietf:params:oauth:grant-type:device_code'], token_endpoint_auth_methods_supported: ['none', 'client_secret_basic'] });
    if (url === `${REGION}/connect/register`) return state.register ? json(state.register, 201) : json({ error: 'invalid_client_metadata', error_description: 'registration is closed' }, 400);
    if (url === `${REGION}/oauth2/token`) return json(state.tokenAnswer);
    if (url === `${REGION}/oauth2/revoke`) return new Response('', { status: 200 });
    return new Response('not found', { status: 404 });
  });
  vi.stubGlobal('fetch', fetchMock);
  return { calls, state, form: (c: Call) => Object.fromEntries(new URLSearchParams(c.body)) };
};

const connectRow = (db: DB, userId: string, extra: Partial<typeof providerConnections.$inferInsert> = {}) =>
  db.insert(providerConnections).values({ userId, provider: 'coros', externalAthleteId: 'coros-42', athleteName: 'Josh', accessToken: 'a1', refreshToken: 'r1', expiresAt: Math.floor(Date.now() / 1000) + 3600, scope: null, cursor: null, lastSyncAt: null, lastError: null, status: 'ok', connectedAt: new Date().toISOString(), ...extra }).run();

let db: DB;
let app: ReturnType<typeof buildApp>;
let cookie = '';
let userId = '';
const wasConfigured = env.corosConfigured;
const wasClientId = env.COROS_CLIENT_ID;

beforeEach(async () => {
  resetOAuthCache();
  resetMcp();
  resetCoros();
  corosBucket.reset();
  env.allowSetup = true;
  env.corosConfigured = true;
  env.COROS_CLIENT_ID = undefined;
  db = openDatabase(':memory:').db;
  app = buildApp(db);
  const res = await app.request('/api/auth/setup', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'josh@example.com', password: 'password123' }) });
  cookie = (res.headers.get('set-cookie') ?? '').split(';')[0]!;
  const me = await app.request('/api/me', { headers: { cookie } });
  userId = ((await me.json()) as { id: string }).id;
});
afterEach(() => {
  vi.unstubAllGlobals();
  env.corosConfigured = wasConfigured;
  env.COROS_CLIENT_ID = wasClientId;
});

const settle = async (until: () => boolean, ms = 2000) => {
  const t0 = Date.now();
  while (!until() && Date.now() - t0 < ms) await new Promise((r) => setTimeout(r, 10));
};

describe('discovery', () => {
  it('follows the 401’s resource_metadata to the authorization server, lands on the regional endpoint, and caches', async () => {
    const f = fake();
    const d = await discover(MCP);
    expect(d).toMatchObject({ endpoint: ENDPOINT, resource: REGION, issuer: REGION, authorizationEndpoint: `${REGION}/oauth2/authorize`, tokenEndpoint: `${REGION}/oauth2/token`, registrationEndpoint: `${REGION}/connect/register`, revocationEndpoint: `${REGION}/oauth2/revoke` });
    expect(f.calls.map((c) => c.url)).toEqual([MCP, RESOURCE_META, `${REGION}/.well-known/oauth-authorization-server`]);
    await discover(MCP);
    expect(f.calls).toHaveLength(3);
  });
});

describe('client registration', () => {
  it('registers once as a public client and keeps the result in provider_clients', async () => {
    const f = fake();
    const d = await discover(MCP);
    const c1 = await ensureClient(db, 'coros', d, 'openid mcp.tools offline_access');
    const c2 = await ensureClient(db, 'coros', d, 'openid mcp.tools offline_access');
    expect(c1).toEqual({ clientId: 'dyn-1', clientSecret: null });
    expect(c2).toEqual(c1);
    const regs = f.calls.filter((c) => c.url.endsWith('/connect/register'));
    expect(regs).toHaveLength(1);
    expect(JSON.parse(regs[0]!.body)).toMatchObject({ token_endpoint_auth_method: 'none', redirect_uris: [`${env.APP_URL}/api/connections/coros/callback`], grant_types: ['authorization_code', 'refresh_token'], scope: 'openid mcp.tools offline_access' });
    expect(db.select().from(providerClients).all()).toEqual([expect.objectContaining({ provider: 'coros', issuer: REGION, clientId: 'dyn-1', redirectUri: `${env.APP_URL}/api/connections/coros/callback` })]);
  });

  it('falls back to COROS_CLIENT_ID when registration is refused, and says what to do without one', async () => {
    const f = fake();
    f.state.register = null;
    const d = await discover(MCP);
    await expect(ensureClient(db, 'coros', d, 'x')).rejects.toMatchObject({ code: 'not_configured', message: expect.stringMatching(/registration is closed.*COROS_CLIENT_ID/) });
    expect(await ensureClient(db, 'coros', d, 'x', { envClientId: 'manual', envClientSecret: 's' })).toEqual({ clientId: 'manual', clientSecret: 's' });
    expect(f.calls.filter((c) => c.url.endsWith('/connect/register'))).toHaveLength(1);
  });
});

describe('the OAuth dance', () => {
  it('carries the PKCE verifier through the signed state, sends it with the code, and identifies the account', async () => {
    const f = fake();
    const redirect = await app.request('/api/connections/coros/connect', { headers: { cookie }, redirect: 'manual' });
    expect(redirect.status).toBe(302);
    const u = new URL(redirect.headers.get('location')!);
    expect(u.origin + u.pathname).toBe(`${REGION}/oauth2/authorize`);
    expect(Object.fromEntries(u.searchParams)).toMatchObject({ response_type: 'code', client_id: 'dyn-1', code_challenge_method: 'S256', scope: 'openid mcp.tools offline_access', resource: REGION, redirect_uri: `${env.APP_URL}/api/connections/coros/callback` });
    const challenge = u.searchParams.get('code_challenge')!;
    const state = u.searchParams.get('state')!;
    // the state is opaque about the verifier: it is sealed, never the raw string
    expect(state).not.toContain(challenge);
    // a tampered state is refused
    const bad = await app.request(`/api/connections/coros/callback?code=abc&state=${state.slice(0, -2)}xx`, { redirect: 'manual' });
    expect(bad.headers.get('location')).toBe('/settings?coros=error&reason=state');
    const cb = await app.request(`/api/connections/coros/callback?code=abc&state=${encodeURIComponent(state)}`, { redirect: 'manual' });
    expect(cb.headers.get('location')).toBe('/settings?coros=connected');
    const token = f.calls.find((c) => c.url.endsWith('/oauth2/token'))!;
    const body = f.form(token);
    expect(body).toMatchObject({ grant_type: 'authorization_code', code: 'abc', client_id: 'dyn-1', redirect_uri: `${env.APP_URL}/api/connections/coros/callback`, resource: REGION });
    expect(body.client_secret).toBeUndefined();
    expect(createHash('sha256').update(body.code_verifier!).digest('base64url')).toBe(challenge);
    const conn = db.select().from(providerConnections).where(eq(providerConnections.userId, userId)).get()!;
    expect(conn).toMatchObject({ provider: 'coros', externalAthleteId: 'coros-42', athleteName: 'Josh', accessToken: 'a1', refreshToken: 'r1', scope: 'openid mcp.tools offline_access' });
    expect(conn.expiresAt - Math.floor(Date.now() / 1000)).toBeGreaterThan(2592000 - 60);
    // the connect kicked off the first sync in the background
    await settle(() => !!db.select().from(providerConnections).where(eq(providerConnections.userId, userId)).get()?.lastSyncAt);
    expect(db.select().from(activities).where(eq(activities.userId, userId)).all().map((a) => a.externalId).sort()).toEqual(['4321', '4322']);
  });

  it('rotates the refresh token and stores the new pair; a public client sends no secret', async () => {
    const f = fake();
    connectRow(db, userId, { expiresAt: Math.floor(Date.now() / 1000) - 10 });
    f.state.tokenAnswer = { access_token: 'a2', refresh_token: 'r2', expires_in: 2592000 };
    await syncConnection(db, userId, 'coros', { detailLimit: 0 });
    const token = f.calls.find((c) => c.url.endsWith('/oauth2/token'))!;
    expect(f.form(token)).toEqual({ grant_type: 'refresh_token', refresh_token: 'r1', client_id: 'dyn-1', resource: REGION });
    expect(db.select().from(providerConnections).where(eq(providerConnections.userId, userId)).get()).toMatchObject({ accessToken: 'a2', refreshToken: 'r2', status: 'ok' });
    // the calls that followed carried the new token
    expect(f.calls.filter((c) => c.url === ENDPOINT && c.rpc?.method === 'tools/call').every((c) => c.headers.authorization === 'Bearer a2')).toBe(true);
  });

  it('revokes both tokens on disconnect', async () => {
    const f = fake();
    connectRow(db, userId);
    const res = await app.request('/api/connections/coros/disconnect', { method: 'POST', headers: { cookie } });
    expect(((await res.json()) as { connected: boolean }).connected).toBe(false);
    const revokes = f.calls.filter((c) => c.url.endsWith('/oauth2/revoke')).map((c) => f.form(c));
    expect(revokes).toEqual([{ token: 'r1', token_type_hint: 'refresh_token', client_id: 'dyn-1' }, { token: 'a1', token_type_hint: 'access_token', client_id: 'dyn-1' }]);
  });
});

describe('the sync through MCP', () => {
  it('initializes once, takes the tools’ argument names from their schemas, walks the window in 30-day steps, and maps records to activities', async () => {
    const f = fake();
    connectRow(db, userId);
    const r = await syncConnection(db, userId, 'coros', { detailLimit: 5 });
    expect(r.changed).toBe(3); // two activities, one detail (the run)
    const rpc = f.calls.filter((c) => c.url === ENDPOINT && c.rpc).map((c) => c.rpc!);
    expect(rpc.filter((m) => m.method === 'initialize')).toHaveLength(1);
    expect(rpc.filter((m) => m.method === 'notifications/initialized')).toHaveLength(1);
    expect(rpc.filter((m) => m.method === 'tools/list')).toHaveLength(1);
    const lists = rpc.filter((m) => m.method === 'tools/call' && m.params?.name === 'querySportRecords').map((m) => m.params!.arguments!);
    expect(lists).toHaveLength(5); // 120 days + tomorrow, 30 at a time
    expect(lists[0]).toEqual({ beginTime: expect.any(Number), endTime: expect.any(Number) });
    expect(Math.abs(lists[0]!.beginTime as number - (Date.now() / 1000 - 120 * 86400))).toBeLessThan(120);
    expect((lists[0]!.endTime as number) - (lists[0]!.beginTime as number)).toBe(30 * 86400 - 1);
    expect(lists[1]!.beginTime).toBe((lists[0]!.endTime as number) + 1);
    expect(f.calls.filter((c) => c.url === ENDPOINT && c.rpc).every((c) => c.headers['mcp-protocol-version'] === '2025-06-18' && c.headers.accept === 'application/json, text/event-stream')).toBe(true);
    const rows = db.select().from(activities).where(eq(activities.userId, userId)).all().sort((a, b) => a.externalId.localeCompare(b.externalId));
    expect(rows[0]).toMatchObject({ id: 'coros_4321', provider: 'coros', externalId: '4321', date: RUN_DAY, time: '02:30', name: 'Morning Run', sportType: 'Running', kind: 'run', distanceM: 8046, movingSec: 2400, elapsedSec: 2500, elevM: 30, avgHr: 151, maxHr: 172, cadence: 178, lapsJson: '[[1609,480,145],[1609,470,152]]', perfAt: expect.any(String) });
    expect(rows[1]).toMatchObject({ externalId: '4322', sportType: 'Ride', kind: 'cross', date: RIDE_DAY, distanceM: 30000, movingSec: 3600, elapsedSec: 3600, avgHr: null });
    // the detail asked for the label id with the sport type the listing gave
    const detail = rpc.find((m) => m.params?.name === 'getActivityDetail')!.params!.arguments;
    expect(detail).toEqual({ labelId: '4321', sportType: 'Running' });
    expect(rpc.find((m) => m.params?.name === 'queryActivityLapData')!.params!.arguments).toEqual({ labelId: '4321', sportType: 'Running' });
    expect(db.select().from(providerConnections).where(eq(providerConnections.userId, userId)).get()).toMatchObject({ status: 'ok', lastError: null, lastSyncAt: expect.any(String) });
  });

  it('reads an SSE-bodied answer', async () => {
    const f = fake();
    f.state.sse = true;
    const mcp = new McpClient(ENDPOINT, 'a1', 'coros');
    const r = await mcp.callTool('queryUserInfo', {});
    expect(JSON.parse(r.content[0]!.text!)).toEqual({ nickname: 'Josh', userId: 'coros-42' });
    expect(await mcp.listTools()).toHaveLength(4);
  });

  it('marks the connection needs_reauth on a 401 and rate_limited on a 429', async () => {
    const f = fake();
    connectRow(db, userId, { accessToken: 'expired' });
    await expect(syncConnection(db, userId, 'coros')).rejects.toMatchObject({ code: 'needs_reauth' });
    expect(db.select().from(providerConnections).where(eq(providerConnections.userId, userId)).get()!.status).toBe('needs_reauth');
    db.update(providerConnections).set({ status: 'ok', accessToken: 'a1' }).where(eq(providerConnections.userId, userId)).run();
    resetMcp();
    f.state.mcpStatus = 429;
    await expect(syncConnection(db, userId, 'coros')).rejects.toMatchObject({ code: 'rate_limited' });
    expect(corosBucket.remaining()).toBe(0);
  });

  it('is a provider with no webhook and a sync-only authorize URL', async () => {
    expect(corosProvider.parseWebhook({ sportDataList: [{ openId: 'x', labelId: 1 }] }, new Headers())).toEqual([]);
    expect(() => corosProvider.authorizeUrl('s')).toThrow(ProviderError);
    fake();
    expect(await corosAuthorizeUrl(db, (sealed) => `state.${sealed}`)).toMatch(/[?&]state=state\.[A-Za-z0-9_-]+&/);
  });
});

describe('the record adapter', () => {
  it('reads the likely names for a start, in a unix time with a quarter-hour zone, a string with its own offset, or a bare day', () => {
    expect(mapActivity({ labelId: 'L1', mode: 8, startTime: 1761892200, startTimezone: -16, distance: 8000, duration: 2400, avgHeartRate: 150, totalElevation: 30 })).toMatchObject({ externalId: 'L1', sportType: 'Run', startLocal: '2025-10-31T02:30', distanceM: 8000, movingSec: 2400, avgHr: 150, elevM: 30 });
    expect(mapActivity({ id: 7, sport: 'TrailRun', startTime: '2026-10-30T06:30:00+08:00', distanceKm: 5.2, movingTime: 1500, elevationGain: 12 })).toMatchObject({ externalId: '7', sportType: 'TrailRun', startLocal: '2026-10-30T06:30', distanceM: 5200, movingSec: 1500, elevM: 12 });
    expect(mapActivity({ activityId: 'x', startTime: 1761892200 * 1000, timezone: 'Europe/Paris' })).toMatchObject({ startLocal: '2025-10-31T07:30', name: 'Workout', sportType: 'Workout' });
    expect(mapActivity({ labelId: 'd', date: '20261031' }).startLocal).toBe('2026-10-31T00:00');
    expect(mapActivity({ labelId: 'z', startTime: '2026-10-31T06:30:00Z', startTimezone: 32 }).startLocal).toBe('2026-10-31T14:30');
    const nothing = mapActivity({ foo: 'bar' });
    expect(nothing.externalId).toBe('');
    expect(nothing.startLocal).toBe('');
  });
});
