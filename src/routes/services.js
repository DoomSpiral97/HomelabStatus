const express = require("express");
const router = express.Router();
const db = require("../db/database");

// ─── GET alle Services ────────────────────────────────────────────────────────
router.get("/", (req, res) => {
  const services = db.prepare(`
    SELECT
      s.id, s.name, s.target,
      (SELECT sc.is_online FROM service_checks sc
       WHERE sc.service_id = s.id ORDER BY sc.checked_at DESC LIMIT 1) AS lastCheckOnline,
      (SELECT sc.response_time_ms FROM service_checks sc
       WHERE sc.service_id = s.id ORDER BY sc.checked_at DESC LIMIT 1) AS lastResponseTimeMs,
      (SELECT sc.checked_at FROM service_checks sc
       WHERE sc.service_id = s.id ORDER BY sc.checked_at DESC LIMIT 1) AS lastCheckedAt
    FROM services s ORDER BY s.id DESC
  `).all();

  res.json(
    services.map((s) => ({
      ...s,
      lastCheckOnline:
        s.lastCheckOnline === null ? null : Boolean(s.lastCheckOnline),
    }))
  );
});

// ─── POST neuen Service anlegen ───────────────────────────────────────────────
router.post("/", (req, res) => {
  const { name, target } = req.body;

  if (!name || name.trim() === "")
    return res.status(400).json({ error: "Name ist erforderlich." });
  if (!target || target.trim() === "")
    return res.status(400).json({ error: "Target ist erforderlich." });

  const result = db
    .prepare(
      "INSERT INTO services (name, type, target) VALUES (?, 'http', ?)"
    )
    .run(name.trim(), target.trim());

  const newService = db
    .prepare("SELECT id, name, target FROM services WHERE id = ?")
    .get(result.lastInsertRowid);

  res.status(201).json(newService);
});

// ─── PUT Service aktualisieren ────────────────────────────────────────────────
router.put("/:id", (req, res) => {
  const id = Number(req.params.id);
  const { name, target } = req.body;

  if (!name || name.trim() === "")
    return res.status(400).json({ error: "Name ist erforderlich." });
  if (!target || target.trim() === "")
    return res.status(400).json({ error: "Target ist erforderlich." });

  const result = db
    .prepare(
      "UPDATE services SET name = ?, target = ? WHERE id = ?"
    )
    .run(name.trim(), target.trim(), id);

  if (result.changes === 0)
    return res.status(404).json({ error: "Service nicht gefunden." });

  res.json(
    db
      .prepare("SELECT id, name, target FROM services WHERE id = ?")
      .get(id)
  );
});

// ─── DELETE Service löschen ───────────────────────────────────────────────────
router.delete("/:id", (req, res) => {
  const id = Number(req.params.id);
  const result = db.prepare("DELETE FROM services WHERE id = ?").run(id);

  if (result.changes === 0)
    return res.status(404).json({ error: "Service nicht gefunden." });

  res.json({ message: "Service erfolgreich gelöscht." });
});

module.exports = router;