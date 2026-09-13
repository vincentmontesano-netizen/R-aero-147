-- Additive KYC/KYB schema. Apply to an existing R-AERO database, inside a transaction.
CREATE TABLE IF NOT EXISTS verification_cases (
 id serial PRIMARY KEY, "subjectKey" varchar(80) NOT NULL UNIQUE,
 kind varchar(8) NOT NULL, "personId" integer NOT NULL, "companyId" integer,
 status varchar(24) NOT NULL DEFAULT 'draft', "legalName" varchar(255) NOT NULL,
 country varchar(2) NOT NULL, "registrationNumber" varchar(128), address text NOT NULL,
 "reviewNote" text, "reviewedBy" integer, "submittedAt" timestamp, "reviewedAt" timestamp,
 "createdAt" timestamp NOT NULL DEFAULT now(), "updatedAt" timestamp NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS verification_documents (
 id serial PRIMARY KEY, "caseId" integer NOT NULL, kind varchar(32) NOT NULL,
 "fileUrl" varchar(1024) NOT NULL, "fileName" varchar(255) NOT NULL, "contentType" varchar(128) NOT NULL,
 "uploadedBy" integer NOT NULL, "createdAt" timestamp NOT NULL DEFAULT now(), "archivedAt" timestamp
);
CREATE TABLE IF NOT EXISTS verification_events (
 id serial PRIMARY KEY, "caseId" integer NOT NULL, "actorId" integer NOT NULL,
 action varchar(32) NOT NULL, previous jsonb, current jsonb, "createdAt" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS verification_documents_case_idx ON verification_documents("caseId");
CREATE INDEX IF NOT EXISTS verification_documents_url_idx ON verification_documents("fileUrl");
CREATE INDEX IF NOT EXISTS verification_events_case_idx ON verification_events("caseId");
CREATE OR REPLACE FUNCTION preserve_verification_events() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Verification events are append-only'; END;
$$;
DROP TRIGGER IF EXISTS verification_events_immutable ON verification_events;
CREATE TRIGGER verification_events_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON verification_events
FOR EACH STATEMENT EXECUTE FUNCTION preserve_verification_events();
