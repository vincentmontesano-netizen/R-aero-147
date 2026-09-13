ALTER TABLE signoffs ADD COLUMN "requestId" varchar(36), ADD COLUMN "requestFingerprint" text;
CREATE UNIQUE INDEX signoff_manager_request ON signoffs ("managerPersonId", "requestId");
