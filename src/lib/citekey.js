// Citekey generator with a Better-BibTeX-inspired pattern language.
//
// Pattern syntax (subset of https://retorque.re/zotero-better-bibtex/citing/):
//   expression := term ("+" term)*
//   term       := atom ("." filter)*
//   atom       := function_call | string_literal | identifier
//   function_call := identifier "(" arg ("," arg)* ")"
//   string_literal := '"…"' or "'…'"
//   arg        := number | string_literal
//
// Supported tokens (item-derived):
//   auth                - first author last name
//   auth(N)             - first N authors last names joined
//   authors             - all author last names joined
//   lastauthor          - last author last name
//   year                - publication year
//   title               - full title (alphanumeric only)
//   shorttitle(N, M)    - N significant words from first M significant words
//   journal             - publication title (alphanumeric only)
//   itemtype            - itemType field
//
// Supported filters (applied to a string):
//   .lower / .lowercase
//   .upper / .uppercase
//   .capitalize
//   .clean              - fold accents, keep [A-Za-z0-9]
//   .nopunct            - strip punctuation
//   .condense           - strip whitespace
//
// The final result has remaining whitespace stripped.

const STOPWORDS = new Set([
  "a", "an", "the", "and", "or", "but", "for", "nor", "on", "at", "to",
  "from", "by", "of", "in", "with", "as", "is", "are", "was", "were", "be",
  "been", "being", "this", "that", "these", "those", "it", "its", "into",
  "via", "vs", "over", "under", "between", "among",
]);

export function generateCitekey(item, pattern) {
  const pat = pattern && pattern.trim() ? pattern : 'auth.lower + "_" + shorttitle(3,3).lower + "_" + year';
  const tokens = tokenize(pat);
  const ast = parse(tokens);
  const out = evaluate(ast, item);
  return out.replace(/\s+/g, "");
}

// ---------- tokenizer ----------

function tokenize(src) {
  const out = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    if (c === "+" || c === "." || c === "(" || c === ")" || c === ",") {
      out.push({ type: c, value: c });
      i++;
      continue;
    }
    if (c === '"' || c === "'") {
      const quote = c;
      let j = i + 1;
      let val = "";
      while (j < src.length && src[j] !== quote) {
        if (src[j] === "\\" && j + 1 < src.length) {
          val += src[j + 1];
          j += 2;
        } else {
          val += src[j];
          j++;
        }
      }
      if (src[j] !== quote) throw new Error(`Unterminated string in citekey pattern`);
      out.push({ type: "string", value: val });
      i = j + 1;
      continue;
    }
    if (/[0-9]/.test(c)) {
      let j = i;
      while (j < src.length && /[0-9]/.test(src[j])) j++;
      out.push({ type: "number", value: parseInt(src.slice(i, j), 10) });
      i = j;
      continue;
    }
    if (/[a-zA-Z_]/.test(c)) {
      let j = i;
      while (j < src.length && /[a-zA-Z0-9_]/.test(src[j])) j++;
      out.push({ type: "ident", value: src.slice(i, j) });
      i = j;
      continue;
    }
    throw new Error(`Unexpected character in citekey pattern at offset ${i}: ${c}`);
  }
  return out;
}

// ---------- parser ----------

function parse(tokens) {
  let pos = 0;
  const peek = () => tokens[pos];
  const consume = (type) => {
    const t = tokens[pos];
    if (!t || t.type !== type) throw new Error(`Expected ${type}, got ${t?.type}`);
    pos++;
    return t;
  };

  function parseExpr() {
    const parts = [parseTerm()];
    while (peek() && peek().type === "+") {
      pos++;
      parts.push(parseTerm());
    }
    return { kind: "concat", parts };
  }

  function parseTerm() {
    let node = parseAtom();
    while (peek() && peek().type === ".") {
      pos++;
      const fn = consume("ident");
      node = { kind: "filter", target: node, name: fn.value };
    }
    return node;
  }

  function parseAtom() {
    const t = peek();
    if (!t) throw new Error("Unexpected end of pattern");
    if (t.type === "string") { pos++; return { kind: "string", value: t.value }; }
    if (t.type === "ident") {
      pos++;
      if (peek() && peek().type === "(") {
        pos++;
        const args = [];
        if (peek() && peek().type !== ")") {
          args.push(parseArg());
          while (peek() && peek().type === ",") {
            pos++;
            args.push(parseArg());
          }
        }
        consume(")");
        return { kind: "call", name: t.value, args };
      }
      return { kind: "call", name: t.value, args: [] };
    }
    throw new Error(`Unexpected token: ${t.type}`);
  }

  function parseArg() {
    const t = peek();
    if (!t) throw new Error("Expected argument");
    if (t.type === "number") { pos++; return t.value; }
    if (t.type === "string") { pos++; return t.value; }
    throw new Error(`Unsupported argument token: ${t.type}`);
  }

  const expr = parseExpr();
  if (pos < tokens.length) throw new Error(`Trailing tokens in pattern at position ${pos}`);
  return expr;
}

// ---------- evaluator ----------

function evaluate(node, item) {
  switch (node.kind) {
    case "concat":
      return node.parts.map((p) => evaluate(p, item)).join("");
    case "string":
      return node.value;
    case "call":
      return callFunction(node.name, node.args, item);
    case "filter":
      return applyFilter(evaluate(node.target, item), node.name);
    default:
      throw new Error(`Unknown node kind: ${node.kind}`);
  }
}

function callFunction(name, args, item) {
  const fn = FUNCTIONS[name.toLowerCase()];
  if (!fn) throw new Error(`Unknown function in citekey pattern: ${name}`);
  return fn(item, ...args);
}

function applyFilter(value, name) {
  const fn = FILTERS[name.toLowerCase()];
  if (!fn) throw new Error(`Unknown filter in citekey pattern: ${name}`);
  return fn(String(value));
}

// ---------- token functions ----------

const FUNCTIONS = {
  auth: (item, n) => {
    const authors = authorList(item);
    if (!authors.length) return "anonymous";
    if (n == null) return cleanWord(lastNameOf(authors[0]));
    return authors
      .slice(0, n)
      .map((a) => cleanWord(lastNameOf(a)))
      .join("");
  },
  authors: (item) => authorList(item).map((a) => cleanWord(lastNameOf(a))).join(""),
  lastauthor: (item) => {
    const authors = authorList(item);
    if (!authors.length) return "anonymous";
    return cleanWord(lastNameOf(authors[authors.length - 1]));
  },
  year: (item) => {
    const y = item.year || extractYear(item.date);
    return y || "nd";
  },
  title: (item) => cleanWord(item.title || ""),
  journal: (item) => cleanWord(item.publicationTitle || ""),
  itemtype: (item) => cleanWord(item.itemType || ""),
  shorttitle: (item, take = 3, _scan = 3) => {
    const cleaned = foldAscii(item.title || "")
      .toLowerCase()
      .replace(/[^a-z0-9\s\-]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const words = cleaned.split(" ").filter(Boolean);
    const picked = [];
    for (const w of words) {
      if (picked.length >= take) break;
      if (STOPWORDS.has(w)) continue;
      picked.push(w);
    }
    if (picked.length === 0 && words.length) picked.push(words[0]);
    return picked.join("").replace(/[^a-z0-9]/g, "");
  },
};

const FILTERS = {
  lower: (s) => s.toLowerCase(),
  lowercase: (s) => s.toLowerCase(),
  upper: (s) => s.toUpperCase(),
  uppercase: (s) => s.toUpperCase(),
  capitalize: (s) => (s ? s[0].toUpperCase() + s.slice(1).toLowerCase() : ""),
  clean: (s) => foldAscii(s).replace(/[^A-Za-z0-9]/g, ""),
  nopunct: (s) => s.replace(/[^A-Za-z0-9\s]/g, ""),
  condense: (s) => s.replace(/\s+/g, ""),
};

function authorList(item) {
  const creators = Array.isArray(item.creators) ? item.creators : [];
  const authors = creators.filter((c) => c.creatorType === "author");
  return authors.length ? authors : creators;
}

function lastNameOf(c) {
  return c.lastName || c.name || c.firstName || "anonymous";
}

function cleanWord(s) {
  return foldAscii(String(s)).replace(/[^A-Za-z0-9]/g, "");
}

function extractYear(date) {
  if (!date) return "";
  const m = String(date).match(/\b(\d{4})\b/);
  return m ? m[1] : "";
}

function foldAscii(s) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ß/g, "ss")
    .replace(/æ/gi, "ae")
    .replace(/œ/gi, "oe")
    .replace(/ø/gi, "o");
}
