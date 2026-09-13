-- Existing evidence remains intact; legacy requests have no deduplication key.
ALTER TABLE verification_documents ADD COLUMN "requestId" varchar(36), ADD COLUMN "sha256" varchar(64);
CREATE UNIQUE INDEX verification_documents_uploader_request_key ON verification_documents ("uploadedBy", "requestId");
CREATE FUNCTION preserve_verification_document() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Verification documents must be archived'; END IF;
 IF OLD."archivedAt" IS NOT NULL OR (to_jsonb(NEW) - 'archivedAt') IS DISTINCT FROM (to_jsonb(OLD) - 'archivedAt') THEN
   RAISE EXCEPTION 'Verification evidence is immutable';
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER verification_documents_immutable BEFORE UPDATE OR DELETE ON verification_documents FOR EACH ROW EXECUTE FUNCTION preserve_verification_document();
CREATE TRIGGER verification_documents_no_truncate BEFORE TRUNCATE ON verification_documents FOR EACH STATEMENT EXECUTE FUNCTION preserve_verification_events();
