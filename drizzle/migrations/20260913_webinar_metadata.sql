ALTER TABLE webinar_admin_events DROP CONSTRAINT webinar_admin_events_action_check;
ALTER TABLE webinar_admin_events ADD CONSTRAINT webinar_admin_events_action_check CHECK(action IN ('created','rescheduled','status','metadata'));
