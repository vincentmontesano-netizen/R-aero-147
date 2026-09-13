CREATE TABLE IF NOT EXISTS training_versions (
 id serial PRIMARY KEY, "trainingId" integer NOT NULL, version integer NOT NULL,
 snapshot jsonb NOT NULL, "publishedBy" integer, "createdAt" timestamp NOT NULL DEFAULT now(),
 UNIQUE ("trainingId", version)
);
ALTER TABLE trainings ADD COLUMN IF NOT EXISTS "publishedVersionId" integer;
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS "trainingVersionId" integer;
CREATE TRIGGER training_versions_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON training_versions FOR EACH STATEMENT EXECUTE FUNCTION reject_content_history_mutation();
CREATE OR REPLACE FUNCTION pin_enrollment_version() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE current_version integer;
BEGIN
 IF TG_OP = 'UPDATE' THEN
  IF NEW."trainingVersionId" IS DISTINCT FROM OLD."trainingVersionId" OR NEW."trainingId" IS DISTINCT FROM OLD."trainingId" THEN RAISE EXCEPTION 'Enrolled curriculum cannot be changed'; END IF;
 ELSE
  SELECT "publishedVersionId" INTO current_version FROM trainings WHERE id = NEW."trainingId" FOR UPDATE;
  NEW."trainingVersionId" := current_version;
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER enrollment_version_pinned BEFORE INSERT OR UPDATE ON enrollments FOR EACH ROW EXECUTE FUNCTION pin_enrollment_version();
