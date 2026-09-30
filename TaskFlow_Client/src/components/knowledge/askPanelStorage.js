// The TaskFlow AI conversation is kept in sessionStorage: it survives page navigation and
// refreshes in this browser tab, disappears when the tab closes, and is scoped per user.
// Kept separate from AskPanel so AuthContext can clear it on logout without a circular import.
export const STORAGE_PREFIX = "taskflow-ai:";
const MAX_MESSAGES_PER_MODE = 30;

export const clearAskPanelStorage = () => {
  try {
    Object.keys(sessionStorage)
      .filter((k) => k.startsWith(STORAGE_PREFIX))
      .forEach((k) => sessionStorage.removeItem(k));
  } catch {
    /* storage unavailable: nothing to clear */
  }
};

export const loadSaved = (key) => {
  try {
    const saved = JSON.parse(sessionStorage.getItem(key) || "null");
    if (saved && saved.history?.knowledge && saved.history?.data) return saved;
  } catch {
    /* unavailable or corrupt: start fresh */
  }
  return null;
};

export const saveState = (key, state) => {
  const trim = (h) => ({
    knowledge: h.knowledge.slice(-MAX_MESSAGES_PER_MODE),
    data: h.data.slice(-MAX_MESSAGES_PER_MODE),
  });
  try {
    sessionStorage.setItem(key, JSON.stringify({ ...state, history: trim(state.history) }));
  } catch {
    // Probably over the storage quota: drop the bulky task records from data answers and retry
    try {
      const slim = trim(state.history);
      slim.data = slim.data.map((m) => (m.result?.records ? { ...m, result: { ...m.result, records: undefined } } : m));
      sessionStorage.setItem(key, JSON.stringify({ ...state, history: slim }));
    } catch {
      /* give up silently: the in-memory conversation still works */
    }
  }
};
