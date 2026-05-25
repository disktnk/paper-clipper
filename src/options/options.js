import {
  getTemplateFileHandle,
  getSaveDirHandle,
  pickTemplateFile,
  pickSaveDirectory,
  queryPermission,
  requestPermission,
} from "../lib/vault.js";
import { getSettings, saveSettings, defaultSettings } from "../lib/settings.js";
import { generateCitekey } from "../lib/citekey.js";
import { fetchItem } from "../lib/fetchItem.js";
import { detectFromUrl } from "../lib/detect.js";

const el = (id) => document.getElementById(id);

document.addEventListener("DOMContentLoaded", () => {
  el("pick-template").addEventListener("click", onPickTemplate);
  el("pick-save").addEventListener("click", onPickSave);
  el("save-settings").addEventListener("click", onSaveSettings);
  el("preview-btn").addEventListener("click", onPreview);
  init();
});

async function init() {
  const settings = await getSettings();
  const defaults = defaultSettings();
  el("citekey-pattern").value = settings.citekeyPattern || defaults.citekeyPattern;

  const tHandle = await getTemplateFileHandle();
  if (tHandle) {
    setLabel("template-name", tHandle.name);
    const p = await queryPermission(tHandle, "read");
    setStatus("template-status", permLabel(p));
  } else {
    setLabel("template-name", "(not set)");
  }

  const sHandle = await getSaveDirHandle();
  if (sHandle) {
    setLabel("save-name", sHandle.name);
    const p = await queryPermission(sHandle, "readwrite");
    setStatus("save-status", permLabel(p));
  } else {
    setLabel("save-name", "(not set)");
  }
}

function permLabel(p) {
  if (p === "granted") return "Access granted.";
  if (p === "prompt") return "Access will be requested on first use.";
  return "Access denied — re-pick the location.";
}

function setLabel(id, text) {
  el(id).textContent = text;
}
function setStatus(id, text) {
  el(id).textContent = text;
}

async function onPickTemplate() {
  try {
    const handle = await pickTemplateFile();
    setLabel("template-name", handle.name);
    setStatus("template-status", "Access granted.");
  } catch (e) {
    if (e?.name !== "AbortError") setStatus("template-status", e.message);
  }
}

async function onPickSave() {
  try {
    const handle = await pickSaveDirectory();
    const ok = await requestPermission(handle, "readwrite");
    setLabel("save-name", handle.name);
    setStatus("save-status", ok ? "Access granted." : "Permission was not granted.");
  } catch (e) {
    if (e?.name !== "AbortError") setStatus("save-status", e.message);
  }
}

async function onSaveSettings() {
  const pattern = el("citekey-pattern").value.trim();
  if (!pattern) {
    el("preview-out").textContent = "Pattern cannot be empty.";
    return;
  }
  try {
    // Validate by running against a sample item.
    generateCitekey(sampleItem(), pattern);
  } catch (e) {
    el("preview-out").textContent = `Invalid pattern: ${e.message}`;
    return;
  }
  await saveSettings({ citekeyPattern: pattern });
  const flash = el("saved-flash");
  flash.classList.remove("hidden");
  setTimeout(() => flash.classList.add("hidden"), 1500);
}

async function onPreview() {
  const pattern = el("citekey-pattern").value.trim();
  const idText = el("preview-doi").value.trim();
  el("preview-out").textContent = "Computing…";
  try {
    let item;
    if (idText) {
      const ident = parseIdentifier(idText);
      if (!ident) throw new Error("Could not parse identifier (try a DOI, arXiv ID, or PMID).");
      item = await fetchItem(ident, { citekeyPattern: pattern });
    } else {
      item = sampleItem();
      item.citekey = generateCitekey(item, pattern);
    }
    el("preview-out").textContent = `${item.citekey}.md  ←  ${item.title || "(sample)"}`;
  } catch (e) {
    el("preview-out").textContent = `Error: ${e.message}`;
  }
}

function parseIdentifier(s) {
  // Allow raw DOI / arXiv ID / PMID, or a URL pointing at one.
  const fromUrl = detectFromUrl(s);
  if (fromUrl) return fromUrl;
  if (/^10\.\d{4,9}\//.test(s)) return { kind: "doi", id: s };
  if (/^\d{4}\.\d{4,5}(v\d+)?$/.test(s)) return { kind: "arxiv", id: s.replace(/v\d+$/, "") };
  if (/^\d{6,9}$/.test(s)) return { kind: "pmid", id: s };
  return null;
}

function sampleItem() {
  return {
    title: "A curated, ontology-based, large-scale knowledge graph of artificial intelligence tasks and benchmarks",
    year: "2021",
    date: "2021-10-04",
    itemType: "journalArticle",
    publicationTitle: "Database",
    creators: [
      { creatorType: "author", firstName: "Kathrin", lastName: "Blagec" },
      { creatorType: "author", firstName: "Simon", lastName: "Ott" },
    ],
  };
}
