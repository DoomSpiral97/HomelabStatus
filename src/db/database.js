const Database = require("better-sqlite3");
const path = require("path");

const { DB_PATH } = require("../config/env");
const dbPath = path.resolve(DB_PATH);
const db = new Database(dbPath);

db.pragma("foreign_keys = ON");
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS services (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    target TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS service_checks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    service_id INTEGER NOT NULL,
    is_online INTEGER NOT NULL,
    status_code INTEGER,
    response_time_ms INTEGER NOT NULL,
    checked_at TEXT NOT NULL,
    error_message TEXT,
    FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE
  );
`);

module.exports = db;