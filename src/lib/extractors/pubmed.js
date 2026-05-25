// PubMed EFetch (XML) → Zotero-compatible item.

export async function fetchPubmed(pmid) {
  const url = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=${encodeURIComponent(
    pmid,
  )}&retmode=xml`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`PubMed ${res.status} for ${pmid}`);
  const xml = await res.text();
  return pubmedXmlToItem(xml, pmid);
}

function pubmedXmlToItem(xml, pmid) {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  const art = doc.querySelector("PubmedArticle");
  if (!art) throw new Error(`PubMed: no article for ${pmid}`);

  const text = (sel, root = art) => {
    const el = root.querySelector(sel);
    return el ? el.textContent.trim() : "";
  };

  const title = text("ArticleTitle");
  const journal = text("Journal Title");
  const volume = text("JournalIssue Volume");
  const issue = text("JournalIssue Issue");
  const year =
    text("ArticleDate Year") ||
    text("PubDate Year") ||
    text("MedlineDate").slice(0, 4);

  const month = text("ArticleDate Month") || text("PubDate Month") || "";
  const day = text("ArticleDate Day") || text("PubDate Day") || "";
  const date = [year, month, day].filter(Boolean).join("-");

  const creators = Array.from(art.querySelectorAll("AuthorList > Author")).map((a) => {
    const collective = a.querySelector("CollectiveName");
    if (collective) return { creatorType: "author", name: collective.textContent.trim() };
    return {
      creatorType: "author",
      firstName: text("ForeName", a) || text("Initials", a),
      lastName: text("LastName", a),
    };
  });

  const abstract = Array.from(art.querySelectorAll("Abstract > AbstractText"))
    .map((el) => {
      const label = el.getAttribute("Label");
      const t = el.textContent.trim();
      return label ? `${label}: ${t}` : t;
    })
    .join(" ");

  let doi = "";
  art.querySelectorAll("ArticleId").forEach((el) => {
    if (el.getAttribute("IdType") === "doi") doi = el.textContent.trim();
  });

  return {
    itemType: "journalArticle",
    title,
    creators,
    date,
    year,
    DOI: doi,
    url: doi ? `https://doi.org/${doi}` : `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
    abstractNote: abstract,
    publicationTitle: journal,
    volume,
    issue,
    extra: `PMID: ${pmid}`,
  };
}
