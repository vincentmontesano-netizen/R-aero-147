ALTER TABLE users ALTER COLUMN "twoFactorCode" TYPE varchar(64);
ALTER TABLE users ADD COLUMN "twoFactorAttempts" integer NOT NULL DEFAULT 0 CHECK ("twoFactorAttempts" BETWEEN 0 AND 8);
ALTER TABLE users ADD COLUMN "twoFactorSentAt" timestamp;
-- Existing plaintext ten-minute challenges cannot be converted without the server key.
-- Require a new password-authenticated challenge after this migration.
UPDATE users SET "twoFactorCode" = NULL, "twoFactorExpiresAt" = NULL;
