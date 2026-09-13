ALTER TABLE external_trainings ADD COLUMN "archivedAt" timestamp,
 ADD COLUMN "archivedBy" integer REFERENCES users(id), ADD COLUMN "archiveReason" text,
 ADD CONSTRAINT external_training_archive_complete CHECK (
 ("archivedAt" IS NULL AND "archivedBy" IS NULL AND "archiveReason" IS NULL) OR
 ("archivedAt" IS NOT NULL AND "archivedBy" IS NOT NULL AND length(trim("archiveReason")) BETWEEN 3 AND 1000));
CREATE FUNCTION preserve_external_training() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP <> 'UPDATE' THEN
  RAISE EXCEPTION 'External training records must be retained';
 END IF;
 IF OLD."archivedAt" IS NOT NULL OR NEW."archivedAt" IS NULL OR
    (to_jsonb(NEW) - ARRAY['archivedAt','archivedBy','archiveReason']) IS DISTINCT FROM
    (to_jsonb(OLD) - ARRAY['archivedAt','archivedBy','archiveReason']) THEN
  RAISE EXCEPTION 'External training evidence is immutable; archive and create a correction';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER external_training_preserve BEFORE UPDATE OR DELETE ON external_trainings FOR EACH ROW EXECUTE FUNCTION preserve_external_training();
CREATE TRIGGER external_training_no_truncate BEFORE TRUNCATE ON external_trainings FOR EACH STATEMENT EXECUTE FUNCTION preserve_external_training();
