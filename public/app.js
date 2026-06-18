// ─── Theme + App-Init ────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  const html = document.documentElement;
  const btn  = document.getElementById("themeToggle");

  // System-Preference als Startwert, falls nichts gesetzt
  if (!html.getAttribute("data-theme")) {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    html.setAttribute("data-theme", prefersDark ? "dark" : "light");
  }

  if (btn) {
    btn.addEventListener("click", () => {
      const current = html.getAttribute("data-theme") === "dark" ? "dark" : "light";
      const next    = current === "dark" ? "light" : "dark";
      html.setAttribute("data-theme", next);
    });
  }

  initApp();
});

let editingServiceId = null;

// ─── App initialisieren ──────────────────────────────────────────────────────
function initApp() {
  const form = document.getElementById("serviceForm");
  const cancelBtn = document.getElementById("cancelEditButton");
  const checkAllBtn = document.getElementById("checkAllButton");

  form.addEventListener("submit", saveService);
  cancelBtn.addEventListener("click", resetForm);

  checkAllBtn.addEventListener("click", () => {
    // Erst neu laden, dann für jede Karte den Check-Button klicken
    loadServices().then(() => {
      document
        .querySelectorAll(".service-card [data-action='check']")
        .forEach((btn) => btn.click());
    });
  });

  loadServices();
  setInterval(loadServices, 30_000);
}

// ─── Services laden ──────────────────────────────────────────────────────────
async function loadServices() {
  const response = await fetch("/api/services");
  const services = await response.json();

  const grid = document.getElementById("serviceGrid");
  const emptyState = document.getElementById("emptyState");
  const countBadge = document.getElementById("serviceCount");

  grid.innerHTML = "";
  countBadge.textContent = `${services.length} Service${services.length !== 1 ? "s" : ""}`;

  if (services.length === 0) {
    emptyState.classList.remove("hidden");
    return;
  }
  emptyState.classList.add("hidden");

  services.forEach((service) => {
    grid.appendChild(buildServiceCard(service));
    // Nach dem Bauen: History + aktuellen Status laden
    loadHistory(service.id);
    checkService(service.id);
  });
}
// ─── Karte bauen ─────────────────────────────────────────────────────────────
function buildServiceCard(service) {
  const card = document.createElement("div");
  card.classList.add("service-card");
  card.dataset.id = service.id;

  card.innerHTML = `
    <div class="card-header">
      <div>
        <div class="card-name">${escapeHtml(service.name)}</div>
        <div class="card-target">${escapeHtml(service.target)}</div>
      </div>
      <div class="status-dot-wrap">
        <div class="status-dot" id="dot-${service.id}"></div>
        <span class="status-label" id="label-${service.id}">–</span>
      </div>
    </div>

    <div class="history-bars" id="bars-${service.id}">
      ${Array(10).fill('<div class="history-bar empty"></div>').join("")}
    </div>

    <div class="uptime-row" id="uptime-${service.id}">
      <div class="uptime-item">24h: <span>–</span></div>
      <div class="uptime-item">7d: <span>–</span></div>
    </div>

    <div class="card-actions">
      <div class="card-actions-left">
        <button class="btn-card" data-action="check">Prüfen</button>
        <button class="btn-card" data-action="edit">Bearbeiten</button>
      </div>
      <button class="btn-danger" data-action="delete">Löschen</button>
    </div>
  `;

  card
    .querySelector("[data-action='check']")
    .addEventListener("click", () => checkService(service.id));

  card
    .querySelector("[data-action='edit']")
    .addEventListener("click", () => startEdit(service));

  card
    .querySelector("[data-action='delete']")
    .addEventListener("click", () => deleteService(service.id));

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

// ─── Status-Check ────────────────────────────────────────────────────────────
async function checkService(id) {
  const dot   = document.getElementById(`dot-${id}`);
  const label = document.getElementById(`label-${id}`);
  const btn   = document.querySelector(
    `.service-card[data-id="${id}"] [data-action="check"]`
  );

  if (dot)   dot.className = "status-dot";
  if (label) {
    label.textContent = "…";
    label.className = "status-label";
  }
  if (btn) btn.disabled = true;

  try {
    const res = await fetch(`/api/check/${id}`);
    const data = await res.json();
    const online = data.status === "online";

    if (dot)   dot.className = `status-dot ${online ? "online" : "offline"}`;
    if (label) {
      label.textContent = online ? "Online" : "Offline";
      label.className = `status-label ${online ? "online" : "offline"}`;
    }
  } catch (err) {
    console.error("Check Fehler:", err);
    if (dot)   dot.className = "status-dot offline";
    if (label) {
      label.textContent = "Fehler";
      label.className = "status-label offline";
    }
  } finally {
    if (btn) btn.disabled = false;
    loadHistory(id);
  }
}

// ─── History + Uptime ────────────────────────────────────────────────────────
async function loadHistory(id) {
  try {
    const res = await fetch(`/api/check/${id}/history`);
    const data = await res.json();

    const barsEl   = document.getElementById(`bars-${id}`);
    const uptimeEl = document.getElementById(`uptime-${id}`);
    if (!barsEl || !uptimeEl) return;

    barsEl.innerHTML = Array(10)
      .fill(null)
      .map((_, i) => {
        const check = data.last10[i] ?? null;
        if (!check)
          return `<div class="history-bar empty" title="Kein Check"></div>`;
        const cls  = check.is_online ? "online" : "offline";
        const time = new Date(check.checked_at).toLocaleString("de-DE");
        return `<div class="history-bar ${cls}" title="${
          cls === "online" ? "Online" : "Offline"
        } – ${time}"></div>`;
      })
      .join("");

    const fmt = (pct) => (pct == null ? "–" : `${pct}%`);
    const cls = (pct) =>
      pct == null ? "" : pct >= 90 ? "good" : pct >= 70 ? "warn" : "bad";

    uptimeEl.innerHTML = `
      <div class="uptime-item ${cls(data.uptime24h)}">24h: <span>${fmt(
      data.uptime24h
    )}</span></div>
      <div class="uptime-item ${cls(data.uptime7d)}">7d: <span>${fmt(
      data.uptime7d
    )}</span></div>
    `;
  } catch (err) {
    console.error("History Fehler:", err);
  }
}

// ─── Formular-Logik ──────────────────────────────────────────────────────────
function startEdit(service) {
  editingServiceId = service.id;
  document.getElementById("nameInput").value   = service.name;
  document.getElementById("targetInput").value = service.target;
  document.getElementById("submitButton").textContent = "Aktualisieren";
  document.getElementById("message").textContent = `Bearbeite: ${service.name}`;
}

function resetForm() {
  editingServiceId = null;
  document.getElementById("serviceForm").reset();
  document.getElementById("submitButton").textContent = "Speichern";
  document.getElementById("message").textContent = "";
}

async function saveService(event) {
  event.preventDefault();

  const body = {
    name:   document.getElementById("nameInput").value,
    target: document.getElementById("targetInput").value,
  };

  const url =
    editingServiceId === null
      ? "/api/services"
      : `/api/services/${editingServiceId}`;
  const method = editingServiceId === null ? "POST" : "PUT";

  const res  = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  const msg  = document.getElementById("message");

  if (!res.ok) {
    msg.textContent = `⚠️ ${data.error}`;
    return;
  }

  msg.textContent =
    editingServiceId === null
      ? `✅ "${data.name}" angelegt.`
      : `✅ "${data.name}" aktualisiert.`;

  resetForm();
  loadServices();
}

async function deleteService(id) {
  const res  = await fetch(`/api/services/${id}`, { method: "DELETE" });
  const data = await res.json();

  if (!res.ok) {
    document.getElementById("message").textContent = `⚠️ ${data.error}`;
    return;
  }
  if (editingServiceId === id) resetForm();
  loadServices();
}