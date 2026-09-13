ALTER TABLE training_modules ADD COLUMN IF NOT EXISTS "quizPassingScore" integer NOT NULL DEFAULT 75;
ALTER TABLE training_modules ADD COLUMN IF NOT EXISTS "quizMaxAttempts" integer NOT NULL DEFAULT 3;
ALTER TABLE training_modules ADD COLUMN IF NOT EXISTS "quizTimeLimitMin" integer;
