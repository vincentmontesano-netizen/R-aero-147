CREATE TABLE course_copies (
 "trainingId" integer PRIMARY KEY REFERENCES trainings(id),
 "sourceTrainingId" integer NOT NULL REFERENCES trainings(id),
 "createdBy" integer NOT NULL REFERENCES users(id),
 snapshot jsonb NOT NULL,
 "createdAt" timestamp NOT NULL DEFAULT now()
);
CREATE TABLE copied_course_media (
 "trainingId" integer NOT NULL REFERENCES course_copies("trainingId"),
 "storageKey" varchar(1024) NOT NULL,
 PRIMARY KEY ("trainingId", "storageKey")
);
CREATE INDEX copied_course_media_key_idx ON copied_course_media("storageKey");
CREATE TRIGGER course_copy_immutable BEFORE UPDATE OR DELETE ON course_copies FOR EACH ROW EXECUTE FUNCTION reject_content_history_mutation();
CREATE TRIGGER course_copy_no_truncate BEFORE TRUNCATE ON course_copies FOR EACH STATEMENT EXECUTE FUNCTION reject_content_history_mutation();
CREATE TRIGGER copied_media_immutable BEFORE UPDATE OR DELETE ON copied_course_media FOR EACH ROW EXECUTE FUNCTION reject_content_history_mutation();
CREATE TRIGGER copied_media_no_truncate BEFORE TRUNCATE ON copied_course_media FOR EACH STATEMENT EXECUTE FUNCTION reject_content_history_mutation();
