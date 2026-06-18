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

// ─── GET /api/check/:id/history ───────────────────────────────────────────────
router.get("/:id/history", (req, res) => {
  const id = Number(req.params.id);

  const service = db.prepare("SELECT id FROM services WHERE id = ?").get(id);
  if (!service)
    return res.status(404).json({ error: "Service nicht gefunden." });

  const last10 = db.prepare(`
    SELECT is_online, checked_at
    FROM service_checks
    WHERE service_id = ?
    ORDER BY checked_at DESC
    LIMIT 10
  `).all(id);

  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const stats24h = db.prepare(`
    SELECT COUNT(*) AS total, SUM(is_online) AS online
    FROM service_checks
    WHERE service_id = ? AND checked_at >= ?
  `).get(id, since24h);

  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const stats7d = db.prepare(`
    SELECT COUNT(*) AS total, SUM(is_online) AS online
    FROM service_checks
    WHERE service_id = ? AND checked_at >= ?
  `).get(id, since7d);

  const pct = (s) => s.total === 0 ? null : Math.round((s.online / s.total) * 100);

  res.json({
    last10: last10.reverse(),
    uptime24h: pct(stats24h),
    uptime7d: pct(stats7d),
  });
});

module.exports = router;