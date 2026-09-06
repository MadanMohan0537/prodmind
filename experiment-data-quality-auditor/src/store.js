export class Conflict extends Error {}

/** One immutable-versioned workflow snapshot; all seven stages share its IDs. */
export class RunStore {
  constructor(db) { this.db = db; }
  encode(run) {
    const json = JSON.stringify(run);
    if (new TextEncoder().encode(json).length > 900000) throw new Error('Workflow exceeds 900 KB; start a smaller discovery run');
    return json;
  }
  async create(run) {
    await this.db.prepare('INSERT INTO product_runs (id, version, payload) VALUES (?, 1, ?)').bind(run.id, this.encode(run)).run();
    return run;
  }
  async get(id) {
    const row = await this.db.prepare('SELECT payload FROM product_runs WHERE id = ?').bind(id).first();
    return row ? JSON.parse(row.payload) : null;
  }
  async list() {
    const {results} = await this.db.prepare("SELECT id, version, json_extract(payload, '$.title') AS title, json_extract(payload, '$.stage') AS stage, json_extract(payload, '$.updatedAt') AS updatedAt FROM product_runs ORDER BY rowid DESC LIMIT 50").all();
    return results;
  }
  async save(run, version) {
    const next = {...run, version: version + 1, updatedAt: new Date().toISOString()};
    const row = await this.db.prepare('UPDATE product_runs SET version = version + 1, payload = ? WHERE id = ? AND version = ? RETURNING payload').bind(this.encode(next), run.id, version).first();
    if (!row) throw new Conflict('Another update won. Reload this run before retrying.');
    return JSON.parse(row.payload);
  }
}
