CREATE TABLE medical_metrics (
	metric_code TEXT NOT NULL,
	collected_at_ms INTEGER NOT NULL,
	value REAL NOT NULL,
	unit TEXT NOT NULL,
	qualifier TEXT CHECK (qualifier IS NULL OR qualifier IN ('<', '<=', '>', '>=')),
	PRIMARY KEY (metric_code, collected_at_ms)
) STRICT, WITHOUT ROWID;
