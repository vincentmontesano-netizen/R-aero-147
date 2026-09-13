CREATE TABLE legacy_course_media_links (
 "storageKey" varchar(1024) NOT NULL,
 "trainingId" integer NOT NULL REFERENCES trainings(id),
 "capturedAt" timestamp NOT NULL DEFAULT now(),
 PRIMARY KEY ("storageKey", "trainingId")
);
-- Capture existing references once, before making the old namespace private.
-- No later authoring operation may infer ownership merely from a pasted URL.
INSERT INTO legacy_course_media_links ("storageKey", "trainingId")
SELECT DISTINCT matched[1], source."trainingId"
FROM (
 SELECT id AS "trainingId", to_jsonb(t)::text AS payload FROM trainings t
 UNION ALL SELECT "trainingId", to_jsonb(m)::text FROM training_modules m
 UNION ALL SELECT "trainingId", to_jsonb(s)::text FROM slides s
 UNION ALL SELECT "trainingId", snapshot::text FROM training_versions
 UNION ALL SELECT "trainingId", snapshot::text FROM pedagogical_reviews
) source
CROSS JOIN LATERAL regexp_matches(source.payload, '/storage/(courses/[A-Za-z0-9/_.-]+)', 'g') matched
JOIN trainings t ON t.id = source."trainingId"
ON CONFLICT DO NOTHING;
CREATE TRIGGER legacy_media_links_immutable BEFORE UPDATE OR DELETE ON legacy_course_media_links FOR EACH ROW EXECUTE FUNCTION reject_content_history_mutation();
CREATE TRIGGER legacy_media_links_no_truncate BEFORE TRUNCATE ON legacy_course_media_links FOR EACH STATEMENT EXECUTE FUNCTION reject_content_history_mutation();
