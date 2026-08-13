INSERT INTO metric_definitions (code, unit, rollup_method)
VALUES ('weight_body_mass', 'kg', 'latest');

CREATE TRIGGER metric_samples_weight_conflict
BEFORE INSERT ON metric_samples
WHEN NEW.metric_id = (
	SELECT id FROM metric_definitions WHERE code = 'weight_body_mass'
) AND EXISTS (
	SELECT 1
	FROM metric_samples AS existing
	WHERE existing.metric_id = NEW.metric_id
		AND existing.observed_at_ms = NEW.observed_at_ms
		AND IFNULL(existing.source_name, '') = IFNULL(NEW.source_name, '')
		AND existing.semantic_key <> NEW.semantic_key
)
BEGIN
	SELECT RAISE(ABORT, 'weight_observation_conflict');
END;
