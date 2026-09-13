ALTER TABLE approval_documents ADD COLUMN "requestId" varchar(36), ADD COLUMN fingerprint varchar(64);
CREATE UNIQUE INDEX approval_documents_uploader_request_key ON approval_documents ("uploadedBy", "requestId");
