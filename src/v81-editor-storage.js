(function (root) {
  const PRIMARY_KEY = "ns.browser.v8.editor.v1";
  const BACKUP_KEY = "ns.browser.v8.editor.v1.backup";

  function safeGet(key) {
    try {
      return root.localStorage.getItem(key) || "";
    } catch (error) {
      console.warn("[NSEditorStorageV1] read failed:", error);
      return "";
    }
  }

  function safeSet(key, value) {
    try {
      root.localStorage.setItem(key, value);
    } catch (error) {
      console.warn("[NSEditorStorageV1] write failed:", error);
    }
  }

  function parseStore(raw) {
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (error) {
      return null;
    }
  }

  function hasDrafts(parsed) {
    return Boolean(parsed && Array.isArray(parsed.drafts) && parsed.drafts.length);
  }

  const primaryRaw = safeGet(PRIMARY_KEY);
  const backupRaw = safeGet(BACKUP_KEY);
  const primaryParsed = parseStore(primaryRaw);
  const backupParsed = parseStore(backupRaw);

  if (!primaryRaw && backupRaw && hasDrafts(backupParsed)) {
    safeSet(PRIMARY_KEY, backupRaw);
  } else if (primaryRaw && hasDrafts(primaryParsed)) {
    safeSet(BACKUP_KEY, primaryRaw);
  }

  root.__NSEditorStorageV1 = {
    PRIMARY_KEY,
    BACKUP_KEY,
    safeGet,
    safeSet,
    parseStore,
    hasDrafts
  };
})(window);
