CREATE TABLE live_video_tickets (
 id varchar(64) PRIMARY KEY,
 "userId" integer NOT NULL REFERENCES users(id),
 "roomType" varchar(16) NOT NULL CHECK ("roomType" IN ('session', 'webinar')),
 "roomId" integer NOT NULL,
 moderator boolean NOT NULL,
 "expiresAt" timestamp NOT NULL,
 "createdAt" timestamp NOT NULL DEFAULT now()
);
CREATE TRIGGER live_video_ticket_immutable BEFORE UPDATE OR DELETE ON live_video_tickets FOR EACH ROW EXECUTE FUNCTION reject_content_history_mutation();
CREATE TRIGGER live_video_ticket_no_truncate BEFORE TRUNCATE ON live_video_tickets FOR EACH STATEMENT EXECUTE FUNCTION reject_content_history_mutation();
