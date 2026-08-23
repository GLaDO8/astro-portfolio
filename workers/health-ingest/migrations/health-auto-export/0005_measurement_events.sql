CREATE TABLE measurement_events (
	id TEXT PRIMARY KEY CHECK (length(id) = 36),
	measurement_type TEXT NOT NULL CHECK (measurement_type = 'grip_strength'),
	grip_strength_left REAL NOT NULL CHECK (
		grip_strength_left BETWEEN 0 AND 1000
	),
	grip_strength_right REAL NOT NULL CHECK (
		grip_strength_right BETWEEN 0 AND 1000
	),
	unit TEXT NOT NULL CHECK (unit IN ('kg', 'lb')),
	observed_at_ms INTEGER NOT NULL,
	local_date TEXT NOT NULL CHECK (
		local_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
	),
	utc_offset_minutes INTEGER NOT NULL CHECK (utc_offset_minutes BETWEEN -1439 AND 1439),
	recorded_at_ms INTEGER NOT NULL,
	idempotency_key TEXT NOT NULL UNIQUE CHECK (length(idempotency_key) BETWEEN 1 AND 128)
) STRICT;

CREATE INDEX measurement_events_type_observed_at
	ON measurement_events(measurement_type, observed_at_ms);
