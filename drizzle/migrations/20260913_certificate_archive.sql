CREATE TABLE certificate_archives (
 "certificateId" integer PRIMARY KEY REFERENCES certificates(id),
 snapshot jsonb NOT NULL,
 "storageKey" varchar(512) NOT NULL UNIQUE,
 sha256 varchar(64) NOT NULL,
 "byteSize" integer NOT NULL CHECK("byteSize">0),
 "createdAt" timestamp NOT NULL DEFAULT now()
);
CREATE TRIGGER certificate_archive_retained BEFORE UPDATE OR DELETE ON certificate_archives FOR EACH ROW EXECUTE FUNCTION reject_content_history_mutation();
CREATE TRIGGER certificate_archive_no_truncate BEFORE TRUNCATE ON certificate_archives FOR EACH STATEMENT EXECUTE FUNCTION reject_content_history_mutation();
CREATE FUNCTION preserve_archived_certificate_identity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM certificate_archives WHERE "certificateId"=OLD.id)
 AND (to_jsonb(NEW)-'isValid') IS DISTINCT FROM (to_jsonb(OLD)-'isValid') THEN
  RAISE EXCEPTION 'Archived certificate identity is immutable';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER archived_certificate_identity BEFORE UPDATE ON certificates FOR EACH ROW EXECUTE FUNCTION preserve_archived_certificate_identity();
