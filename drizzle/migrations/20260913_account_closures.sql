CREATE TABLE account_closures (
 "personId" integer PRIMARY KEY REFERENCES users(id),
 "actorId" integer NOT NULL REFERENCES users(id),
 "retainedCredentials" integer NOT NULL,
 "createdAt" timestamp NOT NULL DEFAULT now()
);
CREATE TRIGGER account_closure_retained BEFORE UPDATE OR DELETE ON account_closures FOR EACH ROW EXECUTE FUNCTION reject_content_history_mutation();
CREATE TRIGGER account_closure_no_truncate BEFORE TRUNCATE ON account_closures FOR EACH STATEMENT EXECUTE FUNCTION reject_content_history_mutation();
CREATE FUNCTION prevent_closed_account_reactivation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.status='active' AND EXISTS(SELECT 1 FROM account_closures WHERE "personId"=OLD.id) THEN
  RAISE EXCEPTION 'A closed account cannot be reactivated';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER account_closure_final BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION prevent_closed_account_reactivation();
