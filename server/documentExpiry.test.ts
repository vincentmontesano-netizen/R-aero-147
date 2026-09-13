import { describe, expect, it } from 'vitest';
import { documentExpirySummary } from '../shared/documentExpiry';
describe('uploaded document expiry summary', () => {
  const now = Date.parse('2026-09-13T12:00:00Z');
  it('distinguishes absence, undated files and expired dates at the boundary', () => {
    expect(documentExpirySummary([], now)).toBe('missing');
    expect(documentExpirySummary([{ expiresAt: null }], now)).toBe('unknown');
    expect(documentExpirySummary([{ expiresAt: 'invalid' }], now)).toBe('unknown');
    expect(documentExpirySummary([{ expiresAt: new Date(now) }], now)).toBe('expired');
    expect(documentExpirySummary([{ expiresAt: new Date(now + 1) }], now)).toBe('current');
  });
  it('keeps unknown dates distinct when older files expired and recognizes one dated current document', () => {
    const older = { expiresAt: new Date(now - 1000) };
    expect(documentExpirySummary([older, {}], now)).toBe('unknown');
    expect(documentExpirySummary([older, {}, { expiresAt: new Date(now + 1000) }], now)).toBe('current');
    expect(documentExpirySummary([older, older], now)).toBe('expired');
  });
});
