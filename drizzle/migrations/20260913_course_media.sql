CREATE TABLE course_media (
 id serial PRIMARY KEY,
 "trainingId" integer NOT NULL REFERENCES trainings(id),
 "createdBy" integer NOT NULL REFERENCES users(id),
 "storageKey" varchar(1024) NOT NULL UNIQUE,
 "contentType" varchar(128) NOT NULL,
 "byteSize" integer NOT NULL CHECK ("byteSize" > 0 AND "byteSize" <= 52428800),
 sha256 varchar(64) NOT NULL,
 "createdAt" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX course_media_training_idx ON course_media("trainingId");
CREATE TRIGGER course_media_immutable BEFORE UPDATE OR DELETE ON course_media FOR EACH ROW EXECUTE FUNCTION reject_content_history_mutation();
CREATE TRIGGER course_media_no_truncate BEFORE TRUNCATE ON course_media FOR EACH STATEMENT EXECUTE FUNCTION reject_content_history_mutation();
