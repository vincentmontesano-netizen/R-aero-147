ALTER TABLE orders ADD COLUMN IF NOT EXISTS "fulfilledAt" timestamp;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS "trainingVersionId" integer;
CREATE OR REPLACE FUNCTION pin_enrollment_version() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE current_version integer;
BEGIN
 IF TG_OP = 'UPDATE' THEN
  IF NEW."trainingVersionId" IS DISTINCT FROM OLD."trainingVersionId" OR NEW."trainingId" IS DISTINCT FROM OLD."trainingId" OR NEW."orderId" IS DISTINCT FROM OLD."orderId" THEN RAISE EXCEPTION 'Enrolled curriculum and purchase cannot be changed'; END IF;
 ELSE
  SELECT "publishedVersionId" INTO current_version FROM trainings WHERE id = NEW."trainingId" FOR UPDATE;
  IF NEW."orderId" IS NOT NULL THEN
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
  SELECT 1 FROM order_items i JOIN orders o ON o.id = i."orderId" WHERE o.id = NEW."orderId" AND o.status = 'paid' AND o."userId" = NEW."userId" AND i."trainingId" = NEW."trainingId" AND i."trainingVersionId" IS NOT NULL
 ) THEN RAISE EXCEPTION 'Archived course does not accept new enrollments'; END IF;
 RETURN NEW;
END; $$;
