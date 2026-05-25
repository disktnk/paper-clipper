// File System Access API helpers. Two independent handles are persisted:
//   - templateFileHandle: a FileSystemFileHandle pointing at the .md template
//   - saveDirHandle:      a FileSystemDirectoryHandle for the output folder
// Both live in IndexedDB. Neither has to be inside an Obsidian vault.

const DB_NAME = "paper-clipper";
const STORE = "kv";
const KEY_TEMPLATE = "templateFileHandle";
const KEY_SAVE_DIR = "saveDirHandle";

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet(key) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbSet(key, val) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(val, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ---- Template file ----

export async function pickTemplateFile() {
  const [handle] = await window.showOpenFilePicker({
    types: [
      {
        description: "Markdown template",
        accept: { "text/markdown": [".md"] },
      },
    ],
    excludeAcceptAllOption: false,
    multiple: false,
  });
  await idbSet(KEY_TEMPLATE, handle);
  return handle;
}

export async function getTemplateFileHandle() {
  return (await idbGet(KEY_TEMPLATE)) || null;
}

export async function readTemplateFile(handle) {
  const f = await handle.getFile();
  return await f.text();
}

// ---- Save directory ----

export async function pickSaveDirectory() {
  const handle = await window.showDirectoryPicker({ mode: "readwrite" });
  await idbSet(KEY_SAVE_DIR, handle);
  return handle;
}

export async function getSaveDirHandle() {
  return (await idbGet(KEY_SAVE_DIR)) || null;
}

export async function writeMarkdown(saveDir, fileName, contents, { overwrite = false } = {}) {
  if (!overwrite) {
    try {
      await saveDir.getFileHandle(fileName, { create: false });
      throw new Error(`File already exists: ${fileName}`);
    } catch (e) {
      if (e.name !== "NotFoundError") throw e;
    }
  }
  const fh = await saveDir.getFileHandle(fileName, { create: true });
  const w = await fh.createWritable();
  await w.write(contents);
  await w.close();
}

// ---- Permissions ----

export async function queryPermission(handle, mode) {
  return await handle.queryPermission({ mode });
}

export async function requestPermission(handle, mode) {
  const r = await handle.requestPermission({ mode });
  return r === "granted";
}
