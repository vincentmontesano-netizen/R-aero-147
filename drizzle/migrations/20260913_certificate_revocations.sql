CREATE TABLE certificate_revocations (
 "certificateId" integer PRIMARY KEY REFERENCES certificates(id),
 "actorId" integer NOT NULL REFERENCES users(id),
 reason varchar(2000) NOT NULL CHECK(length(trim(reason))>=10),
 "createdAt" timestamp NOT NULL DEFAULT now()
);
CREATE TRIGGER certificate_revocation_retained BEFORE UPDATE OR DELETE ON certificate_revocations FOR EACH ROW EXECUTE FUNCTION reject_content_history_mutation();
CREATE TRIGGER certificate_revocation_no_truncate BEFORE TRUNCATE ON certificate_revocations FOR EACH STATEMENT EXECUTE FUNCTION reject_content_history_mutation();
CREATE FUNCTION prevent_revoked_certificate_reactivation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW."isValid" IS TRUE AND EXISTS(SELECT 1 FROM certificate_revocations WHERE "certificateId"=OLD.id) THEN
  RAISE EXCEPTION 'An audited certificate revocation cannot be undone';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER certificate_revocation_final BEFORE UPDATE ON certificates FOR EACH ROW EXECUTE FUNCTION prevent_revoked_certificate_reactivation();
