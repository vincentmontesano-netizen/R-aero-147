CREATE TABLE session_schedule_events (
 id serial PRIMARY KEY, "sessionId" integer NOT NULL REFERENCES sessions(id), "actorId" integer NOT NULL REFERENCES users(id),
 "previousStart" timestamp NOT NULL, "previousEnd" timestamp,
 "nextStart" timestamp NOT NULL, "nextEnd" timestamp NOT NULL,
 reason text NOT NULL CHECK(length(trim(reason)) BETWEEN 3 AND 1000), "createdAt" timestamp NOT NULL DEFAULT now(),
 CHECK("nextEnd">"nextStart")
);
CREATE INDEX session_schedule_history_idx ON session_schedule_events("sessionId",id);
CREATE TRIGGER session_schedule_immutable BEFORE UPDATE OR DELETE ON session_schedule_events FOR EACH ROW EXECUTE FUNCTION reject_content_history_mutation();
CREATE TRIGGER session_schedule_no_truncate BEFORE TRUNCATE ON session_schedule_events FOR EACH STATEMENT EXECUTE FUNCTION reject_content_history_mutation();
