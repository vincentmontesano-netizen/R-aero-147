CREATE TABLE ai_outline_drafts (
 id serial PRIMARY KEY, "requestId" varchar(36) NOT NULL UNIQUE REFERENCES ai_requests(id), "ownerUserId" integer NOT NULL REFERENCES users(id),
 "ownerOrgId" integer REFERENCES companies(id), language varchar(8) NOT NULL, output jsonb NOT NULL CHECK(octet_length(output::text)<=1048576),
 "trainingId" integer REFERENCES trainings(id), "createdAt" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX ai_outline_owner_idx ON ai_outline_drafts("ownerUserId",id);
CREATE FUNCTION preserve_ai_outline() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF TG_OP='DELETE' OR OLD."trainingId" IS NOT NULL OR NEW."trainingId" IS NULL OR (to_jsonb(NEW)-'trainingId') IS DISTINCT FROM (to_jsonb(OLD)-'trainingId') THEN RAISE EXCEPTION 'AI outline evidence must be retained'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER ai_outline_retained BEFORE UPDATE OR DELETE ON ai_outline_drafts FOR EACH ROW EXECUTE FUNCTION preserve_ai_outline();
CREATE TRIGGER ai_outline_no_truncate BEFORE TRUNCATE ON ai_outline_drafts FOR EACH STATEMENT EXECUTE FUNCTION reject_content_history_mutation();
