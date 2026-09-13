CREATE TABLE invoice_counters (year integer PRIMARY KEY, value integer NOT NULL CHECK(value>0));
CREATE TABLE invoice_archives (
 id serial PRIMARY KEY, "orderId" integer NOT NULL UNIQUE REFERENCES orders(id), "userId" integer NOT NULL REFERENCES users(id),
 number varchar(32) NOT NULL UNIQUE, snapshot jsonb NOT NULL, "storageKey" varchar(512) NOT NULL UNIQUE,
 sha256 varchar(64) NOT NULL, "byteSize" integer NOT NULL CHECK("byteSize">0), "issuedAt" timestamp NOT NULL DEFAULT now()
);
CREATE TRIGGER invoice_archive_retained BEFORE UPDATE OR DELETE ON invoice_archives FOR EACH ROW EXECUTE FUNCTION reject_content_history_mutation();
CREATE TRIGGER invoice_archive_no_truncate BEFORE TRUNCATE ON invoice_archives FOR EACH STATEMENT EXECUTE FUNCTION reject_content_history_mutation();
