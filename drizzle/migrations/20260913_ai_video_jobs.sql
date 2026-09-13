CREATE TABLE ai_video_jobs (
 id varchar(36) PRIMARY KEY, "userId" integer NOT NULL REFERENCES users(id), "trainingId" integer NOT NULL REFERENCES trainings(id), "ownerOrgId" integer REFERENCES companies(id),
 model varchar(100) NOT NULL, input jsonb NOT NULL CHECK(octet_length(input::text)<=32768),
 status varchar(12) NOT NULL DEFAULT 'submitting' CHECK(status IN ('submitting','running','ready','failed','unknown')),
 "operationName" varchar(300) UNIQUE, "mediaId" integer REFERENCES course_media(id),
 "createdAt" timestamp NOT NULL DEFAULT now(), "checkedAt" timestamp,
 CHECK((status IN ('submitting','unknown') OR "operationName" IS NOT NULL) AND ((status='ready')=("mediaId" IS NOT NULL)))
);
CREATE INDEX ai_video_jobs_owner_idx ON ai_video_jobs("userId","trainingId","createdAt");
CREATE FUNCTION preserve_ai_video_job() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Video generation evidence must be retained'; END IF;
 IF OLD.status IN ('ready','failed','unknown') OR
 (to_jsonb(NEW)-ARRAY['status','operationName','mediaId','checkedAt']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','operationName','mediaId','checkedAt']) OR
 (OLD."operationName" IS NOT NULL AND NEW."operationName" IS DISTINCT FROM OLD."operationName") OR
 (OLD.status='submitting' AND NEW.status NOT IN ('running','unknown')) OR
 (OLD.status='running' AND NEW.status NOT IN ('running','ready','failed','unknown')) THEN RAISE EXCEPTION 'Video generation identity and final outcome are immutable'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER ai_video_job_retained BEFORE UPDATE OR DELETE ON ai_video_jobs FOR EACH ROW EXECUTE FUNCTION preserve_ai_video_job();
CREATE TRIGGER ai_video_job_no_truncate BEFORE TRUNCATE ON ai_video_jobs FOR EACH STATEMENT EXECUTE FUNCTION reject_content_history_mutation();
