-- Existing creators are unknown; do not infer them from later archive actions.
ALTER TABLE role_requirements ADD COLUMN "createdBy" integer REFERENCES users(id);
-- protect_role_requirement already compares every field except archive metadata,
-- so this new attribution is immutable together with the original definition.
