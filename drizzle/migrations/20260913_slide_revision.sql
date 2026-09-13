ALTER TABLE slides ADD COLUMN revision integer NOT NULL DEFAULT 0;
CREATE FUNCTION advance_slide_revision() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.revision := OLD.revision + 1;
  RETURN NEW;
END;
$$;
CREATE TRIGGER slides_advance_revision BEFORE UPDATE ON slides
FOR EACH ROW EXECUTE FUNCTION advance_slide_revision();
