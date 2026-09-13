CREATE TABLE live_presence_intervals (
 id serial PRIMARY KEY,
 "roomType" varchar(16) NOT NULL, "roomId" integer NOT NULL, "userId" integer NOT NULL,
 "startedAt" timestamp NOT NULL, "endedAt" timestamp NOT NULL,
 "creditedMilliseconds" integer NOT NULL CHECK ("creditedMilliseconds" BETWEEN 0 AND 45000),
 CHECK ("endedAt" > "startedAt")
);
CREATE INDEX live_presence_room_idx ON live_presence_intervals("roomType", "roomId", id);
CREATE TRIGGER live_presence_immutable BEFORE UPDATE OR DELETE ON live_presence_intervals FOR EACH ROW EXECUTE FUNCTION reject_content_history_mutation();
CREATE TRIGGER live_presence_no_truncate BEFORE TRUNCATE ON live_presence_intervals FOR EACH STATEMENT EXECUTE FUNCTION reject_content_history_mutation();
