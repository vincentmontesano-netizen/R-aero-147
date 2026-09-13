CREATE TABLE subscription_checkout_closures (
 "attemptId" varchar(64) PRIMARY KEY REFERENCES subscription_checkouts(id),
 "requestedBy" integer NOT NULL REFERENCES users(id),
 "observedStatus" varchar(16) NOT NULL CHECK ("observedStatus" IN ('expired', 'complete')),
 "createdAt" timestamp NOT NULL DEFAULT now()
);
CREATE TRIGGER subscription_closure_immutable BEFORE UPDATE OR DELETE ON subscription_checkout_closures FOR EACH ROW EXECUTE FUNCTION reject_content_history_mutation();
CREATE TRIGGER subscription_closure_no_truncate BEFORE TRUNCATE ON subscription_checkout_closures FOR EACH STATEMENT EXECUTE FUNCTION reject_content_history_mutation();
