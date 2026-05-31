// arXiv metadata client. Returns Zotero-compatible item dict.
//
// We resolve metadata via DataCite instead of export.arxiv.org. Every arXiv
// paper is registered with a DOI of the form 10.48550/arXiv.<id> in DataCite,
// whose API returns full metadata and is not subject to the aggressive per-IP
// rate limiting (HTTP 429 "Rate exceeded") that export.arxiv.org applies at its
// CDN layer. https://api.datacite.org/dois/10.48550/arXiv.<id>

export async function fetchArxiv(id) {
  const doi = `10.48550/arXiv.${id}`;
  const url = `https://api.datacite.org/dois/${encodeURIComponent(doi)}`;
  const res = await fetch(url, { headers: { Accept: "application/vnd.api+json" } });
  if (!res.ok) throw new Error(`arXiv (DataCite) ${res.status} for ${id}`);
  const json = await res.json();
  return dataciteToItem(json?.data?.attributes ?? {}, id);
}

function dataciteToItem(attr, id) {
  const titles = Array.isArray(attr.titles) ? attr.titles : [];
  const title = (titles[0]?.title || "").replace(/\s+/g, " ").trim();

  const creators = (Array.isArray(attr.creators) ? attr.creators : [])
    .filter((c) => (c.nameType ?? "Personal") !== "Organizational")
    .map((c) => {
      let firstName = (c.givenName || "").trim();
      let lastName = (c.familyName || "").trim();
      if (!lastName) {
        // Fall back to parsing "Last, First" or "First Last".
        const name = (c.name || "").trim();
        if (name.includes(",")) {
          const [last, first] = name.split(",", 2);
          lastName = last.trim();
          firstName = (first || "").trim();
        } else {
          const parts = name.split(/\s+/);
          lastName = parts.pop() || name;
          firstName = parts.join(" ");
        }
      }
      return { creatorType: "author", firstName, lastName };
    });

  // Prefer the submission date for a full YYYY-MM-DD; fall back to issued/year.
  const dates = Array.isArray(attr.dates) ? attr.dates : [];
  const byType = (t) => dates.find((d) => d.dateType === t)?.date || "";
  const fullDate = byType("Submitted") || byType("Issued") || byType("Available") || "";
  const year = String(attr.publicationYear || fullDate.slice(0, 4) || "");
  const date = /^\d{4}-\d{2}-\d{2}/.test(fullDate) ? fullDate.slice(0, 10) : year;

  const descriptions = Array.isArray(attr.descriptions) ? attr.descriptions : [];
  const abs = (
    descriptions.find((d) => d.descriptionType === "Abstract")?.description ||
    descriptions[0]?.description ||
    ""
  )
    .replace(/\s+/g, " ")
    .trim();

  // A journal/conference DOI, if the preprint has since been published, lives in
  // relatedIdentifiers. Surface it so downstream CrossRef enrichment can run.
  let doi = "";
  for (const rel of Array.isArray(attr.relatedIdentifiers) ? attr.relatedIdentifiers : []) {
    if ((rel.relatedIdentifierType || "").toUpperCase() !== "DOI") continue;
    const candidate = (rel.relatedIdentifier || "").trim();
    if (candidate && !/^10\.48550\/arxiv\./i.test(candidate)) {
      doi = candidate;
      break;
    }
  }

  return {
    itemType: "preprint",
    title,
    creators,
    date,
    year,
    DOI: doi,
    url: `https://arxiv.org/abs/${id}`,
    abstractNote: abs,
    publicationTitle: "arXiv",
    archive: "arXiv",
    archiveID: `arXiv:${id}`,
    repository: "arXiv",
    libraryCatalog: "arXiv.org",
  };
}
