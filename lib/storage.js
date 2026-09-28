// Minimal localStorage helpers, same shape as the public site's lib/storage.js.
// Try/catch: private browsing and locked-down browsers throw on access rather
// than just returning null, and a chrome preference (the rail's collapsed
// state) breaking the page is worse than it silently not persisting.

export function readLocal(key, fallback = null) {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? fallback : raw;
  } catch (e) {
    return fallback;
  }
}

export function writeLocal(key, value) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, value);
  } catch (e) {}
}
