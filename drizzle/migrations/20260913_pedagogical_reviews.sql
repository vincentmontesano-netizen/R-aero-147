CREATE TABLE pedagogical_reviews (
 id serial PRIMARY KEY, "trainingId" integer NOT NULL, "requestedBy" integer NOT NULL,
 fingerprint varchar(64) NOT NULL, snapshot jsonb NOT NULL, "createdAt" timestamp NOT NULL DEFAULT now()
);
CREATE TABLE pedagogical_decisions (
 id serial PRIMARY KEY, "reviewId" integer NOT NULL UNIQUE REFERENCES pedagogical_reviews(id),
 "reviewedBy" integer NOT NULL, decision varchar(16) NOT NULL CHECK (decision IN ('approved','rejected')),
 note text NOT NULL, "createdAt" timestamp NOT NULL DEFAULT now()
);
ALTER TABLE training_versions ADD COLUMN "reviewId" integer REFERENCES pedagogical_reviews(id);
ALTER TABLE trainings ALTER COLUMN "reviewStatus" SET DEFAULT 'draft';
CREATE TRIGGER pedagogical_reviews_immutable BEFORE UPDATE OR DELETE ON pedagogical_reviews FOR EACH ROW EXECUTE FUNCTION reject_content_history_mutation();
CREATE TRIGGER pedagogical_decisions_immutable BEFORE UPDATE OR DELETE ON pedagogical_decisions FOR EACH ROW EXECUTE FUNCTION reject_content_history_mutation();
CREATE TRIGGER pedagogical_reviews_no_truncate BEFORE TRUNCATE ON pedagogical_reviews FOR EACH STATEMENT EXECUTE FUNCTION reject_content_history_mutation();
CREATE TRIGGER pedagogical_decisions_no_truncate BEFORE TRUNCATE ON pedagogical_decisions FOR EACH STATEMENT EXECUTE FUNCTION reject_content_history_mutation();
CREATE INDEX pedagogical_reviews_course_idx ON pedagogical_reviews("trainingId", id);
