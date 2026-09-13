ALTER TABLE exam_sessions ADD COLUMN IF NOT EXISTS "moduleId" integer;
ALTER TABLE quiz_attempts ADD COLUMN IF NOT EXISTS "moduleId" integer;
CREATE OR REPLACE FUNCTION protect_exam_chapter() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW."moduleId" IS DISTINCT FROM OLD."moduleId" THEN RAISE EXCEPTION 'Exam chapter cannot be changed'; END IF;
 RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS exam_chapter_immutable ON exam_sessions;
CREATE TRIGGER exam_chapter_immutable BEFORE UPDATE ON exam_sessions FOR EACH ROW EXECUTE FUNCTION protect_exam_chapter();
