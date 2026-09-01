CREATE TABLE IF NOT EXISTS topic_runs (
  id TEXT PRIMARY KEY,
  document_count INTEGER NOT NULL,
  topic_count INTEGER NOT NULL,
  drift_score REAL NOT NULL,
  model TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS topics (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES topic_runs(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  keywords TEXT NOT NULL,
  document_count INTEGER NOT NULL,
  share REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS topic_assignments (
  run_id TEXT NOT NULL REFERENCES topic_runs(id) ON DELETE CASCADE,
  document_id TEXT NOT NULL,
  topic_id TEXT NOT NULL,
  similarity REAL NOT NULL,
  PRIMARY KEY (run_id, document_id)
);
CREATE INDEX IF NOT EXISTS idx_topic_runs_created ON topic_runs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_topics_run ON topics(run_id);
