CREATE TABLE credential_sharing_events (
 id serial PRIMARY KEY,
 "personId" integer NOT NULL REFERENCES users(id),
 "credentialId" integer NOT NULL REFERENCES credentials(id),
 "orgId" integer REFERENCES companies(id),
 action varchar(16) NOT NULL CHECK(action IN ('SHARED','WITHDRAWN')),
 "proofLabel" text,
 "orgName" text,
 "createdAt" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX credential_sharing_person_page ON credential_sharing_events ("personId",id DESC);
CREATE TRIGGER credential_sharing_retained BEFORE UPDATE OR DELETE ON credential_sharing_events FOR EACH ROW EXECUTE FUNCTION reject_content_history_mutation();
CREATE TRIGGER credential_sharing_no_truncate BEFORE TRUNCATE ON credential_sharing_events FOR EACH STATEMENT EXECUTE FUNCTION reject_content_history_mutation();
