CREATE TABLE support_notification_outbox (
 id serial PRIMARY KEY, key varchar(64) NOT NULL UNIQUE,
 "ticketId" integer NOT NULL REFERENCES support_tickets(id),
 "messageId" integer REFERENCES messages(id), audience varchar(10) NOT NULL CHECK(audience IN ('admin','owner')),
 state varchar(16) NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','sending','accepted','unconfirmed')),
 recipient varchar(320), "createdAt" timestamp NOT NULL DEFAULT now(), "claimedAt" timestamp, "finishedAt" timestamp
);
CREATE INDEX support_notification_outbox_pending_idx ON support_notification_outbox(state,id);
CREATE FUNCTION preserve_support_notification() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Notification history must be retained'; END IF;
 IF (to_jsonb(NEW)-ARRAY['state','recipient','claimedAt','finishedAt']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['state','recipient','claimedAt','finishedAt']) THEN RAISE EXCEPTION 'Notification identity is immutable'; END IF;
 IF OLD.state='pending' AND NEW.state='sending' AND NEW.recipient IS NOT NULL AND NEW."claimedAt" IS NOT NULL AND NEW."finishedAt" IS NULL THEN RETURN NEW; END IF;
 IF OLD.state='sending' AND NEW.state IN ('accepted','unconfirmed') AND NEW.recipient IS NOT DISTINCT FROM OLD.recipient AND NEW."claimedAt" IS NOT DISTINCT FROM OLD."claimedAt" AND NEW."finishedAt" IS NOT NULL THEN RETURN NEW; END IF;
 RAISE EXCEPTION 'Invalid notification transition';
END $$;
CREATE TRIGGER support_notification_preserve BEFORE UPDATE OR DELETE ON support_notification_outbox FOR EACH ROW EXECUTE FUNCTION preserve_support_notification();
CREATE TRIGGER support_notification_no_truncate BEFORE TRUNCATE ON support_notification_outbox FOR EACH STATEMENT EXECUTE FUNCTION reject_content_history_mutation();
