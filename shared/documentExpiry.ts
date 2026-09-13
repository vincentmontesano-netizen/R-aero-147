/** Describes supplied document dates, not a person's qualification or approval. */
export function documentExpirySummary(documents: { expiresAt?: Date | string | null }[], now = Date.now()): 'missing' | 'current' | 'unknown' | 'expired' {
  if (!documents.length) return 'missing';
  const dates = documents.map(document => document.expiresAt ? new Date(document.expiresAt).getTime() : NaN);
  if (dates.some(date => Number.isFinite(date) && date > now)) return 'current';
  if (dates.some(date => !Number.isFinite(date))) return 'unknown';
  return 'expired';
}
