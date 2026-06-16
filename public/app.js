let editingServiceId = null;

async function loadServices() {
  const response = await fetch("/api/services");
  const services = await response.json();

  const serviceList = document.getElementById("serviceList");
  serviceList.innerHTML = "";

  services.forEach((service) => {
    const li = document.createElement("li");

    const textSpan = document.createElement("span");
    textSpan.textContent = `${service.id} - ${service.name} (${service.type}) -> ${service.target}`;

    const buttonWrapper = document.createElement("div");

    const editButton = document.createElement("button");
    editButton.textContent = "Bearbeiten";
    editButton.addEventListener("click", () => {
      startEdit(service);
    });

    const deleteButton = document.createElement("button");
    deleteButton.textContent = "Löschen";
    deleteButton.addEventListener("click", () => {
      deleteService(service.id);
    });

    buttonWrapper.appendChild(editButton);
    buttonWrapper.appendChild(deleteButton);

    li.appendChild(textSpan);
    li.appendChild(buttonWrapper);

    serviceList.appendChild(li);
  });
}

function startEdit(service) {
  editingServiceId = service.id;

  document.getElementById("nameInput").value = service.name;
  document.getElementById("typeInput").value = service.type;
  document.getElementById("targetInput").value = service.target;
  document.getElementById("submitButton").textContent = "Service aktualisieren";
  document.getElementById("message").textContent = `Bearbeite Service ${service.id}`;
}

function resetForm() {
  editingServiceId = null;

  document.getElementById("serviceForm").reset();
  document.getElementById("submitButton").textContent = "Service speichern";
  document.getElementById("message").textContent = "";
}

async function saveService(event) {
  event.preventDefault();

  const nameInput = document.getElementById("nameInput");
  const typeInput = document.getElementById("typeInput");
  const targetInput = document.getElementById("targetInput");
  const messageElement = document.getElementById("message");

  const serviceData = {
    name: nameInput.value,
    type: typeInput.value,
    target: targetInput.value
  };

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
    messageElement.textContent = data.error;
    return;
  }

  messageElement.textContent =
    editingServiceId === null
      ? "Service erfolgreich angelegt."
      : "Service erfolgreich aktualisiert.";

  resetForm();
  loadServices();
}

async function deleteService(id) {
  const messageElement = document.getElementById("message");

  const response = await fetch(`/api/services/${id}`, {
    method: "DELETE"
  });

  const data = await response.json();

  if (!response.ok) {
    messageElement.textContent = data.error;
    return;
  }

  if (editingServiceId === id) {
    resetForm();
  }

  messageElement.textContent = data.message;
  loadServices();
}

document
  .getElementById("serviceForm")
  .addEventListener("submit", saveService);

document
  .getElementById("cancelEditButton")
  .addEventListener("click", resetForm);

loadServices();