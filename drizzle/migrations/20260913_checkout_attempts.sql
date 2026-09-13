CREATE TABLE checkout_attempts (
  "orderId" integer PRIMARY KEY REFERENCES orders(id),
  fingerprint varchar(64) NOT NULL,
  "requestKey" varchar(128) NOT NULL UNIQUE,
  payload jsonb NOT NULL,
  "retryUntil" timestamp NOT NULL,
  "createdAt" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX checkout_attempts_fingerprint_idx ON checkout_attempts(fingerprint);
CREATE TRIGGER checkout_attempts_immutable BEFORE UPDATE OR DELETE ON checkout_attempts
  FOR EACH ROW EXECUTE FUNCTION reject_content_history_mutation();
CREATE TRIGGER checkout_attempts_no_truncate BEFORE TRUNCATE ON checkout_attempts
  FOR EACH STATEMENT EXECUTE FUNCTION reject_content_history_mutation();
