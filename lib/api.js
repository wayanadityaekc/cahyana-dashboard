// The browser's only way to fetch data, and it never leaves this origin.
//
// There is no token here, and that is the whole point of the design: the admin
// token sits in an httpOnly cookie that this code cannot read, and the /api
// routes in this app are what carry it to cahyana-api. Same-origin also means
// the cookie rides along on its own - no Authorization header to forget, and
// no CORS, because the only cross-origin hop happens server to server.

// Thrown when the server says the session is no longer good, so a page can
// send the visitor to /login instead of showing an error banner.
export class Unauthorized extends Error {}

export async function getJson(path) {
  const res = await fetch(path, { credentials: 'same-origin' });
  if (res.status === 401 || res.status === 403) throw new Unauthorized('Session expired.');
  if (!res.ok) throw new Error(`Server answered ${res.status}.`);
  return res.json();
}

export async function postJson(path, body) {
  const res = await fetch(path, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (res.status === 401 || res.status === 403) throw new Unauthorized('Session expired.');
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

export async function login(user, pass) {
  const { status, json } = await postJson('/api/session', { user, pass });
  if (status !== 200) throw new Error(json.detail || 'Could not sign in.');
  return json;
}

export async function logout() {
  // Best effort: the cookie is cleared by the server, and the upstream session
  // row is revoked there too. A token only forgotten on the device is a token
  // that still opens the data if it was ever copied.
  try { await fetch('/api/session', { method: 'DELETE', credentials: 'same-origin' }); }
  catch { /* the page navigates to /login either way */ }
}
