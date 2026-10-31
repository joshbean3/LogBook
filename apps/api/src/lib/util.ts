import { randomBytes } from 'node:crypto';
import { HTTPException } from 'hono/http-exception';
import type { ZodType } from 'zod';

const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
/** Short, URL-safe, time-sortable-enough ids. */
export const uid = (prefix = '', len = 12): string => {
  const bytes = randomBytes(len);
  let out = prefix;
  for (let i = 0; i < len; i++) out += ALPHABET[(bytes[i] as number) % ALPHABET.length];
  return out;
};

export const nowISO = (): string => new Date().toISOString();

export class ApiError extends HTTPException {
  constructor(status: 400 | 401 | 403 | 404 | 409 | 413 | 422 | 429 | 500 | 502 | 503, message: string, public code?: string) {
    super(status, { message });
  }
}

export const parseBody = async <T>(req: Request, schema: ZodType<T>): Promise<T> => {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new ApiError(400, 'Body must be JSON');
  }
  const r = schema.safeParse(raw);
  if (!r.success) throw new ApiError(422, r.error.issues.map((i) => `${i.path.join('.') || 'body'}: ${i.message}`).join('; '), 'validation');
  return r.data;
};

export const parseQuery = <T>(query: Record<string, string | undefined>, schema: ZodType<T>): T => {
  const r = schema.safeParse(query);
  if (!r.success) throw new ApiError(422, r.error.issues.map((i) => `${i.path.join('.') || 'query'}: ${i.message}`).join('; '), 'validation');
  return r.data;
};

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
export const round1 = (v: number) => Math.round(v * 10) / 10;
export const round2 = (v: number) => Math.round(v * 100) / 100;
