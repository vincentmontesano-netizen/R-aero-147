import { describe, expect, it } from 'vitest';
import { complianceReportInput } from '../shared/complianceReportInput';

describe('compliance report input', () => {
  it('accepts the cursor and direction that tRPC infinite queries send', () => {
    expect(complianceReportInput.parse({ direction: 'forward' })).toEqual({ direction: 'forward' });
    expect(complianceReportInput.parse({ cursor: 12, pageSize: 250, direction: 'forward' })).toMatchObject({ cursor: 12 });
  });
  it('still rejects unknown keys', () => {
    expect(() => complianceReportInput.parse({ cursor: 1, userId: 3 })).toThrow();
  });
});
