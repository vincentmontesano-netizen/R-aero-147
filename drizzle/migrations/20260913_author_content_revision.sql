ALTER TABLE training_modules ADD COLUMN revision integer NOT NULL DEFAULT 0;
ALTER TABLE quiz_questions ADD COLUMN revision integer NOT NULL DEFAULT 0;
CREATE FUNCTION advance_author_content_revision() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.revision := OLD.revision + 1;
  RETURN NEW;
END;
$$;
CREATE TRIGGER modules_advance_revision BEFORE UPDATE ON training_modules
FOR EACH ROW EXECUTE FUNCTION advance_author_content_revision();
CREATE TRIGGER questions_advance_revision BEFORE UPDATE ON quiz_questions
FOR EACH ROW EXECUTE FUNCTION advance_author_content_revision();
