// Crossref REST API client. Returns Zotero-compatible item dict.
// https://api.crossref.org/works/{doi}

const MAILTO = "paper-clipper@local";

const TYPE_MAP = {
  "journal-article": "journalArticle",
  "proceedings-article": "conferencePaper",
  "book-chapter": "bookSection",
  "book": "book",
  "monograph": "book",
  "edited-book": "book",
  "posted-content": "preprint",
  "report": "report",
  "dataset": "dataset",
  "dissertation": "thesis",
};

export async function fetchCrossref(doi) {
  const url = `https://api.crossref.org/works/${encodeURIComponent(doi)}?mailto=${MAILTO}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`Crossref ${res.status} for ${doi}`);
  const json = await res.json();
  return crossrefToItem(json.message, doi);
}

function crossrefToItem(m, doi) {
  const creators = [];
  for (const role of [["author", "author"], ["editor", "editor"]]) {
    const [crKey, zKey] = role;
    if (Array.isArray(m[crKey])) {
      for (const a of m[crKey]) {
        if (a.name) {
          creators.push({ creatorType: zKey, name: a.name });
        } else {
          creators.push({
            creatorType: zKey,
            firstName: a.given || "",
            lastName: a.family || "",
          });
        }
      }
    }
  }

  const issuedParts = (m.issued && m.issued["date-parts"] && m.issued["date-parts"][0]) || [];
  const date = issuedParts.join("-");
  const year = issuedParts[0] ? String(issuedParts[0]) : "";

  const containerTitle =
    (Array.isArray(m["container-title"]) && m["container-title"][0]) ||
    m["container-title"] ||
    "";

  const item = {
    itemType: TYPE_MAP[m.type] || "journalArticle",
    title: Array.isArray(m.title) ? m.title[0] : m.title || "",
    creators,
    date,
    year,
    DOI: doi,
    url: m.URL || `https://doi.org/${doi}`,
    abstractNote: stripHtml(m.abstract || ""),
    publicationTitle: containerTitle,
    bookTitle: m.type === "book-chapter" ? containerTitle : "",
    volume: m.volume || "",
    issue: m.issue || "",
    pages: m.page || "",
    publisher: m.publisher || "",
    ISSN: Array.isArray(m.ISSN) ? m.ISSN[0] : m.ISSN || "",
    ISBN: Array.isArray(m.ISBN) ? m.ISBN[0] : m.ISBN || "",
    language: m.language || "",
  };
  return item;
}

function stripHtml(s) {
  if (!s) return "";
  return s
    .replace(/<jats:p[^>]*>/gi, "")
    .replace(/<\/jats:p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
