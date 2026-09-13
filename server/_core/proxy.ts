import { isIP } from 'node:net';

/** Explicit proxy addresses only: no blanket trust or hop-count shortcuts. */
export function trustedProxies(value = process.env.TRUST_PROXY): false | string[] {
  if (!value?.trim() || value.trim() === 'false') return false;
  const addresses = value.split(',').map(part => part.trim());
  for (const entry of addresses) {
    const parts = entry.split('/');
    const family = isIP(parts[0]!);
    if (!family || parts.length > 2) throw new Error('TRUST_PROXY requires explicit IP addresses or CIDR networks');
    if (parts.length === 2 && (!/^\d+$/.test(parts[1]!) || Number(parts[1]) < 1 || Number(parts[1]) > (family === 4 ? 32 : 128))) {
      throw new Error('TRUST_PROXY contains an invalid or unrestricted network');
    }
  }
  return addresses;
}
