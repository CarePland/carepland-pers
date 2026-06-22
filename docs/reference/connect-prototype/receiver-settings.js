const state = {
  serverUrl: "http://localhost:8790",
  settings: null,
  receiverDeviceId: "",
};

const settingsServerUrl = document.querySelector("#settingsServerUrl");
const receiverSettingsTitle = document.querySelector("#receiverSettingsTitle");
const receiverSettingsStatus = document.querySelector("#receiverSettingsStatus");
const receiverNameInput = document.querySelector("#receiverNameInput");
const receiverLocationInput = document.querySelector("#receiverLocationInput");
const saveIdentityButton = document.querySelector("#saveIdentityButton");
const refreshSettingsButton = document.querySelector("#refreshSettingsButton");
const identitySaveStatus = document.querySelector("#identitySaveStatus");
const assignedHousehold = document.querySelector("#assignedHousehold");
const receiverPeopleFact = document.querySelector("#receiverPeopleFact");
const receiverDeviceIdFact = document.querySelector("#receiverDeviceIdFact");
const approvedContactsList = document.querySelector("#approvedContactsList");
const permissionsSaveStatus = document.querySelector("#permissionsSaveStatus");
const hideOperationalSettingsInput = document.querySelector("#hideOperationalSettingsInput");
const allowComfortSettingsInput = document.querySelector("#allowComfortSettingsInput");
const requireContactApprovalInput = document.querySelector("#requireContactApprovalInput");
const saveLockdownButton = document.querySelector("#saveLockdownButton");
const lockdownSaveStatus = document.querySelector("#lockdownSaveStatus");

function refreshServerUrl() {
  state.serverUrl = settingsServerUrl.value.trim() || "http://localhost:8790";
}

async function api(path, options = {}) {
  refreshServerUrl();
  const response = await fetch(`${state.serverUrl}${path}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(options.headers || {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.ok === false) {
    throw new Error(body.error || `Server returned ${response.status}`);
  }
  return body;
}

async function loadSettings() {
  identitySaveStatus.textContent = "Loading receiver settings...";
  lockdownSaveStatus.textContent = "Loading lockdown settings...";
  receiverSettingsStatus.textContent = "Loading";
  try {
    const settings = await api("/receiver-settings?careCircleId=care-circle-mom");
    state.settings = settings;
    renderSettings();
    identitySaveStatus.textContent = "Receiver settings loaded.";
    lockdownSaveStatus.textContent = "Lockdown settings loaded.";
    permissionsSaveStatus.textContent = "Contact permissions loaded.";
  } catch {
    receiverSettingsStatus.textContent = "Unavailable";
    identitySaveStatus.textContent = "Receiver settings unavailable.";
    lockdownSaveStatus.textContent = "Lockdown settings unavailable.";
    permissionsSaveStatus.textContent = "Contact permissions unavailable.";
  }
}

function renderSettings() {
  const device = (state.settings.receiverDevices || [])[0] || {};
  const household = (state.settings.receiverHouseholds || [])[0] || {};
  const people = state.settings.receiverPeople || [];
  const lockdown = state.settings.receiverAdminSettings || {};

  state.receiverDeviceId = device.id || "";
  receiverSettingsTitle.textContent = device.name || "Receiver";
  receiverSettingsStatus.textContent = device.status || "Unknown";
  receiverNameInput.value = device.name || "";
  receiverLocationInput.value = device.locationLabel || "";
  assignedHousehold.textContent = household.displayName || "Not assigned";
  receiverPeopleFact.textContent = people.map(person => person.displayName).join(", ") || "None";
  receiverDeviceIdFact.textContent = device.id || "-";

  hideOperationalSettingsInput.checked = Boolean(lockdown.hideOperationalSettingsOnReceiver);
  allowComfortSettingsInput.checked = Boolean(lockdown.allowReceiverComfortSettings);
  requireContactApprovalInput.checked = Boolean(lockdown.requireAdminApprovalForContactChanges);
  renderApprovedContacts();
}

function renderApprovedContacts() {
  const members = (state.settings.members || []).filter((member) => {
    return member.role !== "receiver_person" && member.role !== "receiver_user";
  });
  if (!members.length) {
    approvedContactsList.innerHTML = '<p class="server-status">No contacts available.</p>';
    return;
  }

  approvedContactsList.innerHTML = "";
  members.forEach((member) => {
    const row = document.createElement("div");
    row.className = "permission-row";
    row.dataset.memberId = member.id;
    row.innerHTML = `
      <strong>${escapeHtml(member.displayName)}</strong>
      <span>${escapeHtml(permissionSubline(member))}</span>
      <label class="check-row"><input type="checkbox" data-permission="canCallReceiver" ${member.canCallReceiver ? "checked" : ""} /> Can call</label>
      <label class="check-row"><input type="checkbox" data-permission="canMessageReceiver" ${member.canMessageReceiver ? "checked" : ""} /> Can message</label>
      <label class="check-row"><input type="checkbox" data-permission="canRequestAttention" ${member.canRequestAttention ? "checked" : ""} /> Can request attention</label>
      <button class="secondary-button compact" type="button" data-action="save-permissions">Save</button>
    `;
    row.querySelector('[data-action="save-permissions"]').addEventListener("click", () => saveContactPermissions(row));
    approvedContactsList.append(row);
  });
}

function permissionSubline(member) {
  const role = formatToken(member.role);
  const access = member.adminAccessLevel && member.adminAccessLevel !== "none"
    ? ` · ${formatToken(member.adminAccessLevel)}`
    : "";
  return `${member.relationshipLabel || role} · ${role}${access}`;
}

async function saveIdentity() {
  if (!state.receiverDeviceId) {
    identitySaveStatus.textContent = "No receiver device loaded.";
    return;
  }
  identitySaveStatus.textContent = "Saving receiver identity...";
  try {
    const result = await api("/receiver-settings/identity", {
      method: "PUT",
      body: JSON.stringify({
        receiverDeviceId: state.receiverDeviceId,
        name: receiverNameInput.value,
        locationLabel: receiverLocationInput.value,
      }),
    });
    receiverSettingsTitle.textContent = result.receiverDevice.name;
    identitySaveStatus.textContent = "Receiver identity saved.";
    await loadSettings();
  } catch {
    identitySaveStatus.textContent = "Receiver identity could not be saved.";
  }
}

async function saveLockdown() {
  lockdownSaveStatus.textContent = "Saving lockdown settings...";
  try {
    await api("/receiver-settings/lockdown", {
      method: "PUT",
      body: JSON.stringify({
        hideOperationalSettingsOnReceiver: hideOperationalSettingsInput.checked,
        allowReceiverComfortSettings: allowComfortSettingsInput.checked,
        requireAdminApprovalForContactChanges: requireContactApprovalInput.checked,
      }),
    });
    lockdownSaveStatus.textContent = "Lockdown settings saved.";
    await loadSettings();
  } catch {
    lockdownSaveStatus.textContent = "Lockdown settings could not be saved.";
  }
}

async function saveContactPermissions(row) {
  const memberId = row.dataset.memberId;
  const payload = {};
  row.querySelectorAll("[data-permission]").forEach((input) => {
    payload[input.dataset.permission] = input.checked;
  });
  const name = row.querySelector("strong")?.textContent || "Contact";
  permissionsSaveStatus.textContent = `Saving permissions for ${name}...`;
  try {
    await api(`/receiver-settings/contact-permissions/${encodeURIComponent(memberId)}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    permissionsSaveStatus.textContent = `Permissions saved for ${name}.`;
    await loadSettings();
  } catch {
    permissionsSaveStatus.textContent = `Permissions could not be saved for ${name}.`;
  }
}

function formatToken(value) {
  return String(value || "")
    .split("_")
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ") || "None";
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

saveIdentityButton.addEventListener("click", saveIdentity);
saveLockdownButton.addEventListener("click", saveLockdown);
refreshSettingsButton.addEventListener("click", loadSettings);
settingsServerUrl.addEventListener("change", loadSettings);

loadSettings();
