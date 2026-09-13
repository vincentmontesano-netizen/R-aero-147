CREATE OR REPLACE FUNCTION validate_active_content_links() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE link_id integer; parent_id integer; linked_parent integer; archived timestamp; row_data jsonb;
BEGIN
 row_data := to_jsonb(NEW);
 IF NEW."archivedAt" IS NOT NULL THEN RETURN NEW; END IF;
 parent_id := NEW."trainingId";
 PERFORM id FROM trainings WHERE id = parent_id FOR UPDATE;
 link_id := (row_data->>'moduleId')::integer;
 IF link_id IS NOT NULL THEN
  SELECT "trainingId", "archivedAt" INTO linked_parent, archived FROM training_modules WHERE id = link_id;
  IF linked_parent IS DISTINCT FROM parent_id OR archived IS NOT NULL THEN RAISE EXCEPTION 'Chapter is unavailable or belongs to another course'; END IF;
 END IF;
 link_id := (row_data->>'objectiveId')::integer;
 IF link_id IS NOT NULL THEN
  SELECT "trainingId", "archivedAt" INTO linked_parent, archived FROM learning_objectives WHERE id = link_id;
  IF linked_parent IS DISTINCT FROM parent_id OR archived IS NOT NULL THEN RAISE EXCEPTION 'Objective is unavailable or belongs to another course'; END IF;
 END IF;
 RETURN NEW;
END; $$;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['training_modules','quiz_questions','learning_objectives','slides'] LOOP
  EXECUTE format('CREATE TRIGGER active_content_links BEFORE INSERT OR UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION validate_active_content_links()', t);
 END LOOP;
END $$;
