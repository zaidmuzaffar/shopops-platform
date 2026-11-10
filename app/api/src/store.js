// Two interchangeable stores with the same methods:
//  - MemoryStore   : no database needed (tests, quick local runs)
//  - PostgresStore : real database (Docker, Kubernetes, production)
// The rest of the app never knows which one it is using.

class MemoryStore {
  constructor() { this.items = []; this.nextId = 1; }
  async init() {}
  async ping() { return true; }
  async list() { return [...this.items].sort((a, b) => b.id - a.id); }
  async get(id) { return this.items.find((p) => p.id === id) || null; }
  async create({ name, category, price, quantity }) {
    const p = { id: this.nextId++, name, category, price, quantity, updated_at: new Date().toISOString() };
    this.items.push(p);
    return p;
  }
  async update(id, fields) {
    const p = await this.get(id);
    if (!p) return null;
    Object.assign(p, fields, { updated_at: new Date().toISOString() });
    return p;
  }
  async remove(id) {
    const before = this.items.length;
    this.items = this.items.filter((p) => p.id !== id);
    return this.items.length < before;
  }
  async close() {}
}

class PostgresStore {
  constructor(url) {
    const { Pool } = require('pg');            // loaded only when a database is configured
    this.pool = new Pool({ connectionString: url, max: 10 });
  }
  async init() {
    // Simple migration: create the table if it does not exist yet.
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS products (
        id          SERIAL PRIMARY KEY,
        name        TEXT NOT NULL,
        category    TEXT NOT NULL DEFAULT 'other',
        price       INTEGER NOT NULL CHECK (price >= 0),
        quantity    INTEGER NOT NULL CHECK (quantity >= 0),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
      )`);
  }
  async ping() { await this.pool.query('SELECT 1'); return true; }
  async list() { return (await this.pool.query('SELECT * FROM products ORDER BY id DESC')).rows; }
  async get(id) { return (await this.pool.query('SELECT * FROM products WHERE id = $1', [id])).rows[0] || null; }
  async create({ name, category, price, quantity }) {
    const r = await this.pool.query(
      'INSERT INTO products (name, category, price, quantity) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, category, price, quantity]);
    return r.rows[0];
  }
  async update(id, fields) {
    const cols = Object.keys(fields);
    if (!cols.length) return this.get(id);
    const sets = cols.map((c, i) => `${c} = $${i + 2}`).join(', ');
    const r = await this.pool.query(
      `UPDATE products SET ${sets}, updated_at = now() WHERE id = $1 RETURNING *`,
      [id, ...cols.map((c) => fields[c])]);
    return r.rows[0] || null;
  }
  async remove(id) { return (await this.pool.query('DELETE FROM products WHERE id = $1', [id])).rowCount > 0; }
  async close() { await this.pool.end(); }
}

function createStore(databaseUrl) {
  return databaseUrl ? new PostgresStore(databaseUrl) : new MemoryStore();
}

module.exports = { createStore, MemoryStore };
