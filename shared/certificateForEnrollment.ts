type EnrollmentIdentity = { id: number; trainingId: number; userId: number };
type CertificateIdentity = { enrollmentId: number | null; trainingId: number; userId: number };

/** A certificate belongs to one attempt/enrollment, even when the course repeats. */
export function certificateForEnrollment<T extends CertificateIdentity>(enrollment: EnrollmentIdentity, certificates: T[]): { state: 'matched'; certificate: T } | { state: 'missing' | 'review'; certificate: null } {
  const candidates = certificates.filter(c => c.enrollmentId === enrollment.id);
  if (!candidates.length) return { state: 'missing', certificate: null };
  if (candidates.length !== 1 || candidates[0].userId !== enrollment.userId || candidates[0].trainingId !== enrollment.trainingId) return { state: 'review', certificate: null };
  return { state: 'matched', certificate: candidates[0] };
}
