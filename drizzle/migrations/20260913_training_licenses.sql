CREATE TABLE training_licenses (
 id serial PRIMARY KEY, "orderId" integer NOT NULL, "orderItemId" integer NOT NULL,
 "seatIndex" integer NOT NULL, "trainingId" integer NOT NULL, "trainingVersionId" integer NOT NULL,
 "ownerUserId" integer NOT NULL, "ownerOrgId" integer, "assignedUserId" integer, "assignedBy" integer,
 "enrollmentId" integer, "assignedAt" timestamp, "revokedAt" timestamp, "createdAt" timestamp NOT NULL DEFAULT now(),
 UNIQUE ("orderItemId", "seatIndex")
);
ALTER TABLE enrollments ADD COLUMN "trainingLicenseId" integer;
ALTER TABLE enrollments ADD CONSTRAINT enrollment_license_unique UNIQUE ("trainingLicenseId");
CREATE TRIGGER licenses_no_delete BEFORE DELETE OR TRUNCATE ON training_licenses FOR EACH STATEMENT EXECUTE FUNCTION preserve_content_record();
CREATE OR REPLACE FUNCTION protect_license_origin() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF ROW(NEW."orderId",NEW."orderItemId",NEW."seatIndex",NEW."trainingId",NEW."trainingVersionId",NEW."ownerUserId",NEW."ownerOrgId") IS DISTINCT FROM ROW(OLD."orderId",OLD."orderItemId",OLD."seatIndex",OLD."trainingId",OLD."trainingVersionId",OLD."ownerUserId",OLD."ownerOrgId") THEN RAISE EXCEPTION 'License origin is immutable'; END IF;
 IF OLD."assignedUserId" IS NOT NULL AND ROW(NEW."assignedUserId",NEW."assignedBy",NEW."assignedAt") IS DISTINCT FROM ROW(OLD."assignedUserId",OLD."assignedBy",OLD."assignedAt") THEN RAISE EXCEPTION 'License assignment is immutable'; END IF;
 IF OLD."enrollmentId" IS NOT NULL AND NEW."enrollmentId" IS DISTINCT FROM OLD."enrollmentId" THEN RAISE EXCEPTION 'License enrollment is immutable'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER license_origin_immutable BEFORE UPDATE ON training_licenses FOR EACH ROW EXECUTE FUNCTION protect_license_origin();
CREATE OR REPLACE FUNCTION pin_enrollment_version() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE current_version integer;
BEGIN
 IF TG_OP = 'UPDATE' THEN
  IF ROW(NEW."trainingVersionId", NEW."trainingId", NEW."orderId", NEW."trainingLicenseId") IS DISTINCT FROM ROW(OLD."trainingVersionId", OLD."trainingId", OLD."orderId", OLD."trainingLicenseId") THEN RAISE EXCEPTION 'Enrolled curriculum and purchase cannot be changed'; END IF;
 ELSE
  SELECT "publishedVersionId" INTO current_version FROM trainings WHERE id = NEW."trainingId" FOR UPDATE;
  IF NEW."trainingLicenseId" IS NOT NULL THEN
   SELECT l."trainingVersionId" INTO current_version FROM training_licenses l JOIN orders o ON o.id = l."orderId"
    WHERE l.id = NEW."trainingLicenseId" AND l."orderId" = NEW."orderId" AND l."trainingId" = NEW."trainingId" AND l."assignedUserId" = NEW."userId" AND l."revokedAt" IS NULL AND o.status = 'paid';
   IF current_version IS NULL THEN RAISE EXCEPTION 'A paid assigned license is required'; END IF;
  ELSIF NEW."orderId" IS NOT NULL THEN
   SELECT i."trainingVersionId" INTO current_version FROM order_items i JOIN orders o ON o.id = i."orderId"
    WHERE o.id = NEW."orderId" AND o.status = 'paid' AND o."userId" = NEW."userId" AND i."trainingId" = NEW."trainingId" LIMIT 1;
   IF current_version IS NULL THEN RAISE EXCEPTION 'Paid purchase with a curriculum version required'; END IF;
  END IF;
  NEW."trainingVersionId" := current_version;
 END IF;
 RETURN NEW;
END; $$;
CREATE OR REPLACE FUNCTION lock_enrollment_course() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE archived timestamp;
BEGIN
 SELECT "archivedAt" INTO archived FROM trainings WHERE id = NEW."trainingId" FOR UPDATE;
 IF archived IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM training_licenses l JOIN orders o ON o.id = l."orderId" WHERE l.id = NEW."trainingLicenseId" AND l."assignedUserId" = NEW."userId" AND l."trainingId" = NEW."trainingId" AND l."revokedAt" IS NULL AND o.status = 'paid'
 ) AND NOT EXISTS (
  SELECT 1 FROM order_items i JOIN orders o ON o.id = i."orderId" WHERE o.id = NEW."orderId" AND o.status = 'paid' AND o."userId" = NEW."userId" AND i."trainingId" = NEW."trainingId" AND i."trainingVersionId" IS NOT NULL
 ) THEN RAISE EXCEPTION 'Archived course does not accept new enrollments'; END IF;
 RETURN NEW;
END; $$;
