// Identifier detection from a tab's URL and HTML.
// Returns one of: { kind: "arxiv", id } | { kind: "doi", id } | { kind: "pmid", id } | null

const ARXIV_HOSTS = new Set(["arxiv.org", "www.arxiv.org", "export.arxiv.org"]);

const ARXIV_ID_RE =
  /\b(\d{4}\.\d{4,5})(v\d+)?\b|\b([a-z\-]+(?:\.[A-Z]{2})?\/\d{7})\b/i;
const DOI_RE = /\b10\.\d{4,9}\/[\-._;()/:A-Z0-9]+/i;
const PMID_RE = /\b(?:pubmed|pmid)[\/=:_-]?\s*(\d{6,9})\b/i;

export function detectFromUrl(urlStr) {
  let u;
  try {
    u = new URL(urlStr);
  } catch {
    return null;
  }

  if (ARXIV_HOSTS.has(u.hostname)) {
    // /abs/2403.12345 or /abs/cs/0501001 or /pdf/2403.12345v2
    const m = u.pathname.match(/\/(?:abs|pdf|html)\/(.+?)(?:\.pdf)?$/);
    if (m) {
      const id = m[1].replace(/v\d+$/, "");
      return { kind: "arxiv", id };
    }
  }

  // doi.org/<doi>
  if (u.hostname.endsWith("doi.org")) {
    const doi = decodeURIComponent(u.pathname.replace(/^\//, ""));
    if (DOI_RE.test(doi)) return { kind: "doi", id: doi };
  }

  // pubmed
  if (u.hostname.includes("pubmed.ncbi.nlm.nih.gov")) {
    const m = u.pathname.match(/\/(\d{6,9})/);
    if (m) return { kind: "pmid", id: m[1] };
  }
  if (u.hostname.includes("ncbi.nlm.nih.gov")) {
    const m = u.search.match(/[?&]pmid=(\d{6,9})/i);
    if (m) return { kind: "pmid", id: m[1] };
  }

  return null;
}

// Sniff identifiers from the rendered page (meta tags + a focused regex over body).
// This runs in the page via chrome.scripting.executeScript.
export function pageSniffScript() {
  const meta = (name) => {
    const el =
      document.querySelector(`meta[name="${name}" i]`) ||
      document.querySelector(`meta[property="${name}" i]`);
    return el ? el.content : null;
  };

  const tryDoi = (s) => {
    if (!s) return null;
    const m = String(s).match(/10\.\d{4,9}\/[\-._;()/:A-Z0-9]+/i);
    return m ? m[0] : null;
  };

  // Standard meta-tag conventions used by publishers
  const doiCandidates = [
    meta("citation_doi"),
    meta("dc.identifier"),
    meta("dc.identifier.doi"),
    meta("prism.doi"),
    meta("DOI"),
  ];
  for (const c of doiCandidates) {
    const doi = tryDoi(c);
    if (doi) return { kind: "doi", id: doi };
  }

  const arxivCandidates = [
    meta("citation_arxiv_id"),
    meta("dc.identifier"),
  ];
  for (const c of arxivCandidates) {
    if (c) {
      const m = String(c).match(/\b(\d{4}\.\d{4,5})(v\d+)?\b/);
      if (m) return { kind: "arxiv", id: m[1] };
    }
  }

  // PMID via meta or URL canonical
  const pmidMeta = meta("citation_pmid");
  if (pmidMeta && /^\d+$/.test(pmidMeta)) {
    return { kind: "pmid", id: pmidMeta };
  }

  // Fallback: scan visible body text for a DOI
  const bodyText = document.body ? document.body.innerText.slice(0, 20000) : "";
  const doiInBody = tryDoi(bodyText);
  if (doiInBody) return { kind: "doi", id: doiInBody.replace(/[.,;)]+$/, "") };

  return null;
}
