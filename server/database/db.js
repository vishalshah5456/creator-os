const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required. Add your Supabase Postgres URL in Render environment variables.');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

function toPostgresQuery(sql) {
  let paramIndex = 0;
  return sql.replace(/\?/g, () => `$${++paramIndex}`);
}

const db = {
  async run(sql, params = [], callback) {
    if (typeof params === 'function') {
      callback = params;
      params = [];
    }

    try {
      const result = await pool.query(toPostgresQuery(sql), params);
      if (callback) callback.call({ changes: result.rowCount }, null);
    } catch (err) {
      console.error('Database run error:', err.message);
      if (callback) callback(err);
    }
  },

  async get(sql, params = [], callback) {
    try {
      const result = await pool.query(toPostgresQuery(sql), params);
      callback(null, result.rows[0]);
    } catch (err) {
      console.error('Database get error:', err.message);
      callback(err);
    }
  },

  async all(sql, params = [], callback) {
    try {
      const result = await pool.query(toPostgresQuery(sql), params);
      callback(null, result.rows);
    } catch (err) {
      console.error('Database all error:', err.message);
      callback(err);
    }
  },
};

async function initializeDatabase() {
  await pool.query(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    auth_id TEXT UNIQUE,
    email TEXT UNIQUE NOT NULL,
    password TEXT,
    name TEXT,
    handle TEXT,
    avatar TEXT,
    bio TEXT,
    niche TEXT,
    followers INTEGER DEFAULT 0,
    platforms TEXT DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  )`);

  await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_id TEXT UNIQUE');
  await pool.query('ALTER TABLE users ALTER COLUMN password DROP NOT NULL');

  await pool.query(`CREATE TABLE IF NOT EXISTS deals (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    brand_name TEXT NOT NULL,
    brand_logo TEXT,
    contact_name TEXT,
    contact_email TEXT,
    value REAL DEFAULT 0,
    currency TEXT DEFAULT 'USD',
    status TEXT DEFAULT 'lead',
    pipeline_stage TEXT DEFAULT 'outreach',
    description TEXT,
    deliverables TEXT DEFAULT '[]',
    platforms TEXT DEFAULT '[]',
    start_date TEXT,
    end_date TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);

  await pool.query(`CREATE TABLE IF NOT EXISTS content (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    platform TEXT NOT NULL,
    content_type TEXT DEFAULT 'post',
    status TEXT DEFAULT 'draft',
    scheduled_date TEXT,
    published_date TEXT,
    performance_metrics TEXT DEFAULT '{}',
    deal_id TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (deal_id) REFERENCES deals(id)
  )`);

  await pool.query(`CREATE TABLE IF NOT EXISTS income (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    source TEXT NOT NULL,
    amount REAL NOT NULL,
    currency TEXT DEFAULT 'USD',
    date TEXT NOT NULL,
    deal_id TEXT,
    description TEXT,
    category TEXT DEFAULT 'brand_deal',
    status TEXT DEFAULT 'received',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (deal_id) REFERENCES deals(id)
  )`);

  await pool.query(`CREATE TABLE IF NOT EXISTS rate_cards (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    is_default INTEGER DEFAULT 0,
    platforms TEXT DEFAULT '[]',
    services TEXT DEFAULT '[]',
    audience_size INTEGER,
    engagement_rate REAL,
    demographics TEXT DEFAULT '{}',
    pricing_tiers TEXT DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);

  console.log('Postgres database initialized successfully');
}

db.ready = initializeDatabase().catch((err) => {
  console.error('Database initialization failed:', err);
  process.exit(1);
});

module.exports = db;
