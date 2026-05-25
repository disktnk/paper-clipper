// Render a Nature-style bibliography string from an item.
//
// The Zotero Obsidian Connector produces output like
//     "1.  Cao, Y. _et al._ LEGO-GraphRAG: ... (2025)."
// and the template uses `bibliography.slice(4)` to strip the leading "1.  ".
// We mimic the same 4-char prefix so the existing template stays compatible.

const PREFIX = "1.  ";

export async function buildBibliography(item) {
  const authors = formatAuthors(item.creators || []);
  const title = (item.title || "").replace(/\.$/, "");
  const year = item.year || extractYear(item.date) || "n.d.";
  const journal = item.publicationTitle || "";
  const vol = item.volume ? ` **${item.volume}**` : "";
  const pages = item.pages ? `, ${item.pages}` : "";

  const venuePart = journal
    ? ` _${journal}_${vol}${pages} (${year}).`
    : item.DOI
    ? ` Preprint at [https://doi.org/${item.DOI}](https://doi.org/${item.DOI}) (${year}).`
    : ` (${year}).`;

  return `${PREFIX}${authors} ${title}.${venuePart}`;
}

function formatAuthors(creators) {
  const authors = creators.filter((c) => c.creatorType === "author");
  if (authors.length === 0) return "Anonymous.";
  if (authors.length === 1) return `${formatOne(authors[0])}.`;
  if (authors.length <= 5) {
    const formatted = authors.map(formatOne);
    const last = formatted.pop();
    return `${formatted.join(", ")} & ${last}.`;
  }
  return `${formatOne(authors[0])} _et al._`;
}

function formatOne(c) {
  if (c.name) return c.name;
  const initials = (c.firstName || "")
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0].toUpperCase() + ".")
    .join(" ");
  return `${c.lastName || ""}, ${initials}`.trim();
}

function extractYear(date) {
  if (!date) return "";
  const m = String(date).match(/\b(\d{4})\b/);
  return m ? m[1] : "";
}
