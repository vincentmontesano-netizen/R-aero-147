CREATE TABLE exam_finalization_failures (
 id serial PRIMARY KEY, "examSessionId" integer NOT NULL, "errorCode" varchar(64) NOT NULL,
 "retryAfter" timestamp NOT NULL, "createdAt" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX exam_finalization_failures_retry_idx ON exam_finalization_failures("examSessionId", "retryAfter");
CREATE TRIGGER exam_finalization_failures_immutable BEFORE UPDATE OR DELETE ON exam_finalization_failures FOR EACH ROW EXECUTE FUNCTION reject_content_history_mutation();
CREATE TRIGGER exam_finalization_failures_no_truncate BEFORE TRUNCATE ON exam_finalization_failures FOR EACH STATEMENT EXECUTE FUNCTION reject_content_history_mutation();
