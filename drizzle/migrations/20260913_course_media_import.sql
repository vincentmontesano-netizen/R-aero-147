ALTER TABLE course_media ADD COLUMN origin varchar(16) NOT NULL DEFAULT 'generated' CHECK (origin IN ('generated', 'uploaded'));
