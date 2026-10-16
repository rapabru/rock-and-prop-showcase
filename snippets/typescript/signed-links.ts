/**
 * Signed, expiring links for "Is this listing still available?" emails.
 *
 *   <request id>.<expiry, unix seconds>.<HMAC-SHA256, base64url>
 *
 * Nobody can forge a link or stretch its expiry. Opening the link is
 * read-only: mail scanners open links on their own, so every *answer* is a
 * POST that carries the token again and is verified again. The database
 * re-checks the expiry and the request once more when it records the answer.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function sign(payload: string, secret: string) {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

export function makeToken(requestId: string, expiresAt: Date, secret: string): string {
  const exp = Math.floor(expiresAt.getTime() / 1000);
  const payload = `${requestId}.${exp}`;
  return `${payload}.${sign(payload, secret)}`;
}

export type TokenCheck =
  | { requestId: string; expiresAt: Date }
  | { refused: 'malformed' | 'signature' | 'expired' };

export function readToken(token: string, secret: string, now = Date.now()): TokenCheck {
  const parts = token.split('.');
  if (parts.length !== 3) return { refused: 'malformed' };
  const [requestId, exp, given] = parts;
  // Validate the shape strictly before doing any crypto.
  if (!UUID.test(requestId) || !/^\d{1,12}$/.test(exp) || !/^[\w-]{43}$/.test(given)) {
    return { refused: 'malformed' };
  }

  // Constant-time comparison: the response time reveals nothing about
  // how many characters of a guessed signature were right.
  const expected = Buffer.from(sign(`${requestId}.${exp}`, secret));
  const actual = Buffer.from(given);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return { refused: 'signature' };
  }

  const expiresAt = new Date(Number(exp) * 1000);
  if (expiresAt.getTime() <= now) return { refused: 'expired' };
  return { requestId, expiresAt };
}
