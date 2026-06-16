const Database = require("better-sqlite3");
const path = require("path");

const dbPath = path.join(__dirname, "homelab.db");
const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS services (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    target TEXT NOT NULL
  )
`);

module.exports = db;