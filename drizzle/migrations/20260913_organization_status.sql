CREATE TABLE organization_status_events (
 id bigserial PRIMARY KEY,
 "companyId" integer NOT NULL REFERENCES companies(id),
 "actorId" integer NOT NULL REFERENCES users(id),
 "previousStatus" varchar(16),
 status varchar(16) NOT NULL CHECK (status IN ('ACTIVE','SUSPENDED')),
 "createdAt" timestamp NOT NULL DEFAULT now()
);
CREATE TRIGGER organization_status_event_immutable BEFORE UPDATE OR DELETE ON organization_status_events FOR EACH ROW EXECUTE FUNCTION reject_content_history_mutation();
CREATE TRIGGER organization_status_event_no_truncate BEFORE TRUNCATE ON organization_status_events FOR EACH STATEMENT EXECUTE FUNCTION reject_content_history_mutation();
