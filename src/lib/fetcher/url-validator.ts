import { promises as dns } from 'dns';

// --- Blocked hostnames ---

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'metadata.google.internal',
]);

const BLOCKED_HOSTNAME_SUFFIXES = [
  '.local',
  '.localhost',
  '.internal',
];

// --- IPv4 CIDR range checking ---

interface IPv4Range {
  network: number;
  mask: number;
}

function ipv4ToNumber(ip: string): number {
  const parts = ip.split('.').map(Number);
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

function cidrToMask(prefix: number): number {
  return (~0 << (32 - prefix)) >>> 0;
}

const BLOCKED_IPV4_RANGES: IPv4Range[] = [
  { network: ipv4ToNumber('127.0.0.0'),   mask: cidrToMask(8) },   // Loopback
  { network: ipv4ToNumber('10.0.0.0'),    mask: cidrToMask(8) },   // Private Class A
  { network: ipv4ToNumber('172.16.0.0'),  mask: cidrToMask(12) },  // Private Class B
  { network: ipv4ToNumber('192.168.0.0'), mask: cidrToMask(16) },  // Private Class C
  { network: ipv4ToNumber('169.254.0.0'), mask: cidrToMask(16) },  // Link-local / AWS metadata
  { network: ipv4ToNumber('0.0.0.0'),     mask: cidrToMask(8) },   // "This" network
  { network: ipv4ToNumber('100.64.0.0'),  mask: cidrToMask(10) },  // Carrier-grade NAT
  { network: ipv4ToNumber('192.0.0.0'),   mask: cidrToMask(24) },  // IETF protocol assignments
  { network: ipv4ToNumber('198.18.0.0'),  mask: cidrToMask(15) },  // Benchmark testing
];

function isBlockedIPv4(ip: string): boolean {
  const num = ipv4ToNumber(ip);
  return BLOCKED_IPV4_RANGES.some(
    (range) => (num & range.mask) === (range.network & range.mask)
  );
}

function isBlockedIPv6(ip: string): boolean {
  // Strip brackets if present (URL parser keeps them for IPv6 literals)
  const stripped = ip.replace(/^\[|\]$/g, '');
  const normalized = stripped.toLowerCase();
  if (normalized === '::1' || normalized === '::') return true;
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;  // ULA
  if (normalized.startsWith('fe80')) return true;  // Link-local

  // IPv4-mapped IPv6 (::ffff:x.x.x.x)
  const v4mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (v4mapped) return isBlockedIPv4(v4mapped[1]);

  return false;
}

function isIPv4Literal(hostname: string): boolean {
  return /^\d+\.\d+\.\d+\.\d+$/.test(hostname);
}

function isIPv6Literal(hostname: string): boolean {
  return hostname.includes(':');
}

// --- Public API ---

export type ValidationResult =
  | { valid: true; url: URL }
  | { valid: false; reason: string };

/**
 * Synchronous URL validation (protocol, hostname, IP literal checks).
 * Use validateUrlWithDns() for full protection including DNS resolution.
 */
export function validateUrl(urlString: string): ValidationResult {
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    return { valid: false, reason: 'Invalid URL format' };
  }

  // Protocol check
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { valid: false, reason: 'Only HTTP and HTTPS are allowed' };
  }

  // Block credentials in URL
  if (url.username || url.password) {
    return { valid: false, reason: 'URLs with credentials are not allowed' };
  }

  const hostname = url.hostname.toLowerCase();

  // Hostname blocklist
  if (BLOCKED_HOSTNAMES.has(hostname)) {
    return { valid: false, reason: 'This hostname is not allowed' };
  }
  for (const suffix of BLOCKED_HOSTNAME_SUFFIXES) {
    if (hostname.endsWith(suffix)) {
      return { valid: false, reason: 'This hostname is not allowed' };
    }
  }

  // IP literal checks
  if (isIPv4Literal(hostname)) {
    if (isBlockedIPv4(hostname)) {
      return { valid: false, reason: 'This IP address is not allowed' };
    }
  } else if (isIPv6Literal(hostname)) {
    if (isBlockedIPv6(hostname)) {
      return { valid: false, reason: 'This IP address is not allowed' };
    }
  }

  return { valid: true, url };
}

/**
 * Full URL validation including DNS resolution.
 * Resolves the hostname and checks all returned IPs against blocked ranges.
 * Catches domains like evil.com that resolve to 127.0.0.1.
 */
export async function validateUrlWithDns(urlString: string): Promise<ValidationResult> {
  const syncResult = validateUrl(urlString);
  if (!syncResult.valid) return syncResult;

  const hostname = syncResult.url.hostname.toLowerCase();

  // Skip DNS check for IP literals (already checked synchronously)
  if (isIPv4Literal(hostname) || isIPv6Literal(hostname)) {
    return syncResult;
  }

  // DNS resolution check
  try {
    const [ipv4Result, ipv6Result] = await Promise.allSettled([
      dns.resolve4(hostname),
      dns.resolve6(hostname),
    ]);

    const allIPs: string[] = [];
    if (ipv4Result.status === 'fulfilled') allIPs.push(...ipv4Result.value);
    if (ipv6Result.status === 'fulfilled') allIPs.push(...ipv6Result.value);

    if (allIPs.length === 0) {
      return { valid: false, reason: 'Domain does not resolve to any IP address' };
    }

    for (const ip of allIPs) {
      const blocked = isIPv4Literal(ip) ? isBlockedIPv4(ip) : isBlockedIPv6(ip);
      if (blocked) {
        return { valid: false, reason: 'This domain resolves to a blocked IP address' };
      }
    }
  } catch {
    return { valid: false, reason: 'Could not resolve domain name' };
  }

  return syncResult;
}
