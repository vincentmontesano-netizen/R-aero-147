CREATE TABLE IF NOT EXISTS operator_approval (
 id integer PRIMARY KEY, "legalName" varchar(255) NOT NULL, authority varchar(255) NOT NULL,
 reference varchar(128), status varchar(24) NOT NULL DEFAULT 'preparation', scope text NOT NULL,
 locations text NOT NULL, "accountableManagerId" integer NOT NULL, "trainingManagerId" integer NOT NULL,
 "qualityManagerId" integer NOT NULL, "updatedAt" timestamp NOT NULL DEFAULT now(),
 CONSTRAINT operator_responsibilities_independent CHECK ("trainingManagerId" <> "qualityManagerId")
);
CREATE TABLE IF NOT EXISTS approval_documents (
 id serial PRIMARY KEY, kind varchar(24) NOT NULL, title varchar(255) NOT NULL, revision varchar(64) NOT NULL,
 "fileUrl" varchar(1024) NOT NULL, "fileName" varchar(255) NOT NULL, "uploadedBy" integer NOT NULL,
 "createdAt" timestamp NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS approval_findings (
 id serial PRIMARY KEY, title varchar(255) NOT NULL, reference varchar(128) NOT NULL, severity varchar(24) NOT NULL,
 description text NOT NULL, "ownerId" integer NOT NULL, "dueAt" timestamp NOT NULL,
 status varchar(24) NOT NULL DEFAULT 'open', "rootCause" text, "correctiveAction" text, "evidenceId" integer,
 "closureNote" text, "closedBy" integer, "closedAt" timestamp, "createdAt" timestamp NOT NULL DEFAULT now(), "updatedAt" timestamp NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS approval_events (
 id serial PRIMARY KEY, "actorId" integer NOT NULL, action varchar(32) NOT NULL, "entityId" integer NOT NULL,
 previous jsonb, current jsonb, "createdAt" timestamp NOT NULL DEFAULT now()
);
CREATE OR REPLACE FUNCTION preserve_approval_records() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Approval evidence and events are append-only'; END;
$$;
DROP TRIGGER IF EXISTS approval_events_immutable ON approval_events;
CREATE TRIGGER approval_events_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON approval_events
FOR EACH STATEMENT EXECUTE FUNCTION preserve_approval_records();
DROP TRIGGER IF EXISTS approval_documents_immutable ON approval_documents;
CREATE TRIGGER approval_documents_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON approval_documents
FOR EACH STATEMENT EXECUTE FUNCTION preserve_approval_records();
