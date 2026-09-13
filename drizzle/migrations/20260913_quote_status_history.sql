ALTER TABLE quote_requests ADD COLUMN revision integer NOT NULL DEFAULT 0;
CREATE TABLE quote_status_events (
 id serial PRIMARY KEY,
 "quoteId" integer NOT NULL REFERENCES quote_requests(id),
 "actorId" integer REFERENCES users(id),
 "previousStatus" quote_status NOT NULL,
 status quote_status NOT NULL,
 revision integer NOT NULL,
 "createdAt" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX quote_status_events_quote_idx ON quote_status_events ("quoteId", id DESC);
CREATE TRIGGER quote_status_events_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON quote_status_events
FOR EACH STATEMENT EXECUTE FUNCTION reject_content_history_mutation();
CREATE FUNCTION record_quote_status_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 NEW.revision := OLD.revision;
 IF NEW.status IS DISTINCT FROM OLD.status THEN
  NEW.revision := OLD.revision + 1;
  INSERT INTO quote_status_events ("quoteId", "actorId", "previousStatus", status, revision)
  VALUES (OLD.id, NULLIF(current_setting('raero.quote_actor_id', true), '')::integer, OLD.status, NEW.status, NEW.revision);
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER quote_status_change BEFORE UPDATE ON quote_requests
FOR EACH ROW EXECUTE FUNCTION record_quote_status_change();
