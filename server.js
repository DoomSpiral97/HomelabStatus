const express = require("express");
const path = require("path");
const db = require("./database");

const app = express();
const { PORT } = require("./src/config/env");
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/services", (req, res) => {
  const services = db
    .prepare("SELECT id, name, type, target FROM services ORDER BY id DESC")
    .all();

  res.json(services);
});

app.post("/api/services", (req, res) => {
  const { name, type, target } = req.body;

  if (!name || name.trim() === "") {
    return res.status(400).json({
      error: "Name ist erforderlich."
    });
  }

  if (!type || (type !== "http" && type !== "tcp")) {
    return res.status(400).json({
      error: "Typ muss 'http' oder 'tcp' sein."
    });
  }

  if (!target || target.trim() === "") {
    return res.status(400).json({
      error: "Target ist erforderlich."
    });
  }

  const insertStatement = db.prepare(`
    INSERT INTO services (name, type, target)
    VALUES (?, ?, ?)
  `);

  const result = insertStatement.run(
    name.trim(),
    type.trim(),
    target.trim()
  );

  const newService = db
    .prepare("SELECT id, name, type, target FROM services WHERE id = ?")
    .get(result.lastInsertRowid);

  res.status(201).json(newService);
});

app.put("/api/services/:id", (req, res) => {
  const id = Number(req.params.id);
  const { name, type, target } = req.body;

  if (!name || name.trim() === "") {
    return res.status(400).json({
      error: "Name ist erforderlich."
    });
  }

  if (!type || (type !== "http" && type !== "tcp")) {
    return res.status(400).json({
      error: "Typ muss 'http' oder 'tcp' sein."
    });
  }

  if (!target || target.trim() === "") {
    return res.status(400).json({
      error: "Target ist erforderlich."
    });
  }

  const updateStatement = db.prepare(`
    UPDATE services
    SET name = ?, type = ?, target = ?
    WHERE id = ?
  `);

  const result = updateStatement.run(
    name.trim(),
    type.trim(),
    target.trim(),
    id
  );

  if (result.changes === 0) {
    return res.status(404).json({
      error: "Service nicht gefunden."
    });
  }

  const updatedService = db
    .prepare("SELECT id, name, type, target FROM services WHERE id = ?")
    .get(id);

  res.json(updatedService);
});

app.delete("/api/services/:id", (req, res) => {
  const id = Number(req.params.id);

  const deleteStatement = db.prepare("DELETE FROM services WHERE id = ?");
  const result = deleteStatement.run(id);

  if (result.changes === 0) {
    return res.status(404).json({
      error: "Service nicht gefunden."
    });
  }

  res.json({
    message: "Service erfolgreich gelöscht."
  });
});


// Servercheck & Ergebnis Speichern in DB

app.post("/api/services/:id/check", async (req, res) => {
  const id = Number(req.params.id);

  const service = db
    .prepare("SELECT id, name, type, target FROM services WHERE id = ?")
    .get(id);

  if (!service) {
    return res.status(404).json({
      error: "Service nicht gefunden."
    });
  }

  if (service.type !== "http") {
    return res.status(400).json({
      error: "Status-Check ist aktuell nur für HTTP-Services implementiert."
    });
  }

  const startedAt = Date.now();
  const checkedAt = new Date().toISOString();

  try {
    const response = await fetch(service.target, {
      method: "GET",
      signal: AbortSignal.timeout(5000)
    });

    const responseTimeMs = Date.now() - startedAt;
    const isOnline = response.ok ? 1 : 0;
    const statusCode = response.status;

    db.prepare(`
      INSERT INTO service_checks (
        service_id,
        is_online,
        status_code,
        response_time_ms,
        checked_at,
        error_message
      )
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      service.id,
      isOnline,
      statusCode,
      responseTimeMs,
      checkedAt,
      null
    );

    res.json({
      serviceId: service.id,
      serviceName: service.name,
      target: service.target,
      online: Boolean(isOnline),
      statusCode,
      responseTimeMs,
      checkedAt
    });
  } catch (error) {
    const responseTimeMs = Date.now() - startedAt;

    db.prepare(`
      INSERT INTO service_checks (
        service_id,
        is_online,
        status_code,
        response_time_ms,
        checked_at,
        error_message
      )
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      service.id,
      0,
      null,
      responseTimeMs,
      checkedAt,
      error.message
    );

    res.json({
      serviceId: service.id,
      serviceName: service.name,
      target: service.target,
      online: false,
      statusCode: null,
      responseTimeMs,
      checkedAt,
      error: error.message
    });
  }
});

// Historie der Checks für einen Service abrufen
app.get("/api/services", (req, res) => {
  const services = db.prepare(`
    SELECT
      s.id,
      s.name,
      s.type,
      s.target,
      (
        SELECT sc.is_online
        FROM service_checks sc
        WHERE sc.service_id = s.id
        ORDER BY sc.checked_at DESC
        LIMIT 1
      ) AS lastCheckOnline,
      (
        SELECT sc.status_code
        FROM service_checks sc
        WHERE sc.service_id = s.id
        ORDER BY sc.checked_at DESC
        LIMIT 1
      ) AS lastStatusCode,
      (
        SELECT sc.response_time_ms
        FROM service_checks sc
        WHERE sc.service_id = s.id
        ORDER BY sc.checked_at DESC
        LIMIT 1
      ) AS lastResponseTimeMs,
      (
        SELECT sc.checked_at
        FROM service_checks sc
        WHERE sc.service_id = s.id
        ORDER BY sc.checked_at DESC
        LIMIT 1
      ) AS lastCheckedAt
    FROM services s
    ORDER BY s.id DESC
  `).all();

  const mappedServices = services.map((service) => ({
    ...service,
    lastCheckOnline:
      service.lastCheckOnline === null
        ? null
        : Boolean(service.lastCheckOnline)
  }));

  res.json(mappedServices);
});

app.listen(PORT, () => {
  console.log(`Server läuft auf http://localhost:${PORT}`);
});