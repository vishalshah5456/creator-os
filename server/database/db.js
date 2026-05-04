const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'creatoros.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  // Users table
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT,
    handle TEXT,
    avatar TEXT,
    bio TEXT,
    niche TEXT,
    followers INTEGER DEFAULT 0,
    platforms TEXT DEFAULT '[]',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Deals table
  db.run(`CREATE TABLE IF NOT EXISTS deals (
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
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);

  // Content items table
  db.run(`CREATE TABLE IF NOT EXISTS content (
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
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (deal_id) REFERENCES deals(id)
  )`);

  // Income entries table
  db.run(`CREATE TABLE IF NOT EXISTS income (
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
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (deal_id) REFERENCES deals(id)
  )`);

  // Rate cards table
  db.run(`CREATE TABLE IF NOT EXISTS rate_cards (
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
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);

  console.log('Database initialized successfully');
});

module.exports = db;
