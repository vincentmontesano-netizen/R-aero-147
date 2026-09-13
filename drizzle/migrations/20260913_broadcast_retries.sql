CREATE TABLE broadcast_payloads (
 "runId" integer PRIMARY KEY REFERENCES broadcast_runs(id), body text NOT NULL, link varchar(512)
);
CREATE TABLE broadcast_retries (
 "sourceRecipientId" integer PRIMARY KEY REFERENCES broadcast_recipients(id),
 "runId" integer NOT NULL UNIQUE REFERENCES broadcast_runs(id), "scopeOrgId" integer
);
CREATE TRIGGER broadcast_payloads_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON broadcast_payloads FOR EACH STATEMENT EXECUTE FUNCTION reject_content_history_mutation();
CREATE TRIGGER broadcast_retries_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON broadcast_retries FOR EACH STATEMENT EXECUTE FUNCTION reject_content_history_mutation();
