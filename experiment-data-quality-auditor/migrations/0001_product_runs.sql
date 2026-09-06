CREATE TABLE product_runs (
  id TEXT PRIMARY KEY,
  version INTEGER NOT NULL CHECK (version >= 1),
  payload TEXT NOT NULL CHECK (json_valid(payload))
);

CREATE TABLE product_run_history (
  run_id TEXT NOT NULL REFERENCES product_runs(id),
  version INTEGER NOT NULL,
  stage TEXT NOT NULL,
  recorded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (run_id, version)
);

CREATE TRIGGER product_run_created AFTER INSERT ON product_runs
BEGIN
  INSERT INTO product_run_history (run_id, version, stage)
  VALUES (new.id, new.version, json_extract(new.payload, '$.stage'));
END;

CREATE TRIGGER product_run_changed AFTER UPDATE ON product_runs
BEGIN
  INSERT INTO product_run_history (run_id, version, stage)
  VALUES (new.id, new.version, json_extract(new.payload, '$.stage'));
END;
