ALTER TABLE support_tickets ADD COLUMN "requestKind" varchar(24) NOT NULL DEFAULT 'GENERAL' CHECK("requestKind" IN ('GENERAL','DATA_ACCESS','RECTIFICATION','ERASURE'));
CREATE FUNCTION preserve_support_request_kind() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW."requestKind" IS DISTINCT FROM OLD."requestKind" THEN RAISE EXCEPTION 'Original support request kind is retained'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER support_request_kind_retained BEFORE UPDATE ON support_tickets FOR EACH ROW EXECUTE FUNCTION preserve_support_request_kind();
