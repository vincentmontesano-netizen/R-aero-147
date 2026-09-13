ALTER TABLE passport_documents ADD COLUMN "archivedAt" timestamp, ADD COLUMN "sha256" varchar(64);
CREATE TABLE passport_events (
 id serial PRIMARY KEY, "personId" integer NOT NULL, "documentId" integer,
 "actorId" integer NOT NULL, action varchar(32) NOT NULL, data jsonb NOT NULL,
 "createdAt" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX passport_events_person_idx ON passport_events("personId", id);
CREATE FUNCTION preserve_passport_document() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Passport documents must be archived'; END IF;
 IF OLD."archivedAt" IS NOT NULL OR (to_jsonb(NEW) - 'archivedAt' - 'updatedAt') IS DISTINCT FROM (to_jsonb(OLD) - 'archivedAt' - 'updatedAt') THEN
   RAISE EXCEPTION 'Passport evidence is immutable';
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER passport_documents_immutable BEFORE UPDATE OR DELETE ON passport_documents FOR EACH ROW EXECUTE FUNCTION preserve_passport_document();
CREATE TRIGGER passport_documents_no_truncate BEFORE TRUNCATE ON passport_documents FOR EACH STATEMENT EXECUTE FUNCTION reject_content_history_mutation();
CREATE TRIGGER passport_events_immutable BEFORE UPDATE OR DELETE ON passport_events FOR EACH ROW EXECUTE FUNCTION reject_content_history_mutation();
CREATE TRIGGER passport_events_no_truncate BEFORE TRUNCATE ON passport_events FOR EACH STATEMENT EXECUTE FUNCTION reject_content_history_mutation();
