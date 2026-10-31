import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import type { DB } from '../../db/index.js';
import { providerClients } from '../../db/schema.js';
import { env } from '../../env.js';
import { nowISO } from '../../lib/util.js';
import { ProviderError, type ConnectionRow, type ProviderId } from './types.js';

/**
 * The OAuth 2.1 client an MCP server expects: discovery (RFC 9728 protected-resource metadata, reached through the
 * server's 401 or its well-known path, then RFC 8414 authorization-server metadata), dynamic client registration
 * (RFC 7591, cached in `provider_clients`), PKCE S256, the code exchange, rotating refresh tokens and revocation.
 * Nothing here knows COROS; `coros.ts` is the one caller today.
 */

const zResource = z.looseObject({ resource: z.string().optional(), authorization_servers: z.array(z.string()).optional() });
const zServer = z.looseObject({
  issuer: z.string(),
  authorization_endpoint: z.string(),
  token_endpoint: z.string(),
  registration_endpoint: z.string().optional(),
  revocation_endpoint: z.string().optional(),
  code_challenge_methods_supported: z.array(z.string()).optional(),
  scopes_supported: z.array(z.string()).optional(),
});
const zClient = z.looseObject({ client_id: z.string(), client_secret: z.string().optional() });
const zTokens = z.looseObject({
  access_token: z.string().optional(),
  refresh_token: z.string().optional(),
  expires_in: z.number().optional(),
  scope: z.string().optional(),
  id_token: z.string().optional(),
  error: z.string().optional(),
  error_description: z.string().optional(),
});

export interface Discovery {
  /** The MCP endpoint after any regional redirect: where the JSON-RPC calls go. */
  endpoint: string;
  /** RFC 8707 `resource`, as the protected-resource metadata names it (sent on authorize and token requests). */
  resource: string;
  issuer: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  registrationEndpoint: string | null;
  revocationEndpoint: string | null;
  scopesSupported: string[];
}

export interface OAuthClient {
  clientId: string;
  clientSecret: string | null;
}

export interface TokenSet {
  accessToken: string;
  refreshToken: string | null;
  /** Unix seconds. */
  expiresAt: number;
  scope: string | null;
  idToken: string | null;
}

const DISCOVERY_TTL_MS = 60 * 60_000;
const discoveries = new Map<string, { at: number; value: Promise<Discovery> }>();
/** Tests: forget what was discovered. */
export const resetOAuthCache = () => discoveries.clear();

const unavailable = (provider: ProviderId, msg: string) => new ProviderError(msg, 'unavailable', provider);

const getJson = async <T>(url: string, schema: z.ZodType<T>, provider: ProviderId, what: string): Promise<T | null> => {
  let res: Response;
  try {
    res = await fetch(url, { headers: { accept: 'application/json' } });
  } catch (e) {
    throw unavailable(provider, `${what} is unreachable (${url}): ${e instanceof Error ? e.message : e}`);
  }
  if (res.status === 404) return null;
  if (!res.ok) throw unavailable(provider, `${what} returned ${res.status} (${url})`);
  const parsed = schema.safeParse(await res.json().catch(() => null));
  if (!parsed.success) throw unavailable(provider, `${what} at ${url} is not the metadata expected`);
  return parsed.data;
};

/** RFC 9728 §3.1 / RFC 8414 §3.1: the well-known path goes between the host and any path component. */
const wellKnown = (base: string, suffix: string): string => {
  const u = new URL(base);
  const path = u.pathname.replace(/\/$/, '');
  return `${u.origin}/.well-known/${suffix}${path}`;
};

/** `WWW-Authenticate: Bearer resource_metadata="..."` → the URL, if the header names one. */
export const resourceMetadataUrl = (wwwAuthenticate: string | null): string | null => /resource_metadata="([^"]+)"/.exec(wwwAuthenticate ?? '')?.[1] ?? null;

/**
 * From the MCP URL to the authorization server's endpoints: an unauthenticated GET of the MCP endpoint answers 401 with
 * the protected-resource metadata's URL (and lands on the regional host, which is where the calls then go); that names
 * the authorization server, whose own metadata has the endpoints. Cached for an hour per MCP URL.
 */
export const discover = (mcpUrl: string, provider: ProviderId = 'coros'): Promise<Discovery> => {
  const hit = discoveries.get(mcpUrl);
  if (hit && Date.now() - hit.at < DISCOVERY_TTL_MS) return hit.value;
  const value = discoverNow(mcpUrl, provider).catch((e) => {
    discoveries.delete(mcpUrl);
    throw e;
  });
  discoveries.set(mcpUrl, { at: Date.now(), value });
  return value;
};

const discoverNow = async (mcpUrl: string, provider: ProviderId): Promise<Discovery> => {
  let endpoint = mcpUrl;
  let metaUrl: string | null = null;
  try {
    const probe = await fetch(mcpUrl, { headers: { accept: 'application/json, text/event-stream' } });
    if (probe.url) endpoint = probe.url;
    metaUrl = resourceMetadataUrl(probe.headers.get('www-authenticate'));
    await probe.body?.cancel().catch(() => undefined);
  } catch (e) {
    throw unavailable(provider, `The MCP server is unreachable (${mcpUrl}): ${e instanceof Error ? e.message : e}`);
  }
  const candidates = [metaUrl, wellKnown(endpoint, 'oauth-protected-resource'), `${new URL(endpoint).origin}/.well-known/oauth-protected-resource`].filter((u, i, all): u is string => !!u && all.indexOf(u) === i);
  let resource: z.infer<typeof zResource> | null = null;
  for (const url of candidates) {
    resource = await getJson(url, zResource, provider, 'The protected-resource metadata');
    if (resource) break;
  }
  const authServer = resource?.authorization_servers?.[0] ?? new URL(endpoint).origin;
  const server = (await getJson(wellKnown(authServer, 'oauth-authorization-server'), zServer, provider, 'The authorization-server metadata')) ?? (await getJson(wellKnown(authServer, 'openid-configuration'), zServer, provider, 'The authorization-server metadata'));
  if (!server) throw unavailable(provider, `No authorization-server metadata at ${authServer}`);
  if (server.code_challenge_methods_supported && !server.code_challenge_methods_supported.includes('S256')) throw unavailable(provider, `${server.issuer} does not support PKCE S256`);
  return {
    endpoint,
    resource: resource?.resource ?? new URL(endpoint).origin,
    issuer: server.issuer,
    authorizationEndpoint: server.authorization_endpoint,
    tokenEndpoint: server.token_endpoint,
    registrationEndpoint: server.registration_endpoint ?? null,
    revocationEndpoint: server.revocation_endpoint ?? null,
    scopesSupported: server.scopes_supported ?? [],
  };
};

export const redirectUriFor = (provider: ProviderId) => `${env.APP_URL}/api/connections/${provider}/callback`;

/**
 * The client id to use with an issuer: the one from the environment when the operator set it, else the one registered
 * before (kept in `provider_clients`), else a fresh dynamic registration (public client, PKCE, no secret). A registration
 * made for another redirect URI (APP_URL changed) is replaced. Refused registration with no fallback is `not_configured`.
 */
export const ensureClient = async (db: DB, provider: ProviderId, d: Discovery, scope: string, opts: { envClientId?: string; envClientSecret?: string } = {}): Promise<OAuthClient> => {
  if (opts.envClientId) return { clientId: opts.envClientId, clientSecret: opts.envClientSecret ?? null };
  const redirectUri = redirectUriFor(provider);
  const cached = db.select().from(providerClients).where(and(eq(providerClients.provider, provider), eq(providerClients.issuer, d.issuer))).get();
  if (cached && cached.redirectUri === redirectUri) return { clientId: cached.clientId, clientSecret: cached.clientSecret };
  if (!d.registrationEndpoint) throw new ProviderError(`${d.issuer} does not register clients dynamically. Set ${provider.toUpperCase()}_CLIENT_ID.`, 'not_configured', provider);
  let res: Response;
  try {
    res = await fetch(d.registrationEndpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        client_name: 'Logbook',
        client_uri: env.APP_URL,
        redirect_uris: [redirectUri],
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'],
        token_endpoint_auth_method: 'none',
        scope,
      }),
    });
  } catch (e) {
    throw unavailable(provider, `Client registration at ${d.registrationEndpoint} is unreachable: ${e instanceof Error ? e.message : e}`);
  }
  const body = await res.json().catch(() => null);
  const parsed = zClient.safeParse(body);
  if (!res.ok || !parsed.success) {
    const reason = (body as { error_description?: string; error?: string } | null)?.error_description ?? (body as { error?: string } | null)?.error ?? `HTTP ${res.status}`;
    throw new ProviderError(`${d.issuer} refused to register this server as a client (${reason}). Register one by hand and set ${provider.toUpperCase()}_CLIENT_ID.`, res.status >= 500 ? 'unavailable' : 'not_configured', provider);
  }
  const row = { provider, issuer: d.issuer, clientId: parsed.data.client_id, clientSecret: parsed.data.client_secret ?? null, redirectUri, registeredAt: nowISO() };
  db.insert(providerClients).values(row).onConflictDoUpdate({ target: [providerClients.provider, providerClients.issuer], set: row }).run();
  return { clientId: row.clientId, clientSecret: row.clientSecret };
};

// ---------- PKCE and the sealed verifier ----------

const b64url = (b: Buffer) => b.toString('base64url');

export const newPkce = (): { verifier: string; challenge: string } => {
  const verifier = b64url(randomBytes(32));
  return { verifier, challenge: b64url(createHash('sha256').update(verifier).digest()) };
};

const sealKey = () => createHash('sha256').update(`${env.SESSION_SECRET}:oauth-pkce`).digest();

/**
 * The PKCE verifier and the issuer travel in the OAuth `state` (the only thing that comes back to the callback), so a
 * deploy between connect and callback loses nothing. The state is HMAC-signed by the route; this seals the verifier so
 * the browser that carries it cannot read it (AES-256-GCM under the session secret). Base64url: safe inside the state's
 * dot-separated fields.
 */
export const sealPkce = (p: { verifier: string; issuer: string }): string => {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', sealKey(), iv);
  const ct = Buffer.concat([c.update(JSON.stringify(p), 'utf8'), c.final()]);
  return b64url(Buffer.concat([iv, c.getAuthTag(), ct]));
};

export const openPkce = (sealed: string | null | undefined): { verifier: string; issuer: string } | null => {
  try {
    const buf = Buffer.from(sealed ?? '', 'base64url');
    if (buf.length < 29) return null;
    const d = createDecipheriv('aes-256-gcm', sealKey(), buf.subarray(0, 12));
    d.setAuthTag(buf.subarray(12, 28));
    const json = JSON.parse(Buffer.concat([d.update(buf.subarray(28)), d.final()]).toString('utf8')) as { verifier?: unknown; issuer?: unknown };
    return typeof json.verifier === 'string' && typeof json.issuer === 'string' ? { verifier: json.verifier, issuer: json.issuer } : null;
  } catch {
    return null;
  }
};

// ---------- the authorization code flow ----------

export const authorizeUrl = (d: Discovery, client: OAuthClient, p: { provider: ProviderId; state: string; challenge: string; scope: string }): string => {
  const u = new URL(d.authorizationEndpoint);
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('client_id', client.clientId);
  u.searchParams.set('redirect_uri', redirectUriFor(p.provider));
  u.searchParams.set('scope', p.scope);
  u.searchParams.set('state', p.state);
  u.searchParams.set('code_challenge', p.challenge);
  u.searchParams.set('code_challenge_method', 'S256');
  u.searchParams.set('resource', d.resource);
  return u.toString();
};

const tokenRequest = async (d: Discovery, client: OAuthClient, provider: ProviderId, params: Record<string, string>): Promise<TokenSet> => {
  const form = new URLSearchParams({ ...params, client_id: client.clientId, resource: d.resource });
  if (client.clientSecret) form.set('client_secret', client.clientSecret);
  let res: Response;
  try {
    res = await fetch(d.tokenEndpoint, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' }, body: form.toString() });
  } catch (e) {
    throw unavailable(provider, `The token endpoint is unreachable: ${e instanceof Error ? e.message : e}`);
  }
  const body = zTokens.safeParse(await res.json().catch(() => null));
  if (!res.ok || !body.success || !body.data.access_token) {
    const reason = body.success ? (body.data.error_description ?? body.data.error ?? `HTTP ${res.status}`) : `HTTP ${res.status}`;
    if (res.status === 400 || res.status === 401 || (body.success && body.data.error)) throw new ProviderError(`${provider} rejected the token request: ${reason}`, 'needs_reauth', provider);
    throw unavailable(provider, `${provider}'s token endpoint returned ${res.status}`);
  }
  const t = body.data;
  return {
    accessToken: t.access_token!,
    refreshToken: t.refresh_token ?? null,
    expiresAt: Math.floor(Date.now() / 1000) + (t.expires_in ?? 30 * 86400),
    scope: t.scope ?? null,
    idToken: t.id_token ?? null,
  };
};

export const exchange = (d: Discovery, client: OAuthClient, provider: ProviderId, code: string, verifier: string): Promise<TokenSet> =>
  tokenRequest(d, client, provider, { grant_type: 'authorization_code', code, redirect_uri: redirectUriFor(provider), code_verifier: verifier });

/** Rotating refresh tokens: the answer's new one replaces the row's; an answer without one keeps the old. */
export const refresh = async (d: Discovery, client: OAuthClient, provider: ProviderId, conn: Pick<ConnectionRow, 'refreshToken'>): Promise<TokenSet> => {
  if (!conn.refreshToken) throw new ProviderError(`${provider} issued no refresh token. Reconnect it.`, 'needs_reauth', provider);
  const t = await tokenRequest(d, client, provider, { grant_type: 'refresh_token', refresh_token: conn.refreshToken });
  return { ...t, refreshToken: t.refreshToken ?? conn.refreshToken };
};

/** RFC 7009, best effort: the refresh token (which takes its access tokens with it), then the access token. */
export const revoke = async (d: Discovery, client: OAuthClient, conn: Pick<ConnectionRow, 'accessToken' | 'refreshToken'>): Promise<void> => {
  if (!d.revocationEndpoint) return;
  const tokens: Array<[string, string]> = [];
  if (conn.refreshToken) tokens.push([conn.refreshToken, 'refresh_token']);
  tokens.push([conn.accessToken, 'access_token']);
  for (const [token, hint] of tokens) {
    const form = new URLSearchParams({ token, token_type_hint: hint, client_id: client.clientId });
    if (client.clientSecret) form.set('client_secret', client.clientSecret);
    await fetch(d.revocationEndpoint, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: form.toString() }).catch(() => undefined);
  }
};

/** The `sub` of an OpenID id_token, read without verification: it only names the account the server just issued tokens for. */
export const idTokenSubject = (idToken: string | null): string | null => {
  try {
    const payload = idToken?.split('.')[1];
    if (!payload) return null;
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { sub?: unknown };
    return typeof claims.sub === 'string' && claims.sub ? claims.sub : null;
  } catch {
    return null;
  }
};
