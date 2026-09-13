CREATE TABLE support_message_requests (
 "requestId" varchar(36) PRIMARY KEY,
 "messageId" integer NOT NULL UNIQUE REFERENCES messages(id),
 fingerprint varchar(64) NOT NULL,
 "createdAt" timestamp NOT NULL DEFAULT now()
);
CREATE TRIGGER support_message_requests_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON support_message_requests
FOR EACH STATEMENT EXECUTE FUNCTION reject_content_history_mutation();
