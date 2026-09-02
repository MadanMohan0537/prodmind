CREATE TABLE IF NOT EXISTS request_analyses (
  id TEXT PRIMARY KEY,
  event_id TEXT,
  text_hash TEXT NOT NULL,
  primary_intent TEXT NOT NULL,
  is_feature_request INTEGER NOT NULL CHECK(is_feature_request IN (0,1)),
  request_type TEXT CHECK(request_type IN ('explicit','implicit') OR request_type IS NULL),
  confidence REAL NOT NULL CHECK(confidence BETWEEN 0 AND 1),
  urgency TEXT NOT NULL CHECK(urgency IN ('low','medium','high')),
  impact TEXT NOT NULL CHECK(impact IN ('low','medium','high')),
  intents TEXT NOT NULL DEFAULT '[]',
  needs_review INTEGER NOT NULL CHECK(needs_review IN (0,1)),
  analyzed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_request_primary ON request_analyses(primary_intent, analyzed_at DESC);
CREATE INDEX IF NOT EXISTS idx_request_feature ON request_analyses(is_feature_request, analyzed_at DESC);
CREATE INDEX IF NOT EXISTS idx_request_review ON request_analyses(needs_review, analyzed_at DESC);
