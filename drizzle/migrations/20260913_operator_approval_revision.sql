ALTER TABLE operator_approval ADD COLUMN revision integer NOT NULL DEFAULT 0;
CREATE TRIGGER operator_approval_advance_revision BEFORE UPDATE ON operator_approval
FOR EACH ROW EXECUTE FUNCTION advance_author_content_revision();
