// chrome.storage.local for user preferences (non-handle values).

const DEFAULTS = {
  citekeyPattern: 'auth.lower + "_" + shorttitle(3,3).lower + "_" + year',
};

export async function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get(DEFAULTS, (out) => resolve(out));
  });
}

export async function saveSettings(patch) {
  return new Promise((resolve) => {
    chrome.storage.local.set(patch, () => resolve());
  });
}

export function defaultSettings() {
  return { ...DEFAULTS };
}
