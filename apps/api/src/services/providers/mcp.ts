import { ProviderError, type ProviderId } from './types.js';
import type { TokenBucket } from './bucket.js';

/**
 * A minimal MCP client over streamable HTTP: JSON-RPC 2.0 POSTs with a bearer token, answered as JSON or as an SSE
 * stream (the final `message` event carries the response). `initialize` runs once per process and endpoint (the servers
 * this talks to are stateless; a session id they hand back is echoed anyway), then `tools/list` and `tools/call`.
 * HTTP 401/403 is `needs_reauth`, 429 is `rate_limited`, anything else that fails is `unavailable`.
 */

export const MCP_PROTOCOL_VERSION = '2025-06-18';

export interface McpTool {
  name: string;
  description?: string;
  inputSchema?: { type?: string; properties?: Record<string, { type?: string | string[]; format?: string; description?: string; enum?: unknown[] }>; required?: string[] };
}

export interface ToolResult {
  content: Array<{ type: string; text?: string; [k: string]: unknown }>;
  structuredContent?: unknown;
  isError?: boolean;
}

interface JsonRpcResponse {
  jsonrpc?: string;
  id?: number | string | null;
  result?: unknown;
  error?: { code?: number; message?: string; data?: unknown };
}

const initialized = new Map<string, Promise<string | null>>();
/** Tests: forget every initialized endpoint. */
export const resetMcp = () => initialized.clear();

/** The SSE body's JSON-RPC messages, in order: `data:` lines of each `message` (or untyped) event, joined per event. */
export const parseSse = (text: string): JsonRpcResponse[] => {
  const out: JsonRpcResponse[] = [];
  for (const block of text.split(/\r?\n\r?\n/)) {
    let event = 'message';
    const data: string[] = [];
    for (const line of block.split(/\r?\n/)) {
      if (line.startsWith(':')) continue;
      const i = line.indexOf(':');
      const field = i < 0 ? line : line.slice(0, i);
      const value = i < 0 ? '' : line.slice(i + 1).replace(/^ /, '');
      if (field === 'event') event = value;
      else if (field === 'data') data.push(value);
    }
    if (event !== 'message' || !data.length) continue;
    try {
      const parsed = JSON.parse(data.join('\n')) as JsonRpcResponse | JsonRpcResponse[];
      out.push(...(Array.isArray(parsed) ? parsed : [parsed]));
    } catch {
      /* a keep-alive or a partial line: not ours */
    }
  }
  return out;
};

let nextId = 1;

export class McpClient {
  constructor(
    readonly endpoint: string,
    private readonly token: string,
    private readonly provider: ProviderId,
    private readonly bucket?: TokenBucket,
  ) {}

  private fail(message: string, code: ProviderError['code'] = 'unavailable'): never {
    throw new ProviderError(message, code, this.provider);
  }

  /** One JSON-RPC exchange. A notification (`id` null) expects no answer and returns null. */
  private async post(method: string, params: Record<string, unknown> | undefined, opts: { notification?: boolean; sessionId?: string | null } = {}): Promise<{ result: unknown; sessionId: string | null }> {
    this.bucket?.take();
    const id = opts.notification ? null : nextId++;
    const headers: Record<string, string> = {
      authorization: `Bearer ${this.token}`,
      accept: 'application/json, text/event-stream',
      'content-type': 'application/json',
      'mcp-protocol-version': MCP_PROTOCOL_VERSION,
    };
    if (opts.sessionId) headers['mcp-session-id'] = opts.sessionId;
    const body = opts.notification ? { jsonrpc: '2.0', method, params } : { jsonrpc: '2.0', id, method, params };
    let res: Response;
    try {
      res = await fetch(this.endpoint, { method: 'POST', headers, body: JSON.stringify(body) });
    } catch (e) {
      this.fail(`${this.provider}'s MCP server is unreachable: ${e instanceof Error ? e.message : e}`);
    }
    const sessionId = res.headers.get('mcp-session-id');
    if (res.status === 401 || res.status === 403) this.fail(`${this.provider} access was revoked or expired. Reconnect it.`, 'needs_reauth');
    if (res.status === 429) {
      this.bucket?.backoff();
      this.fail(`${this.provider} rate limit reached. Try again later.`, 'rate_limited');
    }
    if (opts.notification) {
      await res.body?.cancel().catch(() => undefined);
      return { result: null, sessionId };
    }
    if (!res.ok) this.fail(`${this.provider}'s MCP server returned ${res.status} for ${method}`);
    const text = await res.text();
    const type = res.headers.get('content-type') ?? '';
    let messages: JsonRpcResponse[];
    if (type.includes('text/event-stream')) messages = parseSse(text);
    else {
      try {
        const parsed = JSON.parse(text) as JsonRpcResponse | JsonRpcResponse[];
        messages = Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        this.fail(`${this.provider}'s MCP server answered ${method} with something that is not JSON`);
      }
    }
    const reply = messages.filter((m) => m && typeof m === 'object' && ('result' in m || 'error' in m)).find((m) => m.id === id) ?? messages.filter((m) => m && ('result' in m || 'error' in m)).at(-1);
    if (!reply) this.fail(`${this.provider}'s MCP server gave no answer to ${method}`);
    if (reply.error) {
      const msg = reply.error.message ?? `error ${reply.error.code}`;
      if (/unauthori[sz]ed|invalid.?token|expired/i.test(msg)) this.fail(`${this.provider}: ${msg}`, 'needs_reauth');
      this.fail(`${this.provider} MCP ${method} failed: ${msg}`);
    }
    return { result: reply.result, sessionId };
  }

  /** Once per process and endpoint: `initialize`, then the `initialized` notification. Returns the session id, if the server gave one. */
  private session(): Promise<string | null> {
    const hit = initialized.get(this.endpoint);
    if (hit) return hit;
    const run = (async () => {
      const { sessionId } = await this.post('initialize', { protocolVersion: MCP_PROTOCOL_VERSION, capabilities: {}, clientInfo: { name: 'logbook', version: '1.0.0' } });
      await this.post('notifications/initialized', undefined, { notification: true, sessionId }).catch(() => undefined);
      return sessionId;
    })().catch((e) => {
      initialized.delete(this.endpoint);
      throw e;
    });
    initialized.set(this.endpoint, run);
    return run;
  }

  async listTools(): Promise<McpTool[]> {
    const sessionId = await this.session();
    const { result } = await this.post('tools/list', {}, { sessionId });
    const tools = (result as { tools?: unknown } | null)?.tools;
    return Array.isArray(tools) ? (tools as McpTool[]).filter((t) => t && typeof t.name === 'string') : [];
  }

  /** `tools/call`; a result flagged `isError` is `unavailable` with the tool's text. */
  async callTool(name: string, args: Record<string, unknown>): Promise<ToolResult> {
    const sessionId = await this.session();
    const { result } = await this.post('tools/call', { name, arguments: args }, { sessionId });
    const r = (result ?? {}) as Partial<ToolResult>;
    const out: ToolResult = { content: Array.isArray(r.content) ? r.content : [], structuredContent: r.structuredContent, isError: r.isError };
    if (out.isError) {
      const msg = toolText(out).slice(0, 300) || 'the tool reported an error';
      if (/unauthori[sz]ed|invalid.?token|expired|login/i.test(msg)) this.fail(`${this.provider}: ${msg}`, 'needs_reauth');
      this.fail(`${this.provider} ${name}: ${msg}`);
    }
    return out;
  }
}

/** The text parts of a tool result, joined. */
export const toolText = (r: ToolResult): string =>
  r.content
    .filter((c) => c.type === 'text' && typeof c.text === 'string')
    .map((c) => c.text as string)
    .join('\n');

/** What a tool handed back as data: its structured content, else its text parsed as JSON, else the text itself. */
export const toolData = (r: ToolResult): unknown => {
  if (r.structuredContent !== undefined && r.structuredContent !== null) return r.structuredContent;
  const text = toolText(r).trim();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};
