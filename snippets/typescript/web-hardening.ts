/**
 * Small, boring functions that close common web holes.
 */
import { timingSafeEqual } from 'node:crypto';

/**
 * Scheduled jobs are plain HTTP routes protected by a bearer secret.
 * Compared in constant time; no secret configured means no caller is trusted.
 */
export function bearerMatches(header: string | null, secret: string | undefined): boolean {
  if (!secret || !header) return false;
  const expected = Buffer.from(`Bearer ${secret}`, 'utf8');
  const actual = Buffer.from(header, 'utf8');
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/**
 * Open-redirect guard for `?next=` after sign-in: only ever a path on this
 * site. The value is resolved the way a browser would — which reads "\" as
 * "/" and drops tabs and newlines, so "/\evil.com" and "/<tab>/evil.com" are
 * other origins — and anything that lands off-site falls back to "/".
 */
const BASE = 'https://example.invalid';

export function safeNext(value: unknown): string {
  if (typeof value !== 'string' || !value.startsWith('/')) return '/';
  let url: URL;
  try {
    url = new URL(value, BASE);
  } catch {
    return '/';
  }
  return url.origin === BASE ? url.pathname + url.search + url.hash : '/';
}

/**
 * CSV export without formula injection: a cell starting with = + - @ (after
 * optional spaces, which some spreadsheets trim) or a tab/CR could run as a
 * formula when an agent opens the file. Such text gets a leading apostrophe.
 * The importer uses the same test to read the guard back.
 */
export function looksLikeFormula(text: string): boolean {
  return /^(\s*[=+\-@]|[\t\r])/.test(text);
}

export function csvCell(value: string | number | boolean): string {
  const text = String(value);
  const safe = typeof value === 'string' && looksLikeFormula(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`; // RFC 4180
}
