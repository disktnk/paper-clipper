// Template rendering client. Runs the Nunjucks renderer in a sandboxed
// iframe (see src/sandbox/sandbox.js) so MV3's default CSP doesn't block
// new Function() / eval.

let frame = null;
let ready = null;
const pending = new Map();
let counter = 0;

function ensureFrame() {
  if (frame) return frame;
  frame = document.createElement("iframe");
  frame.src = chrome.runtime.getURL("sandbox/sandbox.html");
  frame.style.display = "none";
  frame.setAttribute("aria-hidden", "true");

  ready = new Promise((resolve, reject) => {
    const onMessage = (e) => {
      const data = e.data || {};
      if (e.source !== frame.contentWindow) return;
      if (data.type === "sandbox-ready") {
        if (data.evalOk) {
          resolve();
        } else {
          reject(
            new Error(
              `Sandbox CSP did not allow eval: ${data.evalErr || "unknown"}`,
            ),
          );
        }
        return;
      }
      const cb = pending.get(data.id);
      if (!cb) return;
      pending.delete(data.id);
      if (data.error) cb.reject(new Error(data.error));
      else cb.resolve(data.rendered);
    };
    window.addEventListener("message", onMessage);
  });

  document.body.appendChild(frame);
  return frame;
}

export async function renderTemplate(templateText, ctx) {
  ensureFrame();
  await ready;
  const id = ++counter;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    frame.contentWindow.postMessage(
      { type: "render", id, template: templateText, context: ctx },
      "*",
    );
  });
}
