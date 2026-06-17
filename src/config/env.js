require("dotenv").config();

module.exports = {
  PORT: process.env.PORT || 3000,
  DB_PATH: process.env.DB_PATH || "./src/db/homelab.db",
};