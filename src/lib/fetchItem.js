// Unified fetch: given a detected identifier, returns a Zotero-compatible item
// augmented with citekey, importDate, bibliography, relations (empty), attachments (empty).

import { fetchCrossref } from "./extractors/crossref.js";
import { fetchArxiv } from "./extractors/arxiv.js";
import { fetchPubmed } from "./extractors/pubmed.js";
import { generateCitekey } from "./citekey.js";
import { buildBibliography } from "./bibliography.js";

export async function fetchItem(ident, { citekeyPattern } = {}) {
  if (!ident) throw new Error("No identifier detected on this page.");
  let item;
  switch (ident.kind) {
    case "doi":
      item = await fetchCrossref(ident.id);
      break;
    case "arxiv":
      item = await fetchArxiv(ident.id);
      // Enrich with Crossref if a DOI was discovered (preferred journal article metadata)
      if (item.DOI) {
        try {
          const cr = await fetchCrossref(item.DOI);
          item = { ...item, ...stripEmpty(cr) };
        } catch {
          // ignore, arXiv data is fine
        }
      }
      break;
    case "pmid":
      item = await fetchPubmed(ident.id);
      if (item.DOI) {
        try {
          const cr = await fetchCrossref(item.DOI);
          item = { ...item, ...stripEmpty(cr), extra: item.extra };
        } catch {
          // ignore
        }
      }
      break;
    default:
      throw new Error(`Unknown identifier kind: ${ident.kind}`);
  }

  item.citekey = generateCitekey(item, citekeyPattern);
  item.importDate = new Date().toISOString();
  item.relations = [];
  item.attachments = [];
  item.bibliography = await buildBibliography(item);
  return item;
}

function stripEmpty(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== "" && v !== null && v !== undefined) out[k] = v;
  }
  return out;
}
