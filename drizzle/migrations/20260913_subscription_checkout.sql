CREATE TABLE subscription_checkouts (
 id varchar(64) PRIMARY KEY,
 "companyId" integer NOT NULL REFERENCES companies(id),
 "requestedBy" integer REFERENCES users(id),
 plan varchar(32) NOT NULL CHECK (plan IN ('standard', 'all_inclusive')),
 quantity integer NOT NULL CHECK (quantity > 0),
 payload jsonb NOT NULL,
 "requestKey" varchar(128) NOT NULL UNIQUE,
 "retryUntil" timestamp NOT NULL,
 "sessionId" varchar(255) UNIQUE,
 status varchar(16) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'complete', 'expired')),
 "createdAt" timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX subscription_checkout_one_pending ON subscription_checkouts("companyId") WHERE status = 'pending';
CREATE OR REPLACE FUNCTION preserve_subscription_checkout() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF ROW(NEW.id, NEW."companyId", NEW."requestedBy", NEW.plan, NEW.quantity, NEW.payload, NEW."requestKey", NEW."retryUntil", NEW."createdAt") IS DISTINCT FROM
 ROW(OLD.id, OLD."companyId", OLD."requestedBy", OLD.plan, OLD.quantity, OLD.payload, OLD."requestKey", OLD."retryUntil", OLD."createdAt")
 OR (OLD."sessionId" IS NOT NULL AND NEW."sessionId" IS DISTINCT FROM OLD."sessionId")
 OR (OLD.status <> 'pending' AND NEW.status IS DISTINCT FROM OLD.status)
 THEN RAISE EXCEPTION 'Checkout origin and terminal state cannot be changed'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER subscription_checkout_preserved BEFORE UPDATE ON subscription_checkouts FOR EACH ROW EXECUTE FUNCTION preserve_subscription_checkout();
CREATE TRIGGER subscription_checkout_no_delete BEFORE DELETE ON subscription_checkouts FOR EACH ROW EXECUTE FUNCTION reject_content_history_mutation();
CREATE TRIGGER subscription_checkout_no_truncate BEFORE TRUNCATE ON subscription_checkouts FOR EACH STATEMENT EXECUTE FUNCTION reject_content_history_mutation();
