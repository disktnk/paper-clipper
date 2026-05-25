import { detectFromUrl, pageSniffScript } from "../lib/detect.js";
import { fetchItem } from "../lib/fetchItem.js";
import { renderTemplate } from "../lib/template.js";
import { getSettings } from "../lib/settings.js";
import {
  getTemplateFileHandle,
  getSaveDirHandle,
  queryPermission,
  requestPermission,
  readTemplateFile,
  writeMarkdown,
} from "../lib/vault.js";

const el = (id) => document.getElementById(id);

let state = {
  templateHandle: null,
  saveDirHandle: null,
  settings: null,
  ident: null,
  item: null,
  markdown: null,
  filename: null,
};

document.addEventListener("DOMContentLoaded", () => {
  el("open-options").addEventListener("click", () => {
    chrome.runtime.openOptionsPage();
  });
  el("save").addEventListener("click", onSave);
  init().catch((e) => showError(e));
});

async function init() {
  setStatus("Loading settings…");
  state.settings = await getSettings();

  state.templateHandle = await getTemplateFileHandle();
  state.saveDirHandle = await getSaveDirHandle();
  if (!state.templateHandle || !state.saveDirHandle) {
    throw new Error(
      "Template file and save directory must be picked first.\nOpen the options page (gear icon).",
    );
  }

  const tPerm = await queryPermission(state.templateHandle, "read");
  const sPerm = await queryPermission(state.saveDirHandle, "readwrite");
  if (tPerm !== "granted" || sPerm !== "granted") {
    setStatus("");
    showGrantUI(tPerm !== "granted", sPerm !== "granted");
    return;
  }

  await runDetectAndRender();
}

function showGrantUI(needTemplate, needSave) {
  const status = el("status");
  status.classList.remove("hidden");
  status.innerHTML = "";
  const parts = [];
  if (needTemplate) parts.push("template file");
  if (needSave) parts.push("save folder");
  const msg = document.createElement("div");
  msg.textContent = `Confirm access to ${parts.join(" and ")} for this session.`;
  const btn = document.createElement("button");
  btn.textContent = "Grant access";
  btn.className = "primary";
  btn.style.marginTop = "8px";
  btn.addEventListener("click", async () => {
    try {
      if (needTemplate) {
        const ok = await requestPermission(state.templateHandle, "read");
        if (!ok) throw new Error("Template permission denied.");
      }
      if (needSave) {
        const ok = await requestPermission(state.saveDirHandle, "readwrite");
        if (!ok) throw new Error("Save folder permission denied.");
      }
      status.innerHTML = "";
      await runDetectAndRender();
    } catch (e) {
      showError(e);
    }
  });
  status.appendChild(msg);
  status.appendChild(btn);
}

async function runDetectAndRender() {
  const tab = await getActiveTab();
  if (!tab?.url) throw new Error("No active tab.");

  setStatus("Detecting identifier…");
  let ident = detectFromUrl(tab.url);
  if (!ident) ident = await sniffPage(tab.id);
  if (!ident) {
    throw new Error(
      "No DOI / arXiv ID / PMID found on this page.\nOnly papers with one of these identifiers are supported.",
    );
  }
  state.ident = ident;

  setStatus(`Fetching metadata (${ident.kind}: ${ident.id})…`);
  state.item = await fetchItem(ident, { citekeyPattern: state.settings.citekeyPattern });

  setStatus("Reading template…");
  let templateText;
  try {
    templateText = await readTemplateFile(state.templateHandle);
  } catch (e) {
    throw new Error(`Could not read template file.\n${e.message}`);
  }

  setStatus("Rendering…");
  state.markdown = await renderTemplate(templateText, state.item);
  state.filename = `${state.item.citekey}.md`;

  renderMeta();
  setStatus("");
  el("meta").classList.remove("hidden");
  el("actions").classList.remove("hidden");
}

async function sniffPage(tabId) {
  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId },
      func: pageSniffScript,
    });
    return result || null;
  } catch {
    return null;
  }
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function renderMeta() {
  const { item, ident, filename, saveDirHandle } = state;
  el("title").textContent = item.title || "(no title)";
  el("authors").textContent = formatAuthors(item);
  el("year").textContent = item.year || "—";
  el("source").textContent = `${ident.kind}:${ident.id}`;
  el("filename").textContent = `${saveDirHandle.name}/${filename}`;
}

function formatAuthors(item) {
  const auths = (item.creators || []).filter((c) => c.creatorType === "author");
  const names = auths
    .slice(0, 4)
    .map((a) => a.name || `${a.firstName || ""} ${a.lastName || ""}`.trim());
  let s = names.join(", ");
  if (auths.length > 4) s += `, +${auths.length - 4} more`;
  return s || "—";
}

async function onSave() {
  if (!state.markdown || !state.filename) return;
  const saveBtn = el("save");
  saveBtn.disabled = true;
  setStatus("Saving…");
  try {
    const overwrite = el("overwrite").checked;
    await writeMarkdown(state.saveDirHandle, state.filename, state.markdown, { overwrite });
    setStatus(`Saved ${state.filename}`);
    // Close popup on success. Delay a tick so the status flash is visible.
    setTimeout(() => window.close(), 200);
  } catch (e) {
    showError(e);
    saveBtn.disabled = false;
  }
}

function setStatus(msg) {
  const s = el("status");
  s.textContent = msg;
  s.classList.toggle("hidden", !msg);
}

function showError(e) {
  const msg = e?.message || String(e);
  const err = el("error");
  err.textContent = msg;
  err.classList.remove("hidden");
  setStatus("");
}
