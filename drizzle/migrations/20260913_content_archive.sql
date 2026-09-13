ALTER TABLE trainings ADD COLUMN IF NOT EXISTS "archivedAt" timestamp;
ALTER TABLE training_modules ADD COLUMN IF NOT EXISTS "archivedAt" timestamp;
ALTER TABLE quiz_questions ADD COLUMN IF NOT EXISTS "archivedAt" timestamp;
ALTER TABLE learning_objectives ADD COLUMN IF NOT EXISTS "archivedAt" timestamp;
ALTER TABLE slides ADD COLUMN IF NOT EXISTS "archivedAt" timestamp;
CREATE TABLE IF NOT EXISTS content_events (
 id serial PRIMARY KEY, "trainingId" integer NOT NULL, "actorId" integer,
 "entityType" varchar(32) NOT NULL, "entityId" integer NOT NULL, action varchar(32) NOT NULL,
 "beforeState" jsonb, "afterState" jsonb, "createdAt" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS content_events_training_idx ON content_events ("trainingId");
CREATE OR REPLACE FUNCTION reject_content_history_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Content history is immutable'; END; $$;
CREATE TRIGGER content_events_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON content_events FOR EACH STATEMENT EXECUTE FUNCTION reject_content_history_mutation();
CREATE OR REPLACE FUNCTION preserve_content_record() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Archive pedagogical records instead of deleting them'; END; $$;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['trainings','training_modules','quiz_questions','learning_objectives','slides'] LOOP
  EXECUTE format('CREATE TRIGGER preserve_content BEFORE DELETE OR TRUNCATE ON %I FOR EACH STATEMENT EXECUTE FUNCTION preserve_content_record()', t);
 END LOOP;
END $$;
CREATE OR REPLACE FUNCTION protect_archived_content() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE parent_id integer; archived timestamp;
BEGIN
 IF TG_OP = 'UPDATE' AND OLD."archivedAt" IS NOT NULL THEN RAISE EXCEPTION 'Archived content is locked'; END IF;
 IF TG_TABLE_NAME <> 'trainings' THEN
  parent_id := NEW."trainingId";
  SELECT "archivedAt" INTO archived FROM trainings WHERE id = parent_id FOR UPDATE;
  IF archived IS NOT NULL THEN RAISE EXCEPTION 'Archived course is locked'; END IF;
 END IF;
 RETURN NEW;
END; $$;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['trainings','training_modules','quiz_questions','learning_objectives','slides'] LOOP
  EXECUTE format('CREATE TRIGGER archived_content_locked BEFORE INSERT OR UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION protect_archived_content()', t);
 END LOOP;
END $$;
CREATE OR REPLACE FUNCTION lock_enrollment_course() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE archived timestamp;
BEGIN
 SELECT "archivedAt" INTO archived FROM trainings WHERE id = NEW."trainingId" FOR UPDATE;
 IF archived IS NOT NULL THEN RAISE EXCEPTION 'Archived course does not accept new enrollments'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER enrollment_course_lock BEFORE INSERT ON enrollments FOR EACH ROW EXECUTE FUNCTION lock_enrollment_course();
