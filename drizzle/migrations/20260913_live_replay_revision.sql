ALTER TABLE sessions ADD COLUMN "replayRevision" integer NOT NULL DEFAULT 0;
ALTER TABLE webinars ADD COLUMN "replayRevision" integer NOT NULL DEFAULT 0;
CREATE FUNCTION advance_live_replay_revision() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF NEW."replayRevision" IS DISTINCT FROM OLD."replayRevision" THEN
  RAISE EXCEPTION 'Replay revision is managed by the database';
 END IF;
 IF NEW."replayUrl" IS DISTINCT FROM OLD."replayUrl" OR NEW.status IS DISTINCT FROM OLD.status THEN
  NEW."replayRevision" := OLD."replayRevision" + 1;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER sessions_replay_revision BEFORE UPDATE ON sessions FOR EACH ROW EXECUTE FUNCTION advance_live_replay_revision();
CREATE TRIGGER webinars_replay_revision BEFORE UPDATE ON webinars FOR EACH ROW EXECUTE FUNCTION advance_live_replay_revision();
