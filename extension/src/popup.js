const form = /** @type {HTMLFormElement} */ (document.getElementById("settings"));
const enabled = /** @type {HTMLInputElement} */ (document.getElementById("enabled"));
const appUrl = /** @type {HTMLInputElement} */ (document.getElementById("app-url"));
const syncButton = /** @type {HTMLButtonElement} */ (document.getElementById("sync"));
const status = /** @type {HTMLParagraphElement} */ (document.getElementById("status"));
const recent = /** @type {HTMLUListElement} */ (document.getElementById("recent"));

/** @param {boolean} initial */
async function render(initial = false) {
  const state = await chrome.storage.local.get({ enabled: true, appUrl: "https://episodic-app.vercel.app", pending: [], recent: [] });
  if (initial) {
    enabled.checked = state.enabled;
    appUrl.value = state.appUrl;
  }
  syncButton.disabled = !state.enabled;
  recent.replaceChildren();
  const entries = [...state.pending].reverse().concat(state.recent).slice(0, 20);
  for (const entry of entries) {
    const row = document.createElement("li");
    row.textContent = entry.title + (entry.kind === "episode" ? ` · S${entry.season} E${entry.episode}` : "");
    const detail = document.createElement("small");
    detail.textContent = entry.openedAt ? `Receiver opened · ${new Date(entry.openedAt).toLocaleString()}` : "Pending sync";
    row.append(detail);
    recent.append(row);
  }
  if (!entries.length) {
    const row = document.createElement("li");
    row.textContent = "No scrobbles yet. Play a title on Netflix, Hulu, or Max.";
    recent.append(row);
  }
}

/** @param {unknown} error */
function showError(error) {
  status.textContent = error instanceof Error ? error.message : "Unable to access the extension.";
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const response = await chrome.runtime.sendMessage({ type: "settings", enabled: enabled.checked, appUrl: appUrl.value.trim() });
    if (!response?.ok) throw new Error(response?.error || "Could not save settings.");
    status.textContent = "Settings saved.";
    await render(true);
  } catch (error) { showError(error); }
});

syncButton.addEventListener("click", async () => {
  syncButton.disabled = true;
  try {
    const response = await chrome.runtime.sendMessage({ type: "sync" });
    if (!response?.ok) throw new Error(response?.error || "Sync failed. Pending items are retained.");
    status.textContent = `Opened ${response.opened} receiver tab(s).`;
  } catch (error) { showError(error); }
  finally { await render().catch(showError); }
});

chrome.storage.onChanged.addListener((_changes, area) => {
  if (area === "local") render().catch(showError);
});
render(true).catch(showError);
