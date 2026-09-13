ALTER TABLE verification_cases ADD COLUMN revision integer NOT NULL DEFAULT 0;
CREATE TRIGGER verification_cases_advance_revision BEFORE UPDATE ON verification_cases
FOR EACH ROW EXECUTE FUNCTION advance_author_content_revision();
