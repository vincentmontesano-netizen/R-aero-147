CREATE TABLE live_instructor_assignments (
 id serial PRIMARY KEY, "roomType" varchar(10) NOT NULL CHECK("roomType" IN ('session','webinar')), "roomId" integer NOT NULL,
 "userId" integer NOT NULL REFERENCES users(id), active boolean NOT NULL,
 UNIQUE("roomType","roomId","userId")
);
CREATE TABLE live_instructor_events (
 id serial PRIMARY KEY, "assignmentId" integer NOT NULL REFERENCES live_instructor_assignments(id), "actorId" integer NOT NULL REFERENCES users(id),
 "previousActive" boolean NOT NULL, active boolean NOT NULL, reason text NOT NULL CHECK(length(trim(reason)) BETWEEN 3 AND 1000), "createdAt" timestamp NOT NULL DEFAULT now()
);
CREATE TRIGGER live_instructor_events_immutable BEFORE UPDATE OR DELETE ON live_instructor_events FOR EACH ROW EXECUTE FUNCTION reject_content_history_mutation();
CREATE TRIGGER live_instructor_events_no_truncate BEFORE TRUNCATE ON live_instructor_events FOR EACH STATEMENT EXECUTE FUNCTION reject_content_history_mutation();
CREATE FUNCTION preserve_live_instructor_identity() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF TG_OP='DELETE' OR (to_jsonb(NEW)-'active') IS DISTINCT FROM (to_jsonb(OLD)-'active') THEN RAISE EXCEPTION 'Instructor assignment identity must be retained'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER live_instructor_identity BEFORE UPDATE OR DELETE ON live_instructor_assignments FOR EACH ROW EXECUTE FUNCTION preserve_live_instructor_identity();
CREATE TRIGGER live_instructor_no_truncate BEFORE TRUNCATE ON live_instructor_assignments FOR EACH STATEMENT EXECUTE FUNCTION reject_content_history_mutation();
