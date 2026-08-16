CREATE TABLE count_events (
	id TEXT PRIMARY KEY CHECK (length(id) = 36),
	count_type TEXT NOT NULL CHECK (
		length(count_type) BETWEEN 1 AND 64
		AND count_type GLOB '[a-z]*'
		AND count_type NOT GLOB '*[^a-z0-9_]*'
	),
	count_value INTEGER NOT NULL CHECK (
		count_value BETWEEN 0 AND 9007199254740991
	),
	observed_at_ms INTEGER NOT NULL,
	local_date TEXT NOT NULL CHECK (
		local_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
	),
	utc_offset_minutes INTEGER NOT NULL CHECK (utc_offset_minutes BETWEEN -1439 AND 1439),
	recorded_at_ms INTEGER NOT NULL,
	idempotency_key TEXT NOT NULL UNIQUE CHECK (length(idempotency_key) BETWEEN 1 AND 128)
) STRICT;

CREATE INDEX count_events_type_observed_at ON count_events(count_type, observed_at_ms);
