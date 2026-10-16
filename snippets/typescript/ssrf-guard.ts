/**
 * SSRF guard for a "paste a link and we import the listing" feature.
 *
 * The URL is user input, so the server must never be talked into reading
 * anything but a public website. The address is checked twice:
 *   1. statically, before any request (scheme, port, credentials, hostname);
 *   2. at connect time, on the exact IP the socket is about to use, so a
 *      DNS name that changes its answer between check and request
 *      (DNS rebinding) cannot slip through.
 * Every redirect goes through the same two checks.
 */
import { lookup as dnsLookup } from 'node:dns';
import { BlockList, isIP, type LookupFunction } from 'node:net';

export class FetchRefused extends Error {}

// ------------------------------------------------- what counts as public --

const PRIVATE = new BlockList();
for (const [net, bits] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16], ['172.16.0.0', 12],
  ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24],
  ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4]
] as const) PRIVATE.addSubnet(net, bits, 'ipv4');
for (const [net, bits] of [
  ['::', 128], ['::1', 128], ['fc00::', 7], ['fe80::', 10], ['ff00::', 8], ['2001:db8::', 32], ['100::', 64],
  // 6to4 and Teredo tunnel an IPv4 address inside IPv6; nothing public needs them.
  ['2002::', 16], ['2001::', 32]
] as const) PRIVATE.addSubnet(net, bits, 'ipv6');

/** True for any address a server-side request must never reach. */
export function isPrivateAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return PRIVATE.check(address, 'ipv4');
  if (family !== 6) return true; // not an IP at all: refuse
  const lower = address.toLowerCase();
  // An IPv4 address embedded in IPv6 (mapped, or NAT64) is judged as IPv4.
  const embedded = lower.match(/^(?:::ffff:|64:ff9b::)(\d+\.\d+\.\d+\.\d+)$/)?.[1];
  if (embedded) return isPrivateAddress(embedded);
  if (lower.startsWith('::ffff:') || lower.startsWith('64:ff9b:')) return true;
  return PRIVATE.check(address, 'ipv6');
}

// ------------------------------------------------------ static URL check --

export function checkUrl(raw: string): { url: URL } | { refused: string } {
  let url: URL;
  try { url = new URL(raw); } catch { return { refused: 'Not a web address.' }; }
  const host = url.hostname.toLowerCase();
  if (url.protocol !== 'https:') return { refused: 'Only https:// links are accepted.' };
  if (url.port && url.port !== '443') return { refused: 'Non-standard ports are not read.' };
  if (url.username || url.password) return { refused: 'Links with credentials are refused.' };
  if (isIP(host.replace(/^\[|\]$/g, ''))) return { refused: 'Paste the listing link, not an IP.' };
  if (!host.includes('.') || host === 'localhost' || /\.(local|localhost|internal|lan|home|corp)$/.test(host)) {
    return { refused: 'That is not a public website.' };
  }
  return { url };
}

// ------------------------------------------------- connect-time DNS check --

/**
 * Passed as `lookup` to https.request: the socket only ever connects to an
 * address that was verified as public in this very lookup. If *any* record
 * is private the whole name is refused (a mixed answer is a rebinding tell).
 */
export const publicLookup: LookupFunction = (hostname, options, callback) => {
  dnsLookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err, '', 0);
    const list = addresses as { address: string; family: number }[];
    const safe = list.filter(a => !isPrivateAddress(a.address));
    if (safe.length === 0 || safe.length !== list.length) {
      return callback(new FetchRefused('private address'), '', 0);
    }
    callback(null, safe[0].address, safe[0].family);
  });
};

// Elsewhere in the fetcher (omitted): a hard size cap, a total-time budget
// (not just a socket idle timeout), max 3 redirects each re-checked with
// checkUrl(), robots.txt honoured, and images verified by magic bytes.
