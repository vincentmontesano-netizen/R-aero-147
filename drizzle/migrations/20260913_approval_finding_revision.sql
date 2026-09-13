ALTER TABLE approval_findings ADD COLUMN revision integer NOT NULL DEFAULT 0;
CREATE TRIGGER approval_findings_advance_revision BEFORE UPDATE ON approval_findings
FOR EACH ROW EXECUTE FUNCTION advance_author_content_revision();
