const express = require("express");
const path = require("path");
const db = require("./database");

const { PORT } = require("./src/config/env");

const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ─── Services CRUD ────────────────────────────────────────────────────────────

app.get("/api/services", (req, res) => {
  const services = db.prepare(`
    SELECT
      s.id, s.name, s.type, s.target,
      (SELECT sc.is_online FROM service_checks sc
       WHERE sc.service_id = s.id ORDER BY sc.checked_at DESC LIMIT 1) AS lastCheckOnline,
      (SELECT sc.response_time_ms FROM service_checks sc
       WHERE sc.service_id = s.id ORDER BY sc.checked_at DESC LIMIT 1) AS lastResponseTimeMs,
      (SELECT sc.checked_at FROM service_checks sc
       WHERE sc.service_id = s.id ORDER BY sc.checked_at DESC LIMIT 1) AS lastCheckedAt
    FROM services s ORDER BY s.id DESC
  `).all();

  res.json(services.map((s) => ({
    ...s,
    lastCheckOnline: s.lastCheckOnline === null ? null : Boolean(s.lastCheckOnline)
  })));
});

app.post("/api/services", (req, res) => {
  const { name, type, target } = req.body;

  if (!name || name.trim() === "")
    return res.status(400).json({ error: "Name ist erforderlich." });
  if (!type || (type !== "http" && type !== "tcp"))
    return res.status(400).json({ error: "Typ muss 'http' oder 'tcp' sein." });
  if (!target || target.trim() === "")
    return res.status(400).json({ error: "Target ist erforderlich." });

  const result = db
    .prepare("INSERT INTO services (name, type, target) VALUES (?, ?, ?)")
    .run(name.trim(), type.trim(), target.trim());

  const newService = db
    .prepare("SELECT id, name, type, target FROM services WHERE id = ?")
    .get(result.lastInsertRowid);

  res.status(201).json(newService);
});

app.put("/api/services/:id", (req, res) => {
  const id = Number(req.params.id);
  const { name, type, target } = req.body;

  if (!name || name.trim() === "")
    return res.status(400).json({ error: "Name ist erforderlich." });
  if (!type || (type !== "http" && type !== "tcp"))
    return res.status(400).json({ error: "Typ muss 'http' oder 'tcp' sein." });
  if (!target || target.trim() === "")
    return res.status(400).json({ error: "Target ist erforderlich." });

  const result = db
    .prepare("UPDATE services SET name = ?, type = ?, target = ? WHERE id = ?")
    .run(name.trim(), type.trim(), target.trim(), id);

  if (result.changes === 0)
    return res.status(404).json({ error: "Service nicht gefunden." });

  res.json(db.prepare("SELECT id, name, type, target FROM services WHERE id = ?").get(id));
});

app.delete("/api/services/:id", (req, res) => {
  const id = Number(req.params.id);
  const result = db.prepare("DELETE FROM services WHERE id = ?").run(id);

  if (result.changes === 0)
    return res.status(404).json({ error: "Service nicht gefunden." });

  res.json({ message: "Service erfolgreich gelöscht." });
});

// ─── Status Check ─────────────────────────────────────────────────────────────

// Das ist die Route die das Frontend aufruft: GET /api/check/:id
app.get("/api/check/:id", async (req, res) => {
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

    // Body konsumieren damit die Verbindung sauber geschlossen wird
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

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`Server läuft auf http://localhost:${PORT}`);
});