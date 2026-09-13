CREATE TABLE live_replay_events (
 id serial PRIMARY KEY,
 "roomType" varchar(10) NOT NULL CHECK ("roomType" IN ('session','webinar')),
 "roomId" integer NOT NULL,
 "actorId" integer NOT NULL REFERENCES users(id),
 "previousStatus" varchar(32), status varchar(32) NOT NULL,
 "previousUrl" varchar(1024), url varchar(1024) NOT NULL,
 "createdAt" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX live_replay_events_room_idx ON live_replay_events ("roomType", "roomId", id);
CREATE TRIGGER live_replay_events_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON live_replay_events
 FOR EACH STATEMENT EXECUTE FUNCTION reject_content_history_mutation();
