CREATE TABLE payment_reconciliations (
  id serial PRIMARY KEY,
  "orderId" integer NOT NULL REFERENCES orders(id),
  "actorId" integer NOT NULL,
  "sessionId" varchar(255) NOT NULL,
  "sessionStatus" varchar(32) NOT NULL,
  "paymentStatus" varchar(32) NOT NULL,
  "amountCents" integer NOT NULL,
  currency varchar(8) NOT NULL,
  "previousOrderStatus" varchar(32) NOT NULL,
  "createdAt" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX payment_reconciliations_order_idx ON payment_reconciliations("orderId", id);
CREATE TRIGGER payment_reconciliations_immutable BEFORE UPDATE OR DELETE ON payment_reconciliations
  FOR EACH ROW EXECUTE FUNCTION reject_content_history_mutation();
CREATE TRIGGER payment_reconciliations_no_truncate BEFORE TRUNCATE ON payment_reconciliations
  FOR EACH STATEMENT EXECUTE FUNCTION reject_content_history_mutation();
