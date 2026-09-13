-- Reports resolve the certificates belonging to each page of enrollments.
-- Non-unique: duplicate legacy certificates must remain visible for review.
CREATE INDEX IF NOT EXISTS certificates_enrollment_idx ON certificates ("enrollmentId");
