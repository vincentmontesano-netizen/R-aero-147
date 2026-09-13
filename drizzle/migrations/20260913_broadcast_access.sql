ALTER TABLE broadcast_recipient_outcomes DROP CONSTRAINT broadcast_recipient_outcomes_status_check;
ALTER TABLE broadcast_recipient_outcomes ADD CONSTRAINT broadcast_recipient_outcomes_status_check
CHECK (status IN ('accepted','unconfirmed','skipped_configuration','skipped_missing_email','skipped_access','not_requested'));
