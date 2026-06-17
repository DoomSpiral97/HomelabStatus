let editingServiceId = null;

async function loadServices() {
  const serviceGrid = document.getElementById("serviceGrid");
  const emptyState = document.getElementById("emptyState");
  const serviceCount = document.getElementById("serviceCount");

  try {
    const response = await fetch("/api/services");
    const services = await response.json();

    if (!response.ok) {
      throw new Error(services.error || "Fehler beim Laden der Services.");
    }

    serviceGrid.innerHTML = "";
    serviceCount.textContent = `${services.length} Service${services.length === 1 ? "" : "s"}`;

    if (services.length === 0) {
      emptyState.classList.remove("hidden");
      return;
    }

    emptyState.classList.add("hidden");

    services.forEach((service) => {
      const card = createServiceCard(service);
      serviceGrid.appendChild(card);
    });
  } catch (error) {
    serviceGrid.innerHTML = "";
    emptyState.classList.add("hidden");
    serviceCount.textContent = "0 Services";
    setMessage(error.message || "Unbekannter Fehler beim Laden.");
  }
}

function createServiceCard(service) {
  const card = document.createElement("article");
  card.className = "service-card";

  const status = getStatusMeta(service);

  card.innerHTML = `
    <div class="service-card-top">
      <div>
        <h3 class="service-title">${escapeHtml(service.name)}</h3>
        <p class="service-subtitle">Service #${escapeHtml(service.id)}</p>
      </div>
      <span class="service-type">${escapeHtml(service.type)}</span>
    </div>

    <span class="status-pill ${status.className}">
      ${status.label}
    </span>

    <div class="info-list">
      <div class="info-row">
        <span class="info-label">Target</span>
        <span class="info-value">${escapeHtml(service.target)}</span>
      </div>

      <div class="info-row">
        <span class="info-label">Letzter Check</span>
        <span class="info-value">
          ${service.lastCheckedAt ? escapeHtml(formatDate(service.lastCheckedAt)) : "Noch kein Check ausgeführt"}
        </span>
      </div>

      <div class="info-row">
        <span class="info-label">Antwortzeit</span>
        <span class="info-value">
          ${service.lastResponseTimeMs !== null && service.lastResponseTimeMs !== undefined
            ? `${escapeHtml(service.lastResponseTimeMs)} ms`
            : "-"}
        </span>
      </div>
    </div>

    <div class="service-actions">
      <button class="action-btn primary" data-action="check" type="button">Prüfen</button>
      <button class="action-btn" data-action="history" type="button">Verlauf</button>
      <button class="action-btn" data-action="edit" type="button">Bearbeiten</button>
      <button class="action-btn danger" data-action="delete" type="button">Löschen</button>
    </div>
  `;

  card.querySelector('[data-action="check"]').addEventListener("click", () => {
    checkService(service.id);
  });

  card.querySelector('[data-action="history"]').addEventListener("click", () => {
    showCheckHistory(service.id);
  });

  card.querySelector('[data-action="edit"]').addEventListener("click", () => {
    startEdit(service);
  });

  card.querySelector('[data-action="delete"]').addEventListener("click", () => {
    deleteService(service.id, service.name);
  });

  return card;
}

function getStatusMeta(service) {
  if (service.lastCheckOnline === true) {
    const suffix = service.lastStatusCode ? ` · ${service.lastStatusCode}` : "";
    return {
      className: "online",
      label: `Online${suffix}`
    };
  }

  if (service.lastCheckOnline === false) {
    return {
      className: "offline",
      label: "Offline"
    };
  }

  return {
    className: "unknown",
    label: "Noch nicht geprüft"
  };
}

function startEdit(service) {
  editingServiceId = service.id;

  document.getElementById("nameInput").value = service.name;
  document.getElementById("typeInput").value = service.type;
  document.getElementById("targetInput").value = service.target;
  document.getElementById("submitButton").textContent = "Service aktualisieren";

  setMessage(`Bearbeite Service ${service.id}: ${service.name}`);
}

function resetForm() {
  editingServiceId = null;
  document.getElementById("serviceForm").reset();
  document.getElementById("typeInput").value = "http";
  document.getElementById("submitButton").textContent = "Service speichern";
  setMessage("Bereit für einen neuen oder bearbeiteten Service.");
}

async function saveService(event) {
  event.preventDefault();

  const serviceData = {
    name: document.getElementById("nameInput").value.trim(),
    type: document.getElementById("typeInput").value,
    target: document.getElementById("targetInput").value.trim()
  };

  if (!serviceData.name || !serviceData.type || !serviceData.target) {
    setMessage("Bitte fülle alle Felder aus.");
    return;
  }

  try {
    let response;

    if (editingServiceId === null) {
      response = await fetch("/api/services", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(serviceData)
      });
    } else {
      response = await fetch(`/api/services/${editingServiceId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(serviceData)
      });
    }

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Fehler beim Speichern.");
    }

    const wasEditing = editingServiceId !== null;
    resetForm();
    setMessage(wasEditing ? "Service erfolgreich aktualisiert." : "Service erfolgreich angelegt.");
    await loadServices();
  } catch (error) {
    setMessage(error.message || "Fehler beim Speichern.");
  }
}

async function deleteService(id, name) {
  const confirmed = window.confirm(`Service "${name}" wirklich löschen?`);

  if (!confirmed) {
    return;
  }

  try {
    const response = await fetch(`/api/services/${id}`, {
      method: "DELETE"
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Fehler beim Löschen.");
    }

    if (editingServiceId === id) {
      resetForm();
    }

    setMessage(data.message || "Service gelöscht.");
    await loadServices();
  } catch (error) {
    setMessage(error.message || "Fehler beim Löschen.");
  }
}

async function checkService(id) {
  setMessage("Prüfe Service...");

  try {
    const response = await fetch(`/api/services/${id}/check`, {
      method: "POST"
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Fehler beim Prüfen.");
    }

    if (data.online) {
      const code = data.statusCode ?? "-";
      const time = data.responseTimeMs ?? "-";
      setMessage(`${data.serviceName} ist online · ${code} · ${time} ms`);
    } else {
      setMessage(
        `${data.serviceName} ist offline oder nicht erreichbar${data.error ? ` · ${data.error}` : ""}`
      );
    }

    await loadServices();
  } catch (error) {
    setMessage(error.message || "Fehler beim Prüfen.");
  }
}

async function showCheckHistory(id) {
  try {
    const response = await fetch(`/api/services/${id}/checks`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Fehler beim Laden des Verlaufs.");
    }

    if (!Array.isArray(data) || data.length === 0) {
      setMessage("Noch keine Check-Historie vorhanden.");
      return;
    }

    const formatted = data
      .map((check) => {
        const state = check.is_online ? "online" : "offline";
        const code = check.status_code ?? "-";
        const time = check.response_time_ms ?? "-";
        return `${formatDate(check.checked_at)} · ${state} · ${code} · ${time} ms`;
      })
      .join(" | ");

    setMessage(formatted);
  } catch (error) {
    setMessage(error.message || "Fehler beim Laden des Verlaufs.");
  }
}

function setMessage(text) {
  const messageBox = document.getElementById("message");
  messageBox.textContent = text;
}

function formatDate(value) {
  return new Date(value).toLocaleString("de-DE", {
    dateStyle: "short",
    timeStyle: "short"
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

document.getElementById("serviceForm").addEventListener("submit", saveService);
document.getElementById("cancelEditButton").addEventListener("click", resetForm);

resetForm();
loadServices();