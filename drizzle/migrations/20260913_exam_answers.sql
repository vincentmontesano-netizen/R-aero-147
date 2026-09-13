ALTER TABLE exam_sessions ADD COLUMN IF NOT EXISTS "questionSnapshot" jsonb;
ALTER TABLE exam_sessions ADD COLUMN IF NOT EXISTS "passingScoreSnapshot" integer;
ALTER TABLE exam_sessions ADD COLUMN IF NOT EXISTS "savedAnswers" jsonb;
ALTER TABLE exam_sessions ADD COLUMN IF NOT EXISTS "answerRevision" integer NOT NULL DEFAULT 0;
ALTER TABLE exam_sessions ADD COLUMN IF NOT EXISTS "answersSavedAt" timestamp;
CREATE OR REPLACE FUNCTION protect_exam_snapshot() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD."questionSnapshot" IS NOT NULL AND (
   NEW."questionSnapshot" IS DISTINCT FROM OLD."questionSnapshot" OR
   NEW."passingScoreSnapshot" IS DISTINCT FROM OLD."passingScoreSnapshot" OR
   NEW."questionIds" IS DISTINCT FROM OLD."questionIds" OR
   NEW."userId" IS DISTINCT FROM OLD."userId" OR
   NEW."enrollmentId" IS DISTINCT FROM OLD."enrollmentId" OR
   NEW."trainingId" IS DISTINCT FROM OLD."trainingId"
 ) THEN RAISE EXCEPTION 'An exam snapshot cannot be changed'; END IF;
 RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS exam_snapshot_immutable ON exam_sessions;
CREATE TRIGGER exam_snapshot_immutable BEFORE UPDATE ON exam_sessions FOR EACH ROW EXECUTE FUNCTION protect_exam_snapshot();
