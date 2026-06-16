const express = require("express");
const path = require("path");
const db = require("./database");

const app = express();
const PORT = 3000;

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

app.listen(PORT, () => {
  console.log(`Server läuft auf http://localhost:${PORT}`);
});