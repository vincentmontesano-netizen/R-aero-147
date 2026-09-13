CREATE TABLE session_admission_events (
 id serial PRIMARY KEY, "sessionId" integer NOT NULL, "registrationId" integer NOT NULL,
 "userId" integer NOT NULL, action varchar(32) NOT NULL, "previousStatus" varchar(32), "nextStatus" varchar(32) NOT NULL,
 "createdAt" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX session_admission_events_user_idx ON session_admission_events("userId", id);
CREATE TRIGGER session_admission_events_immutable BEFORE UPDATE OR DELETE ON session_admission_events FOR EACH ROW EXECUTE FUNCTION reject_content_history_mutation();
CREATE TRIGGER session_admission_events_no_truncate BEFORE TRUNCATE ON session_admission_events FOR EACH STATEMENT EXECUTE FUNCTION reject_content_history_mutation();
CREATE FUNCTION preserve_session_registration() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Session registrations must be retained'; END IF;
 IF (to_jsonb(NEW) - 'status') IS DISTINCT FROM (to_jsonb(OLD) - 'status') OR (OLD.status <> 'registered' AND NEW.status <> OLD.status) THEN
  RAISE EXCEPTION 'Registration identity and final status are immutable';
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER session_registrations_retained BEFORE UPDATE OR DELETE ON session_registrations FOR EACH ROW EXECUTE FUNCTION preserve_session_registration();
CREATE TRIGGER session_registrations_no_truncate BEFORE TRUNCATE ON session_registrations FOR EACH STATEMENT EXECUTE FUNCTION reject_content_history_mutation();
