CREATE TABLE module_creation_requests (
 id serial PRIMARY KEY,
 "actorId" integer NOT NULL REFERENCES users(id),
 "requestId" varchar(36) NOT NULL,
 "moduleId" integer NOT NULL UNIQUE REFERENCES training_modules(id),
 fingerprint varchar(64) NOT NULL,
 "createdAt" timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX module_creation_actor_request_key ON module_creation_requests ("actorId", "requestId");
CREATE TRIGGER module_creation_requests_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON module_creation_requests
FOR EACH STATEMENT EXECUTE FUNCTION reject_content_history_mutation();
