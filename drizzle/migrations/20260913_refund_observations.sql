ALTER TABLE orders ADD COLUMN "refundedAmountCents" integer NOT NULL DEFAULT 0;
CREATE TABLE refund_observations (
 "eventId" varchar(128) PRIMARY KEY, "paymentIntentId" varchar(128) NOT NULL, "chargeId" varchar(128) NOT NULL,
 "amountCents" integer NOT NULL, "refundedCents" integer NOT NULL, currency varchar(8) NOT NULL,
 "fullyRefunded" boolean NOT NULL, "eventCreated" integer NOT NULL, "createdAt" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX refund_observations_intent_idx ON refund_observations ("paymentIntentId");
CREATE TRIGGER refund_observations_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON refund_observations FOR EACH STATEMENT EXECUTE FUNCTION reject_content_history_mutation();
CREATE OR REPLACE FUNCTION preserve_license_revocation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD."revokedAt" IS NOT NULL AND NEW."revokedAt" IS DISTINCT FROM OLD."revokedAt" THEN RAISE EXCEPTION 'License revocation is immutable'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER license_revocation_immutable BEFORE UPDATE ON training_licenses FOR EACH ROW EXECUTE FUNCTION preserve_license_revocation();
