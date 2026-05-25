# Paper Clipper

Chrome extension that clips an academic paper from the current tab and saves
it as a markdown note to a folder of your choice (Obsidian vault, plain
directory, whatever).

## What it does

1. Detect a DOI / arXiv ID / PMID on the current tab (URL pattern + page meta tags + body fallback).
2. Fetch metadata from Crossref / arXiv API / NCBI EFetch.
3. Render a user-picked Nunjucks template inside a sandboxed iframe.
4. Write `<citekey>.md` into a user-picked folder via the File System Access API.
5. Close the popup on success; keep it open and show the error otherwise.

Only papers exposing a DOI, arXiv ID, or PMID are supported.

## Build & install

```bash
npm install
npm run build      # output: dist/
```

Then in Chrome:

1. Visit `chrome://extensions` and enable **Developer mode**.
2. Click **Load unpacked** and pick the `dist/` folder.

## First-time setup

Open the options page (gear icon in the popup) and configure:

1. **Template file** — any `.md` file on disk. A starter template is
   provided at [`examples/template.md`](examples/template.md). Edits to the
   file take effect on the next clip; no rebuild needed.
2. **Save folder** — the directory where new notes will be written. Does
   not have to be inside an Obsidian vault.
3. **Citekey pattern** — Better-BibTeX-style expression. Default:
   `auth.lower + "_" + shorttitle(3,3).lower + "_" + year`.

Both file/folder handles are stored in IndexedDB. Chrome 122+ supports
persistent permissions; on older Chrome the popup will ask you to re-grant
access once per session.

## Citekey pattern syntax

```
expression := term ("+" term)*
term       := atom ("." filter)*
atom       := function_call | "string-literal" | identifier
```

**Tokens** (item-derived):

| Token | Description |
|---|---|
| `auth` | first author last name |
| `auth(N)` | first N authors concatenated |
| `authors` | all authors concatenated |
| `lastauthor` | last author last name |
| `year` | 4-digit year (`nd` if missing) |
| `title` | full title (alphanumeric only) |
| `shorttitle(N, M)` | N significant words from first M significant words |
| `journal` | publication title |
| `itemtype` | item type |

**Filters** (chain with `.`):

| Filter | Effect |
|---|---|
| `.lower` / `.lowercase` | lowercase |
| `.upper` / `.uppercase` | uppercase |
| `.capitalize` | initial cap, rest lower |
| `.clean` | fold accents, keep `[A-Za-z0-9]` |
| `.nopunct` | strip punctuation |
| `.condense` | strip whitespace |

Examples:

```
auth.lower + "_" + shorttitle(3,3).lower + "_" + year
                                              → wang_cybergymevaluatingai_2026

lastauthor + year                             → Samwald2021

auth(2).lower + year                          → smithjones2024
```

The pattern syntax is a subset of Better BibTeX
(<https://retorque.re/zotero-better-bibtex/citing/>).

## Usage

1. Open a paper page (arXiv abstract, journal landing page with DOI, PubMed entry, etc.).
2. Click the Paper Clipper toolbar icon.
3. The popup detects the identifier, fetches metadata, renders, and shows a preview.
4. Click **Save**. The popup closes on success; stays open with an error otherwise.

If a file with the same citekey already exists, save will refuse unless
**overwrite** is checked.

## Template

The template language is Nunjucks, plus a few filters that mirror the
Zotero Obsidian Connector so existing templates from that ecosystem work
unchanged:

- `format` — date formatting (`YYYY`, `YYYY-MM-DD`)
- `filterby` — array filter (`endswith`, `startswith`, `contains`, `eq`)
- `selectattr` — pick items where the attribute is truthy
- `groupby` — built-in Nunjucks

The item context passed to the template includes: `title`, `creators`,
`date`, `year`, `itemType`, `publicationTitle`, `volume`, `issue`,
`pages`, `DOI`, `url`, `abstractNote`, `publisher`, `language`, `citekey`,
`importDate`, `bibliography`, `relations` (always empty), `attachments`
(always empty).

`bibliography.slice(4)` strips the leading `"1.  "` prefix that the
extension prepends, matching the Zotero Connector's behavior.

Template rendering runs inside an extension sandbox page so MV3's default
`script-src 'self'` CSP doesn't block Nunjucks's `new Function()`
compilation.

## Layout

```
.
├── src/
│   ├── manifest.json          # MV3 manifest with sandboxed renderer
│   ├── popup/                 # toolbar popup UI
│   ├── options/               # options page
│   ├── sandbox/               # Nunjucks renderer (CSP-permissive iframe)
│   ├── background/            # MV3 service worker
│   └── lib/
│       ├── detect.js          # URL + page-meta sniff for DOI/arXiv/PMID
│       ├── extractors/        # API clients: crossref, arxiv, pubmed
│       ├── fetchItem.js       # orchestrates extraction
│       ├── citekey.js         # Better-BibTeX-style pattern engine
│       ├── bibliography.js    # Nature-style citation string
│       ├── template.js        # sandbox iframe client
│       ├── settings.js        # chrome.storage helpers
│       └── vault.js           # File System Access API helpers
├── examples/
│   └── template.md            # starter Nunjucks template
├── build.mjs                  # esbuild bundler
├── package.json
└── dist/                      # build output (load this in Chrome)
```

## Limitations

- Only DOI / arXiv ID / PMID-bearing pages are supported. Sites without
  any of these identifiers are out of scope.
- No PDF download.
- The `relations` template field is always empty.
