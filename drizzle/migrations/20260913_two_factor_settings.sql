ALTER TABLE users ADD COLUMN "twoFactorPurpose" varchar(16) NOT NULL DEFAULT 'login' CHECK ("twoFactorPurpose" IN ('login', 'enable', 'disable'));
CREATE OR REPLACE FUNCTION advance_user_session_version() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE change_reason text;
BEGIN
 IF NEW."passwordHash" IS DISTINCT FROM OLD."passwordHash" OR NEW.status IS DISTINCT FROM OLD.status OR NEW."twoFactorEnabled" IS DISTINCT FROM OLD."twoFactorEnabled" THEN
  NEW."sessionVersion" := OLD."sessionVersion" + 1;
  NEW."twoFactorCode" := NULL;
  NEW."twoFactorExpiresAt" := NULL;
  change_reason := CASE WHEN NEW."passwordHash" IS DISTINCT FROM OLD."passwordHash" THEN 'password_changed' WHEN NEW.status IS DISTINCT FROM OLD.status THEN 'status_changed' ELSE 'two_factor_changed' END;
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
