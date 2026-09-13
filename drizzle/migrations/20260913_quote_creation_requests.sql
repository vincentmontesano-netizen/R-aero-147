CREATE TABLE quote_creation_requests (
 "requestId" varchar(36) PRIMARY KEY,
 "quoteId" integer NOT NULL UNIQUE REFERENCES quote_requests(id),
 fingerprint varchar(64) NOT NULL,
 "createdAt" timestamp NOT NULL DEFAULT now()
);
CREATE TRIGGER quote_creation_requests_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON quote_creation_requests
FOR EACH STATEMENT EXECUTE FUNCTION reject_content_history_mutation();
