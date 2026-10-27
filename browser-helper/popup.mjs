/* global chrome */
import { inspectAndFill } from "./page.mjs";

const allowed = ["fullName", "preferredName", "email", "phone", "city", "region", "country", "linkedinUrl", "portfolioUrl", "githubUrl", "school", "degree", "graduationDate", "availability"];
const profileLabel = document.querySelector("#profile");
const message = document.querySelector("#message");
const results = document.querySelector("#results");
const fillButton = document.querySelector("#fill");
let profile = null;

async function refresh() {
  const state = await chrome.storage.session.get("atlasProfile");
  const saved = state.atlasProfile;
  profile = saved && typeof saved === "object" ? saved : null;
  profileLabel.textContent = profile ? "Approved details available for this browser session." : "No details imported this browser session.";
  fillButton.disabled = !profile;
}

document.querySelector("#import").addEventListener("click", async () => {
  message.textContent = "";
  try {
    const pasted = document.querySelector("#paste");
    const parsed = JSON.parse(pasted.value);
    if (parsed?.format !== "atlas-career-profile-v1" || !Number.isInteger(parsed.version) || parsed.version < 1 || !parsed.data || typeof parsed.data !== "object" || Array.isArray(parsed.data)) throw new Error("Copy an approved profile from Atlas first");
    if (Object.keys(parsed.data).some(key => ![...allowed, "workAuthorization", "sponsorship", "clearance", "additionalInformation"].includes(key))) throw new Error("Unexpected profile fields");
    const data = {};
    for (const key of allowed) {
      const value = parsed.data[key];
      if (value !== undefined && (typeof value !== "string" || value.length > 300)) throw new Error("Invalid profile field");
      data[key] = value ?? "";
    }
    await chrome.storage.session.set({ atlasProfile: data });
    pasted.value = "";
    await refresh();
    message.textContent = "Imported. Clear your clipboard when finished.";
  } catch (error) { message.textContent = error instanceof Error ? error.message : "Import failed"; }
});

async function run(mode) {
  message.textContent = "";
  results.replaceChildren();
  try {
    if (mode === "fill" && !profile) throw new Error("Import approved details first");
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error("Open an application page first");
    const [response] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: inspectAndFill, args: [mode, mode === "fill" ? profile : null] });
    const report = response.result;
    if (!report) throw new Error("Could not inspect this page");
    message.textContent = mode === "fill" ? `Filled ${report.filledCount} empty field(s). Review the page before continuing.` : `Found ${report.fields.length} visible question(s) on ${report.origin}.`;
    for (const field of report.fields) {
      const line = document.createElement("p");
      const label = document.createElement("strong");
      label.textContent = field.label;
      const status = document.createElement("small");
      status.textContent = ` — ${field.status}`;
      line.append(label, status);
      results.append(line);
    }
  } catch (error) { message.textContent = error instanceof Error ? error.message : "Page inspection failed"; }
}

document.querySelector("#inspect").addEventListener("click", () => void run("inspect"));
fillButton.addEventListener("click", () => void run("fill"));
void refresh();
