// The core reads the signed-in user's settings from window and keeps safety copies in
// localStorage, as the app does in the browser. Give Node the same two globals.
globalThis.window = globalThis;
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear()
};
// The offline retry listens for the browser's 'online' event
const listeners = {};
globalThis.addEventListener = (type, fn) => { (listeners[type] = listeners[type] || new Set()).add(fn); };
globalThis.removeEventListener = (type, fn) => { if (listeners[type]) listeners[type].delete(fn); };
globalThis.dispatchTestEvent = (type) => { (listeners[type] || new Set()).forEach((fn) => fn()); };
