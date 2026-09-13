CREATE TABLE objective_creation_requests (
 id serial PRIMARY KEY,
 "actorId" integer NOT NULL REFERENCES users(id),
 "requestId" varchar(36) NOT NULL,
 "objectiveId" integer NOT NULL UNIQUE REFERENCES learning_objectives(id),
 fingerprint varchar(64) NOT NULL,
 "createdAt" timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX objective_creation_actor_request_key ON objective_creation_requests ("actorId", "requestId");
CREATE TRIGGER objective_creation_requests_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON objective_creation_requests
FOR EACH STATEMENT EXECUTE FUNCTION reject_content_history_mutation();
