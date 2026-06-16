const express = require("express");

const app = express();
const PORT = 7777;

app.use(express.static("public"));

app.listen(PORT, () => {
  console.log(`Server läuft auf http://localhost:${PORT}`);
});