CREATE TABLE course_template_uses (
 "trainingId" integer PRIMARY KEY REFERENCES trainings(id),
 "templateId" integer NOT NULL REFERENCES course_templates(id),
 "createdBy" integer NOT NULL REFERENCES users(id),
 snapshot jsonb NOT NULL,
 "createdAt" timestamp NOT NULL DEFAULT now()
);
CREATE TRIGGER template_use_immutable BEFORE UPDATE OR DELETE ON course_template_uses FOR EACH ROW EXECUTE FUNCTION reject_content_history_mutation();
CREATE TRIGGER template_use_no_truncate BEFORE TRUNCATE ON course_template_uses FOR EACH STATEMENT EXECUTE FUNCTION reject_content_history_mutation();
