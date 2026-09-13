CREATE TABLE broadcast_runs (
 id serial PRIMARY KEY, "actorId" integer NOT NULL REFERENCES users(id), title varchar(255) NOT NULL,
 audience varchar(64), "userId" integer, recipients integer NOT NULL CHECK (recipients >= 0),
 sent integer NOT NULL CHECK (sent >= 0 AND sent <= recipients), "emailRequested" boolean NOT NULL,
 "createdAt" timestamp NOT NULL DEFAULT now(), CHECK ((audience IS NULL) <> ("userId" IS NULL))
);
CREATE TABLE broadcast_outcomes (
 "runId" integer PRIMARY KEY REFERENCES broadcast_runs(id), accepted integer NOT NULL CHECK (accepted >= 0),
 failed integer NOT NULL CHECK (failed >= 0), skipped integer NOT NULL CHECK (skipped >= 0), "completedAt" timestamp NOT NULL DEFAULT now()
);
CREATE FUNCTION validate_broadcast_outcome() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE run broadcast_runs%ROWTYPE;
BEGIN
 SELECT * INTO STRICT run FROM broadcast_runs WHERE id = NEW."runId";
 IF NEW.accepted::bigint + NEW.failed::bigint + NEW.skipped::bigint <> (CASE WHEN run."emailRequested" THEN run.recipients ELSE 0 END) THEN
  RAISE EXCEPTION 'Broadcast outcome does not account for the targeted recipients';
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER broadcast_outcome_consistent BEFORE INSERT ON broadcast_outcomes FOR EACH ROW EXECUTE FUNCTION validate_broadcast_outcome();
CREATE TRIGGER broadcast_runs_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON broadcast_runs FOR EACH STATEMENT EXECUTE FUNCTION reject_content_history_mutation();
CREATE TRIGGER broadcast_outcomes_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON broadcast_outcomes FOR EACH STATEMENT EXECUTE FUNCTION reject_content_history_mutation();
