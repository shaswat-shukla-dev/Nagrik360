const { Pool } = require('pg');

// ---- Postgres connection pool ----
// Works with any standard Postgres URL (Render Postgres, Supabase, Neon, RDS, etc.)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSL === 'false' ? false : { rejectUnauthorized: false },
  max: Number(process.env.PG_POOL_MAX) || 10,
});

pool.on('error', (err) => {
  console.error('Unexpected Postgres pool error', err);
});

const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT,
    points INTEGER DEFAULT 0,
    badge TEXT DEFAULT 'Newcomer',
    created_at TIMESTAMPTZ DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS reports (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    category TEXT NOT NULL,
    description TEXT,
    image_path TEXT,
    image_path_verification TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    address TEXT,
    severity TEXT DEFAULT 'pending',
    ai_summary TEXT,
    ai_health_impact TEXT,
    ai_solutions TEXT,
    ai_verified INTEGER DEFAULT 0,
    ai_confidence REAL,
    status TEXT DEFAULT 'submitted',
    upvotes INTEGER DEFAULT 0,
    reported_to_gov INTEGER DEFAULT 0,
    gov_ref_id TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS report_votes (
    id TEXT PRIMARY KEY,
    report_id TEXT,
    user_fingerprint TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(report_id, user_fingerprint)
  );

  CREATE TABLE IF NOT EXISTS report_comments (
    id TEXT PRIMARY KEY,
    report_id TEXT,
    author TEXT,
    comment TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS aqi_cache (
    id TEXT PRIMARY KEY,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    aqi INTEGER,
    pm25 REAL,
    pm10 REAL,
    category TEXT,
    fetched_at TIMESTAMPTZ DEFAULT now()
  );

  CREATE INDEX IF NOT EXISTS idx_reports_category ON reports(category);
  CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
  CREATE INDEX IF NOT EXISTS idx_reports_location ON reports(latitude, longitude);
`;

let initialized = null;

// ---- sqlite-style helper shim so existing route code (db.run/get/all) keeps working ----
// Converts '?' positional placeholders used throughout the routes into Postgres '$1,$2,...'
function toPgQuery(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

function flattenArgs(args) {
  // db.run(sql, a, b, c) or db.run(sql, [a, b, c]) — support both calling styles
  if (args.length === 1 && Array.isArray(args[0])) return args[0];
  return args;
}

const db = {
  async run(sql, ...args) {
    const params = flattenArgs(args);
    const result = await pool.query(toPgQuery(sql), params);
    return { changes: result.rowCount, lastID: result.rows?.[0]?.id };
  },
  async get(sql, ...args) {
    const params = flattenArgs(args);
    const result = await pool.query(toPgQuery(sql), params);
    return result.rows[0];
  },
  async all(sql, ...args) {
    const params = flattenArgs(args);
    const result = await pool.query(toPgQuery(sql), params);
    return result.rows;
  },
  async exec(sql) {
    return pool.query(sql);
  },
};

async function getDB() {
  if (!initialized) {
    initialized = pool.query(SCHEMA_SQL).catch((err) => {
      initialized = null; // allow retry on next call if init failed
      throw err;
    });
  }
  await initialized;
  return db;
}

module.exports = { getDB, pool };
