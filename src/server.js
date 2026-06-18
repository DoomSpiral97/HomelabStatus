const express = require("express");
const path = require("path");
const { PORT } = require("./config/env");

const servicesRouter = require("./routes/services");
const checksRouter = require("./routes/checks");

const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use("/api/services", servicesRouter);
app.use("/api/check", checksRouter);

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server läuft auf http://localhost:${PORT}`);
});