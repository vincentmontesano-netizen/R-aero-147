CREATE TABLE broadcast_recipients (
 id serial PRIMARY KEY, "runId" integer NOT NULL REFERENCES broadcast_runs(id), "userId" integer NOT NULL REFERENCES users(id)
);
CREATE UNIQUE INDEX broadcast_run_recipient_key ON broadcast_recipients ("runId", "userId");
CREATE INDEX broadcast_recipient_page_idx ON broadcast_recipients ("runId", id);
CREATE TABLE broadcast_recipient_outcomes (
 "recipientId" integer PRIMARY KEY REFERENCES broadcast_recipients(id),
 status varchar(32) NOT NULL CHECK (status IN ('accepted','unconfirmed','skipped_configuration','skipped_missing_email','not_requested')),
 "recordedAt" timestamp NOT NULL DEFAULT now()
);
CREATE TRIGGER broadcast_recipients_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON broadcast_recipients FOR EACH STATEMENT EXECUTE FUNCTION reject_content_history_mutation();
CREATE TRIGGER broadcast_recipient_outcomes_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON broadcast_recipient_outcomes FOR EACH STATEMENT EXECUTE FUNCTION reject_content_history_mutation();
