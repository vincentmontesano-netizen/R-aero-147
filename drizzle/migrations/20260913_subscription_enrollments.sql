ALTER TABLE enrollments ADD COLUMN "stripeSubscriptionId" varchar(255);
ALTER TABLE enrollments ADD CONSTRAINT subscription_enrollment_origin CHECK (
 "stripeSubscriptionId" IS NULL OR ("assignedOrgId" IS NOT NULL AND "employeeId" IS NOT NULL AND "orderId" IS NULL AND "trainingLicenseId" IS NULL)
);
CREATE OR REPLACE FUNCTION preserve_subscription_enrollment() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW."stripeSubscriptionId" IS DISTINCT FROM OLD."stripeSubscriptionId" OR
 (OLD."stripeSubscriptionId" IS NOT NULL AND (NEW."employeeId" IS DISTINCT FROM OLD."employeeId" OR NEW."userId" IS DISTINCT FROM OLD."userId" OR NEW."trainingId" IS DISTINCT FROM OLD."trainingId"))
 THEN RAISE EXCEPTION 'Subscription enrollment origin cannot be changed'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER subscription_enrollment_immutable BEFORE UPDATE ON enrollments FOR EACH ROW EXECUTE FUNCTION preserve_subscription_enrollment();
