// Unified fetch: given a detected identifier, returns a Zotero-compatible item
// augmented with citekey, importDate, bibliography, relations (empty), attachments (empty).

import { fetchCrossref } from "./extractors/crossref.js";
import { fetchArxiv } from "./extractors/arxiv.js";
import { fetchPubmed } from "./extractors/pubmed.js";
import { generateCitekey } from "./citekey.js";
import { buildBibliography } from "./bibliography.js";

export async function fetchItem(ident, { citekeyPattern } = {}) {
  if (!ident) throw new Error("No identifier detected on this page.");

  let base = await getCachedBase(ident);
  if (!base) {
    base = await fetchBase(ident);
    await setCachedBase(ident, base);
  }

  const item = { ...base };
  item.citekey = generateCitekey(item, citekeyPattern);
  item.importDate = new Date().toISOString();
  item.relations = [];
  item.attachments = [];
  item.bibliography = await buildBibliography(item);
  return item;
}

async function fetchBase(ident) {
  switch (ident.kind) {
    case "doi":
      return await fetchCrossref(ident.id);
    case "arxiv": {
      let item = await fetchArxiv(ident.id);
      if (item.DOI) {
        try {
          const cr = await fetchCrossref(item.DOI);
          item = { ...item, ...stripEmpty(cr) };
        } catch {
          // ignore, arXiv data is fine
        }
      }
      return item;
    }
    case "pmid": {
      let item = await fetchPubmed(ident.id);
      if (item.DOI) {
        try {
          const cr = await fetchCrossref(item.DOI);
          item = { ...item, ...stripEmpty(cr), extra: item.extra };
        } catch {
          // ignore
        }
      }
      return item;
    }
    default:
      throw new Error(`Unknown identifier kind: ${ident.kind}`);
  }
}

const CACHE_PREFIX = "paperclipper:item:";
const cacheKey = (ident) => `${CACHE_PREFIX}${ident.kind}:${ident.id}`;

async function getCachedBase(ident) {
  if (!globalThis.chrome?.storage?.session) return null;
  const key = cacheKey(ident);
  const obj = await chrome.storage.session.get(key);
  return obj[key] ?? null;
}

async function setCachedBase(ident, item) {
  if (!globalThis.chrome?.storage?.session) return;
  await chrome.storage.session.set({ [cacheKey(ident)]: item });
}

function stripEmpty(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== "" && v !== null && v !== undefined) out[k] = v;
  }
  return out;
}
