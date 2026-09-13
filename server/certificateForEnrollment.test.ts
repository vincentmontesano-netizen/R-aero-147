import { describe, expect, it } from 'vitest';
import { certificateForEnrollment } from '../shared/certificateForEnrollment';
describe('certificate enrollment binding', () => {
  const enrollment = { id: 20, trainingId: 30, userId: 40 };
  const certificate = { enrollmentId: 20, trainingId: 30, userId: 40, certificateNumber: 'BOUND' };
  it('does not reuse a certificate from a previous enrollment or an unbound legacy record', () => {
    expect(certificateForEnrollment(enrollment, [{ ...certificate, enrollmentId: 19 }, { ...certificate, enrollmentId: null }])).toEqual({ state: 'missing', certificate: null });
    expect(certificateForEnrollment(enrollment, [certificate])).toEqual({ state: 'matched', certificate });
  });
  it('requires review for ambiguous, foreign-holder or wrong-course links without choosing a document', () => {
    for (const candidates of [[certificate, { ...certificate, certificateNumber: 'DUPLICATE' }], [{ ...certificate, userId: 41 }], [{ ...certificate, trainingId: 31 }]]) {
      expect(certificateForEnrollment(enrollment, candidates)).toEqual({ state: 'review', certificate: null });
    }
  });
});
