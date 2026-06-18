const express = require("express");
const router = express.Router();
const db = require("../db/database");

// ─── GET /api/check/:id ───────────────────────────────────────────────────────
router.get("/:id", async (req, res) => {
  const id = Number(req.params.id);

  const service = db
    .prepare("SELECT id, name, type, target FROM services WHERE id = ?")
    .get(id);

  if (!service)
    return res.status(404).json({ error: "Service nicht gefunden." });

  const startedAt = Date.now();
  const checkedAt = new Date().toISOString();

  try {
    const response = await fetch(service.target, {
      method: "GET",
      signal: AbortSignal.timeout(5000),
    });

    const responseTimeMs = Date.now() - startedAt;
    const isOnline = response.ok ? 1 : 0;

    await response.text();

    db.prepare(`
      INSERT INTO service_checks (service_id, is_online, status_code, response_time_ms, checked_at, error_message)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(service.id, isOnline, response.status, responseTimeMs, checkedAt, null);

    res.json({ id, status: isOnline ? "online" : "offline", responseTimeMs });

  } catch (error) {
    const responseTimeMs = Date.now() - startedAt;

    db.prepare(`
      INSERT INTO service_checks (service_id, is_online, status_code, response_time_ms, checked_at, error_message)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(service.id, 0, null, responseTimeMs, checkedAt, error.message);

    res.json({ id, status: "offline", responseTimeMs, error: error.message });
  }
});

module.exports = router;