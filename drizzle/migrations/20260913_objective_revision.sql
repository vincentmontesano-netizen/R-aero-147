ALTER TABLE learning_objectives ADD COLUMN revision integer NOT NULL DEFAULT 0;
CREATE TRIGGER objectives_advance_revision BEFORE UPDATE ON learning_objectives
FOR EACH ROW EXECUTE FUNCTION advance_author_content_revision();
