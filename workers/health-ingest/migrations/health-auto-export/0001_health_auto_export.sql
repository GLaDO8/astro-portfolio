PRAGMA foreign_keys = ON;

CREATE TABLE raw_deliveries (
	id INTEGER PRIMARY KEY,
	object_key TEXT NOT NULL UNIQUE,
	payload_sha256 TEXT NOT NULL UNIQUE CHECK (length(payload_sha256) = 64),
	received_at_ms INTEGER NOT NULL,
	observed_start_ms INTEGER NOT NULL,
	observed_end_ms INTEGER NOT NULL CHECK (observed_end_ms >= observed_start_ms),
	transform_status TEXT NOT NULL CHECK (transform_status IN ('pending', 'complete', 'failed'))
) STRICT;

CREATE TABLE metric_definitions (
	id INTEGER PRIMARY KEY,
	code TEXT NOT NULL UNIQUE,
	unit TEXT NOT NULL,
	rollup_method TEXT NOT NULL CHECK (rollup_method IN ('sum', 'average', 'latest', 'range', 'none'))
) STRICT;

CREATE TABLE metric_samples (
	id INTEGER PRIMARY KEY,
	delivery_id INTEGER NOT NULL REFERENCES raw_deliveries(id),
	metric_id INTEGER NOT NULL REFERENCES metric_definitions(id),
	observed_at_ms INTEGER NOT NULL,
	local_date TEXT NOT NULL CHECK (local_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
	utc_offset_minutes INTEGER NOT NULL CHECK (utc_offset_minutes BETWEEN -1439 AND 1439),
	value REAL NOT NULL,
	value_min REAL,
	value_max REAL,
	source_name TEXT,
	semantic_key TEXT NOT NULL UNIQUE CHECK (length(semantic_key) = 64),
	CHECK ((value_min IS NULL AND value_max IS NULL) OR value_min <= value_max)
) STRICT;

CREATE INDEX metric_samples_observed_at ON metric_samples(metric_id, observed_at_ms);
CREATE INDEX metric_samples_local_date ON metric_samples(metric_id, local_date);

CREATE TRIGGER metric_samples_wrist_temperature_conflict
BEFORE INSERT ON metric_samples
WHEN NEW.metric_id = (
	SELECT id FROM metric_definitions WHERE code = 'apple_sleeping_wrist_temperature'
) AND EXISTS (
	SELECT 1
	FROM metric_samples AS existing
	WHERE existing.metric_id = NEW.metric_id
		AND existing.local_date = NEW.local_date
		AND IFNULL(existing.source_name, '') = IFNULL(NEW.source_name, '')
		AND existing.semantic_key <> NEW.semantic_key
)
BEGIN
	SELECT RAISE(ABORT, 'temperature_daily_conflict');
END;

CREATE TABLE sleep_summaries (
	id INTEGER PRIMARY KEY,
	delivery_id INTEGER NOT NULL REFERENCES raw_deliveries(id),
	local_date TEXT NOT NULL CHECK (local_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
	sleep_start_ms INTEGER,
	sleep_end_ms INTEGER,
	total_sleep_hours REAL,
	awake_hours REAL,
	core_hours REAL,
	deep_hours REAL,
	rem_hours REAL,
	source_name TEXT,
	semantic_key TEXT NOT NULL UNIQUE CHECK (length(semantic_key) = 64),
	CHECK (sleep_start_ms IS NULL OR sleep_end_ms IS NULL OR sleep_end_ms >= sleep_start_ms)
) STRICT;

CREATE INDEX sleep_summaries_local_date ON sleep_summaries(local_date);

INSERT INTO metric_definitions (code, unit, rollup_method) VALUES
	('active_energy', 'kJ', 'sum'),
	('apple_exercise_time', 'min', 'sum'),
	('apple_sleeping_wrist_temperature', 'degC', 'latest'),
	('apple_stand_hour', 'count', 'sum'),
	('apple_stand_time', 'min', 'sum'),
	('basal_energy_burned', 'kJ', 'sum'),
	('blood_glucose', 'mmol/L', 'latest'),
	('blood_oxygen_saturation', '%', 'average'),
	('body_fat_percentage', '%', 'latest'),
	('body_mass_index', 'count', 'latest'),
	('carbohydrates', 'g', 'sum'),
	('dietary_energy', 'kJ', 'sum'),
	('environmental_audio_exposure', 'dBASPL', 'average'),
	('fiber', 'g', 'sum'),
	('flights_climbed', 'count', 'sum'),
	('headphone_audio_exposure', 'dBASPL', 'average'),
	('heart_rate', 'count/min', 'range'),
	('heart_rate_variability', 'ms', 'average'),
	('lean_body_mass', 'kg', 'latest'),
	('physical_effort', 'kcal/hr·kg', 'average'),
	('protein', 'g', 'sum'),
	('respiratory_rate', 'count/min', 'average'),
	('resting_heart_rate', 'count/min', 'average'),
	('stair_speed_down', 'm/s', 'average'),
	('stair_speed_up', 'm/s', 'average'),
	('step_count', 'count', 'sum'),
	('vo2_max', 'ml/(kg·min)', 'latest'),
	('walking_asymmetry_percentage', '%', 'average'),
	('walking_double_support_percentage', '%', 'average'),
	('walking_heart_rate_average', 'count/min', 'average'),
	('walking_running_distance', 'km', 'sum'),
	('walking_speed', 'km/hr', 'average'),
	('walking_step_length', 'cm', 'average');
