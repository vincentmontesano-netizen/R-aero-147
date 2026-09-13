ALTER TABLE quiz_attempts ADD COLUMN feedback jsonb;
CREATE TRIGGER quiz_attempts_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON quiz_attempts
FOR EACH STATEMENT EXECUTE FUNCTION reject_content_history_mutation();
