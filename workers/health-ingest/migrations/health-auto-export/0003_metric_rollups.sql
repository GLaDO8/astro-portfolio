UPDATE metric_definitions SET rollup_method = 'none'
WHERE code IN ('environmental_audio_exposure', 'headphone_audio_exposure');

CREATE TABLE metric_rollups (
	metric_id INTEGER NOT NULL REFERENCES metric_definitions(id),
	grain TEXT NOT NULL CHECK (grain IN ('day', 'week', 'month')),
	period_start TEXT NOT NULL CHECK (period_start GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
	sample_count INTEGER NOT NULL CHECK (sample_count > 0),
	value_sum REAL NOT NULL,
	value_min REAL NOT NULL,
	value_max REAL NOT NULL,
	latest_value REAL NOT NULL,
	latest_observed_at_ms INTEGER NOT NULL,
	latest_sample_id INTEGER NOT NULL,
	aggregation_version INTEGER NOT NULL,
	PRIMARY KEY (metric_id, grain, period_start)
) STRICT, WITHOUT ROWID;

CREATE TABLE metric_rollup_state (
	singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
	aggregation_version INTEGER NOT NULL,
	status TEXT NOT NULL CHECK (status IN ('needs_backfill', 'building', 'ready')),
	data_revision INTEGER NOT NULL CHECK (data_revision >= 0),
	last_complete_delivery_id INTEGER REFERENCES raw_deliveries(id),
	first_local_date TEXT CHECK (first_local_date IS NULL OR first_local_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
	last_local_date TEXT CHECK (last_local_date IS NULL OR last_local_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
	refreshed_at_ms INTEGER NOT NULL
) STRICT;

INSERT INTO metric_rollup_state (
	singleton,
	aggregation_version,
	status,
	data_revision,
	last_complete_delivery_id,
	first_local_date,
	last_local_date,
	refreshed_at_ms
)
SELECT
	1,
	1,
	CASE WHEN EXISTS (SELECT 1 FROM metric_samples) THEN 'needs_backfill' ELSE 'ready' END,
	0,
	NULL,
	NULL,
	NULL,
	unixepoch('subsec') * 1000;
