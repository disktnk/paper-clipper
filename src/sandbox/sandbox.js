// Sandboxed renderer. MV3 sandbox pages get CSP with 'unsafe-eval', so
// Nunjucks (which compiles templates via new Function) can run here.
// Communicates with the popup via postMessage.

import nunjucks from "nunjucks";

const env = new nunjucks.Environment(null, {
  autoescape: false,
  throwOnUndefined: false,
});

env.addFilter("format", function (value, fmt) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    const s = String(value);
    if (fmt === "YYYY") return s.slice(0, 4);
    if (fmt === "YYYY-MM-DD") return s.slice(0, 10);
    return s;
  }
  const pad = (n) => String(n).padStart(2, "0");
  return fmt
    .replace(/YYYY/g, d.getFullYear())
    .replace(/MM/g, pad(d.getMonth() + 1))
    .replace(/DD/g, pad(d.getDate()));
});

env.addFilter("filterby", function (arr, key, op, val) {
  if (!Array.isArray(arr)) return [];
  return arr.filter((item) => {
    const v = item && item[key];
    if (v == null) return false;
    if (op === "endswith") return String(v).endsWith(val);
    if (op === "startswith") return String(v).startsWith(val);
    if (op === "contains") return String(v).includes(val);
    if (op === "eq" || op === "equalto") return v === val;
    return false;
  });
});

env.addFilter("selectattr", function (arr, key) {
  if (!Array.isArray(arr)) return [];
  return arr.filter((item) => item && item[key] != null && item[key] !== "");
});

env.addFilter("capitalize", function (s) {
  if (!s) return "";
  return s[0].toUpperCase() + s.slice(1);
});

window.addEventListener("message", (e) => {
  const data = e.data || {};
  if (data.type !== "render") return;
  const { id, template, context } = data;
  let response;
  try {
    response = { id, rendered: env.renderString(template, context) };
  } catch (err) {
    response = { id, error: err?.message || String(err) };
  }
  // e.source is the popup window; targetOrigin "*" is OK since both sides
  // are extension-controlled.
  e.source.postMessage(response, "*");
});

// Self-test: confirm eval is permitted in this context. If not, the page
// is not actually being served with the sandbox CSP.
let evalOk = false;
let evalErr = null;
try {
  evalOk = new Function("return 1")() === 1;
} catch (e) {
  evalErr = e?.message || String(e);
}
console.log("[paper-clipper sandbox] eval allowed:", evalOk, evalErr || "");

// Tell the parent we're ready to accept render requests.
if (window.parent && window.parent !== window) {
  window.parent.postMessage(
    { type: "sandbox-ready", evalOk, evalErr },
    "*",
  );
}
