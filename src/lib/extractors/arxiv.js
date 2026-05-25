// arXiv API client. Returns Zotero-compatible item dict.
// http://export.arxiv.org/api/query?id_list=...

export async function fetchArxiv(id) {
  const url = `https://export.arxiv.org/api/query?id_list=${encodeURIComponent(id)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`arXiv ${res.status} for ${id}`);
  const xml = await res.text();
  return arxivXmlToItem(xml, id);
}

function arxivXmlToItem(xml, id) {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  const entry = doc.querySelector("entry");
  if (!entry) throw new Error(`arXiv: no entry for ${id}`);

  const text = (sel) => {
    const el = entry.querySelector(sel);
    return el ? el.textContent.trim() : "";
  };

  const authors = Array.from(entry.querySelectorAll("author > name")).map((n) => {
    const full = n.textContent.trim();
    const parts = full.split(/\s+/);
    const lastName = parts.pop() || full;
    const firstName = parts.join(" ");
    return { creatorType: "author", firstName, lastName };
  });

  const published = text("published");
  const year = published ? published.slice(0, 4) : "";
  const title = text("title").replace(/\s+/g, " ");
  const abs = text("summary").replace(/\s+/g, " ").trim();

  let doi = "";
  for (const link of entry.querySelectorAll("link")) {
    if (link.getAttribute("title") === "doi") {
      const href = link.getAttribute("href") || "";
      const m = href.match(/10\.\d{4,9}\/[\-._;()/:A-Z0-9]+/i);
      if (m) doi = m[0];
    }
  }
  const doiEl = entry.querySelector("arxiv\\:doi, doi");
  if (!doi && doiEl) doi = doiEl.textContent.trim();

  return {
    itemType: "preprint",
    title,
    creators: authors,
    date: published.slice(0, 10),
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
