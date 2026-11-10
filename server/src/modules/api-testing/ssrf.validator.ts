import dns from 'node:dns/promises';
import net from 'node:net';
import { env } from '../../config/env.js';

export interface SsrValidationResult {
  isValid: boolean;
  reason?: string;
  resolvedIps?: string[];
}

/**
 * Converts an IPv4 address string to a 32-bit unsigned integer.
 */
function ipv4ToNumber(ip: string): number {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
    return -1;
  }
  return (((parts[0]! << 24) | (parts[1]! << 16) | (parts[2]! << 8) | parts[3]!) >>> 0);
}

/**
 * Checks whether an IPv4 address is Cloud Metadata / Link-Local (169.254.0.0/16).
 * ALWAYS BLOCKED under all execution modes.
 */
function isMetadataOrLinkLocal(num: number): boolean {
  return ((num & 0xffff0000) >>> 0) === 0xa9fe0000;
}

/**
 * Checks whether an IPv4 address falls within private, loopback, link-local, or reserved ranges.
 */
function isRestrictedIpv4(ip: string): boolean {
  const num = ipv4ToNumber(ip);
  if (num === -1) return true;

  // 169.254.0.0/16 (Link-Local & Cloud Metadata, e.g. 169.254.169.254)
  if (isMetadataOrLinkLocal(num)) return true;

  // 127.0.0.0/8 (Loopback)
  if (((num & 0xff000000) >>> 0) === 0x7f000000) return true;

  // 10.0.0.0/8 (Private Network)
  if (((num & 0xff000000) >>> 0) === 0x0a000000) return true;

  // 172.16.0.0/12 (Private Network: 172.16.0.0 - 172.31.255.255)
  if (((num & 0xfff00000) >>> 0) === 0xac100000) return true;

  // 192.168.0.0/16 (Private Network)
  if (((num & 0xffff0000) >>> 0) === 0xc0a80000) return true;

  // 100.64.0.0/10 (Shared / Carrier-Grade NAT: 100.64.0.0 - 100.127.255.255)
  if (((num & 0xffc00000) >>> 0) === 0x64400000) return true;

  // 0.0.0.0/8 (Current network / default route)
  if (((num & 0xff000000) >>> 0) === 0x00000000) return true;

  // 240.0.0.0/4 (Reserved / Future use)
  if (((num & 0xf0000000) >>> 0) === 0xf0000000) return true;

  // 255.255.255.255 (Limited Broadcast)
  if (num === 0xffffffff) return true;

  return false;
}

/**
 * Checks whether an IPv6 address is loopback, link-local, ULA, or IPv4-mapped private.
 */
function isRestrictedIpv6(ip: string): boolean {
  const normalized = ip.toLowerCase();

  // ::1 (Loopback)
  if (normalized === '::1' || normalized === '0:0:0:0:0:0:0:1') return true;

  // :: (Unspecified)
  if (normalized === '::' || normalized === '0:0:0:0:0:0:0:0') return true;

  // fe80::/10 (Link-Local)
  if (
    normalized.startsWith('fe8') ||
    normalized.startsWith('fe9') ||
    normalized.startsWith('fea') ||
    normalized.startsWith('feb')
  ) {
    return true;
  }

  // fc00::/7 (Unique Local Address)
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) {
    return true;
  }

  // IPv4-mapped IPv6 (::ffff:127.0.0.1, etc.)
  if (normalized.includes('::ffff:')) {
    const lastPart = normalized.split('::ffff:')[1];
    if (lastPart && net.isIPv4(lastPart)) {
      return isRestrictedIpv4(lastPart);
    }
    return true;
  }

  return false;
}

/**
 * Validates a target URL against SSRF vulnerabilities.
 * Checks protocol, parses hostname, resolves DNS records, and enforces IP range blocklists.
 */
export async function validateSsrfTarget(
  targetUrl: string,
  allowLocalOverride?: boolean
): Promise<SsrValidationResult> {
  const isLocalAllowed =
    allowLocalOverride !== undefined
      ? allowLocalOverride
      : process.env.ALLOW_LOCAL_NETWORK_API_TESTING === 'true' || env.ALLOW_LOCAL_NETWORK_API_TESTING;

  let parsed: URL;

  // 1. URL Protocol Parsing
  try {
    parsed = new URL(targetUrl);
  } catch {
    return { isValid: false, reason: 'Invalid target URL format' };
  }

  const protocol = parsed.protocol.toLowerCase();
  if (protocol !== 'http:' && protocol !== 'https:') {
    return {
      isValid: false,
      reason: `Unsupported URL protocol: "${parsed.protocol}". Only HTTP and HTTPS are permitted.`,
    };
  }

  const hostname = parsed.hostname.toLowerCase();
  if (!hostname) {
    return { isValid: false, reason: 'URL hostname is missing' };
  }

  // 2. Cloud Metadata Hostnames are ALWAYS BLOCKED (even in local override mode)
  const metadataHostnames = [
    '169.254.169.254',
    'metadata.google.internal',
    'metadata',
    'instance-data',
  ];

  if (metadataHostnames.includes(hostname) || hostname.endsWith('.internal') || hostname.endsWith('.local')) {
    if (!isLocalAllowed || metadataHostnames.includes(hostname)) {
      return {
        isValid: false,
        reason: `Access to restricted internal/metadata host "${hostname}" is prohibited (SSRF protection).`,
      };
    }
  }

  // Check direct IP address hostnames
  if (net.isIPv4(hostname)) {
    const num = ipv4ToNumber(hostname);
    if (isMetadataOrLinkLocal(num)) {
      return {
        isValid: false,
        reason: `Target IP address "${hostname}" belongs to cloud metadata/link-local range (SSRF protection).`,
        resolvedIps: [hostname],
      };
    }
    if (!isLocalAllowed && isRestrictedIpv4(hostname)) {
      return {
        isValid: false,
        reason: `Target IP address "${hostname}" belongs to a private/restricted network range (SSRF protection).`,
        resolvedIps: [hostname],
      };
    }
    return { isValid: true, resolvedIps: [hostname] };
  }

  if (net.isIPv6(hostname)) {
    if (!isLocalAllowed && isRestrictedIpv6(hostname)) {
      return {
        isValid: false,
        reason: `Target IPv6 address "${hostname}" belongs to a private/restricted network range (SSRF protection).`,
        resolvedIps: [hostname],
      };
    }
    return { isValid: true, resolvedIps: [hostname] };
  }

  if (!isLocalAllowed && hostname === 'localhost') {
    return {
      isValid: false,
      reason: `Access to restricted localhost is prohibited (SSRF protection).`,
    };
  }

  // 3. DNS Resolution & IP Address Verification
  try {
    const addresses = await dns.lookup(hostname, { all: true });

    if (!addresses || addresses.length === 0) {
      return { isValid: false, reason: `DNS resolution returned no addresses for host "${hostname}"` };
    }

    const resolvedIps = addresses.map((a) => a.address);

    for (const record of addresses) {
      const ip = record.address;

      if (net.isIPv4(ip)) {
        const num = ipv4ToNumber(ip);
        if (isMetadataOrLinkLocal(num)) {
          return {
            isValid: false,
            reason: `Resolved IP address "${ip}" for host "${hostname}" belongs to cloud metadata/link-local range (SSRF protection).`,
            resolvedIps,
          };
        }
        if (!isLocalAllowed && isRestrictedIpv4(ip)) {
          return {
            isValid: false,
            reason: `Resolved IP address "${ip}" for host "${hostname}" belongs to a private/restricted network range (SSRF protection).`,
            resolvedIps,
          };
        }
      }

      if (net.isIPv6(ip) && !isLocalAllowed && isRestrictedIpv6(ip)) {
        return {
          isValid: false,
          reason: `Resolved IPv6 address "${ip}" for host "${hostname}" belongs to a private/restricted network range (SSRF protection).`,
          resolvedIps,
        };
      }
    }

    return { isValid: true, resolvedIps };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return { isValid: false, reason: `DNS lookup failed for host "${hostname}": ${msg}` };
  }
}
