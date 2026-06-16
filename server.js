const express = require("express");
const path = require("path");

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

let services = [];
let nextId = 1;

app.get("/api/services", (req, res) => {
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

  const newService = {
    id: nextId,
    name: name.trim(),
    type: type.trim(),
    target: target.trim()
  };

  nextId++;
  services.push(newService);

  res.status(201).json(newService);
});

app.listen(PORT, () => {
  console.log(`Server läuft auf http://localhost:${PORT}`);
});