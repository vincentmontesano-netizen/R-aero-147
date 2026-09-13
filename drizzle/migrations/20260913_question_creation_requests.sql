CREATE TABLE question_creation_requests (
 id serial PRIMARY KEY,
 "actorId" integer NOT NULL REFERENCES users(id),
 "requestId" varchar(36) NOT NULL,
 "questionId" integer NOT NULL UNIQUE REFERENCES quiz_questions(id),
 fingerprint varchar(64) NOT NULL,
 "createdAt" timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX question_creation_actor_request_key ON question_creation_requests ("actorId", "requestId");
CREATE TRIGGER question_creation_requests_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON question_creation_requests
FOR EACH STATEMENT EXECUTE FUNCTION reject_content_history_mutation();
