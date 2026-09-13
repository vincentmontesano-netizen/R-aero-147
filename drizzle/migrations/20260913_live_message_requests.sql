ALTER TABLE live_messages ADD COLUMN IF NOT EXISTS "requestId" varchar(36);
CREATE UNIQUE INDEX IF NOT EXISTS live_messages_user_request_key ON live_messages ("userId", "requestId");
