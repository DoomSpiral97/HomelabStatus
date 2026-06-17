let editingServiceId = null;

// ─── Services laden & rendern ────────────────────────────────────────────────

async function loadServices() {
  const response = await fetch("/api/services");
  const services = await response.json();

  const grid = document.getElementById("serviceGrid");
  const emptyState = document.getElementById("emptyState");
  const countPill = document.getElementById("serviceCount");

  grid.innerHTML = "";

  countPill.textContent = `${services.length} Service${services.length !== 1 ? "s" : ""}`;

  if (services.length === 0) {
    emptyState.classList.remove("hidden");
    return;
  }
  emptyState.classList.add("hidden");

  // Karten rendern + direkt jeden Service checken
  services.forEach((service) => {
    const card = buildServiceCard(service);
    grid.appendChild(card);
    checkService(service.id);
  });
}

// ─── Karte bauen ─────────────────────────────────────────────────────────────

function buildServiceCard(service) {
  const card = document.createElement("div");
  card.classList.add("service-card");
  card.dataset.id = service.id;

  card.innerHTML = `
    <div class="service-card-top">
      <div>
        <h3 class="service-title">${escapeHtml(service.name)}</h3>
        <p class="service-subtitle">ID: ${service.id}</p>
      </div>
      <span class="service-type">${escapeHtml(service.type)}</span>
    </div>

    <div class="info-list">
      <div class="info-row">
        <span class="info-label">Target</span>
        <span class="info-value">${escapeHtml(service.target)}</span>
      </div>
    </div>

    <span class="status-pill unknown">● Unbekannt</span>

    <div class="service-actions">
      <button class="action-btn check" data-action="check">● Prüfen</button>
      <button class="action-btn primary" data-action="edit">Bearbeiten</button>
      <button class="action-btn danger" data-action="delete">Löschen</button>
    </div>
  `;

  card.querySelector("[data-action='check']").addEventListener("click", () => checkService(service.id));
  card.querySelector("[data-action='edit']").addEventListener("click", () => startEdit(service));
  card.querySelector("[data-action='delete']").addEventListener("click", () => deleteService(service.id));

  return card;
}

// ─── XSS-Schutz ──────────────────────────────────────────────────────────────

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ─── Status Check ─────────────────────────────────────────────────────────────

async function checkService(id) {
  const card = document.querySelector(`.service-card[data-id="${id}"]`);
  if (!card) return;

  const pill = card.querySelector(".status-pill");
  const btn = card.querySelector("[data-action='check']");

  pill.className = "status-pill unknown";
  pill.textContent = "⏳ Prüfe...";
  btn.disabled = true;

  try {
    const response = await fetch(`/api/check/${id}`);
    const data = await response.json();

    if (data.status === "online") {
      pill.className = "status-pill online";
      pill.textContent = "● Online";
    } else {
      pill.className = "status-pill offline";
      pill.textContent = "● Offline";
    }
  } catch (err) {
    pill.className = "status-pill offline";
    pill.textContent = "● Fehler";
  } finally {
    btn.disabled = false;
  }
}

async function checkAll() {
  await loadServices();
}

// ─── Formular ─────────────────────────────────────────────────────────────────

function startEdit(service) {
  editingServiceId = service.id;
  document.getElementById("nameInput").value = service.name;
  document.getElementById("typeInput").value = service.type;
  document.getElementById("targetInput").value = service.target;
  document.getElementById("submitButton").textContent = "Service aktualisieren";
  document.getElementById("message").textContent = `✏️ Bearbeite: ${service.name}`;
}

function resetForm() {
  editingServiceId = null;
  document.getElementById("serviceForm").reset();
  document.getElementById("submitButton").textContent = "Service speichern";
  document.getElementById("message").textContent = "Bereit für einen neuen Service.";
}

async function saveService(event) {
  event.preventDefault();

  const serviceData = {
    name: document.getElementById("nameInput").value,
    type: document.getElementById("typeInput").value,
    target: document.getElementById("targetInput").value,
  };

  const url = editingServiceId === null
    ? "/api/services"
    : `/api/services/${editingServiceId}`;

  const method = editingServiceId === null ? "POST" : "PUT";

  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(serviceData),
  });

  const data = await response.json();
  const messageEl = document.getElementById("message");

  if (!response.ok) {
    messageEl.textContent = `⚠️ ${data.error}`;
    return;
  }

  messageEl.textContent = editingServiceId === null
    ? `✅ "${data.name}" erfolgreich angelegt.`
    : `✅ "${data.name}" erfolgreich aktualisiert.`;

  resetForm();
  loadServices();
}

async function deleteService(id) {
  const messageEl = document.getElementById("message");

  const response = await fetch(`/api/services/${id}`, { method: "DELETE" });
  const data = await response.json();

  if (!response.ok) {
    messageEl.textContent = `⚠️ ${data.error}`;
    return;
  }

  if (editingServiceId === id) resetForm();

  messageEl.textContent = `🗑️ ${data.message}`;
  loadServices();
}

// ─── Init ─────────────────────────────────────────────────────────────────────

document.getElementById("serviceForm").addEventListener("submit", saveService);
document.getElementById("cancelEditButton").addEventListener("click", resetForm);
document.getElementById("checkAllButton").addEventListener("click", checkAll);

// Beim Start laden + alle 30 Sekunden automatisch neu laden & checken
loadServices();
setInterval(checkAll, 30_000);