-- Preserve pending reset links while replacing their stored bearer value with SHA-256.
UPDATE users SET "resetToken" = encode(sha256(convert_to("resetToken", 'UTF8')), 'hex') WHERE "resetToken" IS NOT NULL;
