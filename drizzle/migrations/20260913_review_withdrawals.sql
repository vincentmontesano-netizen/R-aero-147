CREATE TABLE pedagogical_withdrawals (
 id serial PRIMARY KEY, "reviewId" integer NOT NULL UNIQUE REFERENCES pedagogical_reviews(id),
 "withdrawnBy" integer NOT NULL, reason text NOT NULL, "createdAt" timestamp NOT NULL DEFAULT now()
);
CREATE TRIGGER pedagogical_withdrawals_immutable BEFORE UPDATE OR DELETE ON pedagogical_withdrawals FOR EACH ROW EXECUTE FUNCTION reject_content_history_mutation();
CREATE TRIGGER pedagogical_withdrawals_no_truncate BEFORE TRUNCATE ON pedagogical_withdrawals FOR EACH STATEMENT EXECUTE FUNCTION reject_content_history_mutation();
