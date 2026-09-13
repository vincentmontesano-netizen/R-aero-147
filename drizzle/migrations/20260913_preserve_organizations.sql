-- Organizations are retained as the identity anchor for training/billing/compliance.
-- Use the audited suspension workflow; never cascade destructive cleanup.
CREATE FUNCTION preserve_organization_identity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 RAISE EXCEPTION 'Organization records must be retained; suspend the organization instead';
END $$;
CREATE TRIGGER organization_no_delete BEFORE DELETE ON companies FOR EACH ROW EXECUTE FUNCTION preserve_organization_identity();
CREATE TRIGGER organization_no_truncate BEFORE TRUNCATE ON companies FOR EACH STATEMENT EXECUTE FUNCTION preserve_organization_identity();
