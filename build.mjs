import * as esbuild from "esbuild";
import { cp, mkdir, rm, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(__dirname, "src");
const OUT = path.join(__dirname, "dist");
const watch = process.argv.includes("--watch");

async function build() {
  if (existsSync(OUT)) await rm(OUT, { recursive: true });
  await mkdir(OUT, { recursive: true });
  await mkdir(path.join(OUT, "popup"), { recursive: true });
  await mkdir(path.join(OUT, "options"), { recursive: true });
  await mkdir(path.join(OUT, "background"), { recursive: true });
  await mkdir(path.join(OUT, "sandbox"), { recursive: true });
  await mkdir(path.join(OUT, "icons"), { recursive: true });

  // Copy static assets
  await cp(path.join(SRC, "manifest.json"), path.join(OUT, "manifest.json"));
  await cp(path.join(SRC, "popup", "popup.html"), path.join(OUT, "popup", "popup.html"));
  await cp(path.join(SRC, "popup", "popup.css"), path.join(OUT, "popup", "popup.css"));
  await cp(path.join(SRC, "options", "options.html"), path.join(OUT, "options", "options.html"));
  await cp(path.join(SRC, "options", "options.css"), path.join(OUT, "options", "options.css"));
  await cp(path.join(SRC, "sandbox", "sandbox.html"), path.join(OUT, "sandbox", "sandbox.html"));

  // Icons: if not present, generate placeholders
  const iconsDir = path.join(__dirname, "icons");
  if (existsSync(iconsDir)) {
    await cp(iconsDir, path.join(OUT, "icons"), { recursive: true });
  }
  await ensureIcons(path.join(OUT, "icons"));

  const common = {
    bundle: true,
    format: "esm",
    target: "chrome120",
    platform: "browser",
    sourcemap: !watch ? false : "inline",
    logLevel: "info",
    define: {
      "process.env.NODE_ENV": JSON.stringify("production"),
    },
    loader: { ".js": "js" },
  };

  const entries = [
    {
      entryPoints: [path.join(SRC, "popup", "popup.js")],
      outfile: path.join(OUT, "popup", "popup.js"),
    },
    {
      entryPoints: [path.join(SRC, "options", "options.js")],
      outfile: path.join(OUT, "options", "options.js"),
    },
    {
      entryPoints: [path.join(SRC, "background", "background.js")],
      outfile: path.join(OUT, "background", "background.js"),
    },
    {
      entryPoints: [path.join(SRC, "sandbox", "sandbox.js")],
      outfile: path.join(OUT, "sandbox", "sandbox.js"),
    },
  ];

  if (watch) {
    const ctxs = await Promise.all(
      entries.map((e) => esbuild.context({ ...common, ...e })),
    );
    await Promise.all(ctxs.map((c) => c.watch()));
    console.log("Watching for changes…");
  } else {
    for (const e of entries) {
      await esbuild.build({ ...common, ...e });
    }
    console.log("Build complete →", OUT);
  }
}

// Generate solid-colored PNG placeholders if no icons are provided.
async function ensureIcons(dir) {
  const need = ["icon-16.png", "icon-48.png", "icon-128.png"];
  for (const name of need) {
    const target = path.join(dir, name);
    if (existsSync(target)) continue;
    const size = parseInt(name.match(/icon-(\d+)/)[1], 10);
    await writeFile(target, makePlaceholderPng(size));
  }
}

// Minimal 1x1 PNG (will be auto-scaled by Chrome).
function makePlaceholderPng(_size) {
  // Pre-computed 1x1 blue PNG.
  return Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQI12NgkGfwAQAAyQDFmuV6dQAAAABJRU5ErkJggg==",
    "base64",
  );
}

build().catch((e) => {
  console.error(e);
  process.exit(1);
});
