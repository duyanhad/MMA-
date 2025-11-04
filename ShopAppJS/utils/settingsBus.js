// utils/settingsBus.js
const listeners = new Set();

export const subscribeSettings = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

export const emitSettings = (nextSettings) => {
  for (const fn of listeners) {
    try { fn(nextSettings); } catch {}
  }
};
