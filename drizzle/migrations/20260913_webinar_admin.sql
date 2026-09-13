CREATE TABLE webinar_admin_events (
 id serial PRIMARY KEY, "webinarId" integer NOT NULL REFERENCES webinars(id), "actorId" integer NOT NULL REFERENCES users(id),
 action varchar(32) NOT NULL CHECK(action IN ('created','rescheduled','status')),
 previous jsonb, next jsonb NOT NULL, reason text NOT NULL, "createdAt" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX webinar_admin_events_room_idx ON webinar_admin_events("webinarId",id);
CREATE TRIGGER webinar_admin_events_immutable BEFORE UPDATE OR DELETE ON webinar_admin_events FOR EACH ROW EXECUTE FUNCTION reject_content_history_mutation();
CREATE TRIGGER webinar_admin_events_no_truncate BEFORE TRUNCATE ON webinar_admin_events FOR EACH STATEMENT EXECUTE FUNCTION reject_content_history_mutation();
CREATE TRIGGER webinar_no_delete BEFORE DELETE ON webinars FOR EACH ROW EXECUTE FUNCTION reject_content_history_mutation();
CREATE TRIGGER webinar_no_truncate BEFORE TRUNCATE ON webinars FOR EACH STATEMENT EXECUTE FUNCTION reject_content_history_mutation();
