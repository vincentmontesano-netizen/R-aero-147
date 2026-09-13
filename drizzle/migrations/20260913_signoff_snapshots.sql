ALTER TABLE signoffs ADD COLUMN snapshot jsonb;
CREATE TRIGGER signoff_retained BEFORE UPDATE OR DELETE ON signoffs FOR EACH ROW EXECUTE FUNCTION reject_content_history_mutation();
CREATE TRIGGER signoff_no_truncate BEFORE TRUNCATE ON signoffs FOR EACH STATEMENT EXECUTE FUNCTION reject_content_history_mutation();
