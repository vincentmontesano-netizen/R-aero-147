CREATE TABLE ai_requests (
 id varchar(36) PRIMARY KEY, "userId" integer NOT NULL REFERENCES users(id),
 operation varchar(16) NOT NULL CHECK(operation IN ('outline','slide_text','quiz','image','speech')),
 category varchar(10) NOT NULL CHECK(category IN ('text','image','speech')),
 status varchar(12) NOT NULL DEFAULT 'running' CHECK(status IN ('running','succeeded','failed')),
 "startedAt" timestamp NOT NULL DEFAULT now(), "expiresAt" timestamp NOT NULL DEFAULT now()+interval '15 minutes', "finishedAt" timestamp,
 CHECK((status='running' AND "finishedAt" IS NULL) OR (status<>'running' AND "finishedAt" IS NOT NULL))
);
CREATE INDEX ai_requests_user_time_idx ON ai_requests("userId","startedAt");
CREATE FUNCTION preserve_ai_request() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'AI request records must be retained'; END IF;
 IF OLD.status<>'running' OR NEW.status='running' OR
 (to_jsonb(NEW)-ARRAY['status','finishedAt']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','finishedAt']) THEN RAISE EXCEPTION 'AI request identity and final outcome are immutable'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER ai_request_retained BEFORE UPDATE OR DELETE ON ai_requests FOR EACH ROW EXECUTE FUNCTION preserve_ai_request();
CREATE TRIGGER ai_request_no_truncate BEFORE TRUNCATE ON ai_requests FOR EACH STATEMENT EXECUTE FUNCTION reject_content_history_mutation();
