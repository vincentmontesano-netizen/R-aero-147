ALTER TABLE passport_documents ADD COLUMN IF NOT EXISTS "requestId" varchar(36);
CREATE UNIQUE INDEX IF NOT EXISTS passport_documents_person_request_key ON passport_documents ("personId", "requestId");
