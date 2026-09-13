ALTER TABLE users ADD COLUMN "sessionVersion" integer NOT NULL DEFAULT 0 CHECK ("sessionVersion" >= 0);
CREATE TABLE session_security_events (
 id bigserial PRIMARY KEY,
 "userId" integer NOT NULL REFERENCES users(id),
 "previousVersion" integer NOT NULL,
 "sessionVersion" integer NOT NULL,
 reason text NOT NULL,
 "createdAt" timestamp NOT NULL DEFAULT now()
);
CREATE TRIGGER session_security_event_immutable BEFORE UPDATE OR DELETE ON session_security_events FOR EACH ROW EXECUTE FUNCTION reject_content_history_mutation();
CREATE TRIGGER session_security_event_no_truncate BEFORE TRUNCATE ON session_security_events FOR EACH STATEMENT EXECUTE FUNCTION reject_content_history_mutation();
CREATE FUNCTION advance_user_session_version() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE change_reason text;
BEGIN
 IF NEW."passwordHash" IS DISTINCT FROM OLD."passwordHash" OR NEW.status IS DISTINCT FROM OLD.status THEN
  NEW."sessionVersion" := OLD."sessionVersion" + 1;
  NEW."twoFactorCode" := NULL;
  NEW."twoFactorExpiresAt" := NULL;
  change_reason := CASE WHEN NEW."passwordHash" IS DISTINCT FROM OLD."passwordHash" THEN 'password_changed' ELSE 'status_changed' END;
 ELSIF NEW."sessionVersion" < OLD."sessionVersion" THEN
  RAISE EXCEPTION 'Session version cannot decrease';
 ELSE
  change_reason := 'sessions_revoked';
 END IF;
 IF NEW."sessionVersion" > OLD."sessionVersion" THEN
  INSERT INTO session_security_events ("userId", "previousVersion", "sessionVersion", reason)
   VALUES (OLD.id, OLD."sessionVersion", NEW."sessionVersion", change_reason);
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER user_session_security BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION advance_user_session_version();
