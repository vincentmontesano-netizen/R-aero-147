ALTER TABLE broadcast_runs ADD COLUMN "requestId" varchar(36), ADD COLUMN fingerprint varchar(64);
ALTER TABLE broadcast_runs ADD CONSTRAINT broadcast_request_pair CHECK (("requestId" IS NULL) = (fingerprint IS NULL));
CREATE UNIQUE INDEX broadcast_actor_request_key ON broadcast_runs ("actorId", "requestId");
