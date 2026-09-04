CREATE TABLE IF NOT EXISTS prioritization_runs (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  opportunity_count INTEGER NOT NULL,
  capacity REAL NOT NULL,
  weights TEXT NOT NULL,
  result TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_prioritization_runs_created_at ON prioritization_runs(created_at DESC);
