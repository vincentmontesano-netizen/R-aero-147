ALTER TABLE trainings ADD COLUMN IF NOT EXISTS "ownerUserId" integer;
ALTER TABLE trainings ADD COLUMN IF NOT EXISTS "ownerOrgId" integer;
CREATE INDEX IF NOT EXISTS training_owner_user_idx ON trainings ("ownerUserId");
CREATE INDEX IF NOT EXISTS training_owner_org_idx ON trainings ("ownerOrgId");
