CREATE TABLE IF NOT EXISTS voc_events (
  id TEXT PRIMARY KEY,
  fingerprint TEXT NOT NULL UNIQUE,
  occurred_at TEXT NOT NULL,
  source TEXT NOT NULL,
  segment TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  feedback_text TEXT NOT NULL,
  sentiment REAL NOT NULL CHECK (sentiment >= -1 AND sentiment <= 1),
  topics TEXT NOT NULL DEFAULT '[]',
  intents TEXT NOT NULL DEFAULT '[]',
  metadata TEXT NOT NULL DEFAULT '{}',
  ingested_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_voc_events_occurred_at ON voc_events(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_voc_events_source_time ON voc_events(source, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_voc_events_segment_time ON voc_events(segment, occurred_at DESC);
