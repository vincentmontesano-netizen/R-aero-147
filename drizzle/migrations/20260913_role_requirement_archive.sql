ALTER TABLE role_requirements ADD COLUMN "archivedAt" timestamp;
ALTER TABLE role_requirements ADD COLUMN "archivedBy" integer REFERENCES users(id);
ALTER TABLE role_requirements ADD CONSTRAINT role_requirement_archive_pair CHECK (("archivedAt" IS NULL) = ("archivedBy" IS NULL));
CREATE FUNCTION protect_role_requirement() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD."archivedAt" IS NOT NULL OR NEW."archivedAt" IS NULL THEN
  RAISE EXCEPTION 'Role requirements are retained; archive an active rule instead';
 END IF;
 IF (to_jsonb(OLD) - 'archivedAt' - 'archivedBy') IS DISTINCT FROM (to_jsonb(NEW) - 'archivedAt' - 'archivedBy') THEN
  RAISE EXCEPTION 'Archiving must preserve the role requirement';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER role_requirement_archive_only BEFORE UPDATE ON role_requirements FOR EACH ROW EXECUTE FUNCTION protect_role_requirement();
CREATE TRIGGER role_requirement_no_delete BEFORE DELETE OR TRUNCATE ON role_requirements FOR EACH STATEMENT EXECUTE FUNCTION preserve_content_record();
