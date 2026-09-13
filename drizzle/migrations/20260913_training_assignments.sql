ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS "assignedOrgId" integer;
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS "assignedBy" integer;
CREATE OR REPLACE FUNCTION preserve_assignment_origin() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW."assignedOrgId" IS DISTINCT FROM OLD."assignedOrgId" OR NEW."assignedBy" IS DISTINCT FROM OLD."assignedBy" THEN RAISE EXCEPTION 'Assignment origin cannot be changed'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER assignment_origin_immutable BEFORE UPDATE ON enrollments FOR EACH ROW EXECUTE FUNCTION preserve_assignment_origin();
