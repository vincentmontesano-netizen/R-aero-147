CREATE TABLE support_creation_requests (
 "requestId" varchar(36) PRIMARY KEY,
 "ticketId" integer NOT NULL UNIQUE REFERENCES support_tickets(id),
 fingerprint varchar(64) NOT NULL,
 "createdAt" timestamp NOT NULL DEFAULT now()
);
CREATE TRIGGER support_creation_requests_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON support_creation_requests
FOR EACH STATEMENT EXECUTE FUNCTION reject_content_history_mutation();
