async function loadServices() {
  const response = await fetch("/api/services");
  const services = await response.json();

  const serviceList = document.getElementById("serviceList");
  serviceList.innerHTML = "";

  services.forEach((service) => {
    const li = document.createElement("li");
    li.textContent = `${service.id} - ${service.name} (${service.type}) -> ${service.target}`;
    serviceList.appendChild(li);
  });
}

async function createService(event) {
  event.preventDefault();

  const nameInput = document.getElementById("nameInput");
  const typeInput = document.getElementById("typeInput");
  const targetInput = document.getElementById("targetInput");
  const messageElement = document.getElementById("message");

  const newService = {
    name: nameInput.value,
    type: typeInput.value,
    target: targetInput.value
  };

  const response = await fetch("/api/services", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(newService)
  });

  const data = await response.json();

  if (!response.ok) {
    messageElement.textContent = data.error;
    return;
  }

  messageElement.textContent = "Service erfolgreich angelegt.";

  nameInput.value = "";
  typeInput.value = "";
  targetInput.value = "";

  loadServices();
}

document
  .getElementById("serviceForm")
  .addEventListener("submit", createService);

loadServices();