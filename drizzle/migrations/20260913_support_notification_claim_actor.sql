ALTER TABLE support_notification_outbox ADD COLUMN "claimedBy" integer REFERENCES users(id);
CREATE OR REPLACE FUNCTION preserve_support_notification() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Notification history must be retained'; END IF;
 IF (to_jsonb(NEW)-ARRAY['state','recipient','claimedAt','finishedAt','claimedBy']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['state','recipient','claimedAt','finishedAt','claimedBy']) THEN RAISE EXCEPTION 'Notification identity is immutable'; END IF;
 IF OLD.state='pending' AND NEW.state='sending' AND NEW.recipient IS NOT NULL AND NEW."claimedAt" IS NOT NULL AND NEW."finishedAt" IS NULL THEN RETURN NEW; END IF;
 IF OLD.state='sending' AND NEW.state IN ('accepted','unconfirmed') AND NEW.recipient IS NOT DISTINCT FROM OLD.recipient AND NEW."claimedAt" IS NOT DISTINCT FROM OLD."claimedAt" AND NEW."claimedBy" IS NOT DISTINCT FROM OLD."claimedBy" AND NEW."finishedAt" IS NOT NULL THEN RETURN NEW; END IF;
 RAISE EXCEPTION 'Invalid notification transition';
END $$;
