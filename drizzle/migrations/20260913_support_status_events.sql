CREATE TABLE support_status_events (
 id serial PRIMARY KEY,
 "ticketId" integer NOT NULL REFERENCES support_tickets(id),
 "actorId" integer NOT NULL REFERENCES users(id),
 "actorName" text,
 "previousStatus" varchar(16),
 status varchar(16) NOT NULL CHECK(status IN ('OPEN','PENDING','CLOSED')),
 reason varchar(2000),
 "createdAt" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX support_status_ticket_page ON support_status_events ("ticketId",id DESC);
CREATE TRIGGER support_status_retained BEFORE UPDATE OR DELETE ON support_status_events FOR EACH ROW EXECUTE FUNCTION reject_content_history_mutation();
CREATE TRIGGER support_status_no_truncate BEFORE TRUNCATE ON support_status_events FOR EACH STATEMENT EXECUTE FUNCTION reject_content_history_mutation();
