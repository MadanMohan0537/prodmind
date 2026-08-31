CREATE TABLE IF NOT EXISTS ingestion_jobs(id TEXT PRIMARY KEY,source TEXT NOT NULL,status TEXT NOT NULL CHECK(status IN('queued','processing','completed','failed')),received INTEGER NOT NULL DEFAULT 0,accepted INTEGER NOT NULL DEFAULT 0,duplicates INTEGER NOT NULL DEFAULT 0,rejected INTEGER NOT NULL DEFAULT 0,error TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,completed_at TEXT);
CREATE TABLE IF NOT EXISTS feedback_events(id TEXT PRIMARY KEY,schema_version TEXT NOT NULL DEFAULT '1.0',text TEXT NOT NULL,source TEXT NOT NULL,customer TEXT NOT NULL DEFAULT 'Anonymous',created_at TEXT NOT NULL,sentiment TEXT NOT NULL,intent TEXT NOT NULL,confidence REAL NOT NULL,classifier TEXT NOT NULL,fingerprint TEXT NOT NULL UNIQUE,metadata TEXT NOT NULL DEFAULT '{}',ingestion_job_id TEXT,inserted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(ingestion_job_id) REFERENCES ingestion_jobs(id));
CREATE TABLE IF NOT EXISTS rate_limits(key TEXT PRIMARY KEY,count INTEGER NOT NULL DEFAULT 0,expires_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_feedback_source_date ON feedback_events(source,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_intent ON feedback_events(intent);
CREATE INDEX IF NOT EXISTS idx_feedback_sentiment ON feedback_events(sentiment);
CREATE INDEX IF NOT EXISTS idx_rate_limits_expiry ON rate_limits(expires_at);
