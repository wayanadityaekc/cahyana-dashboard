// The only place this app talks to cahyana-api. Every call goes out from the
// server with the admin token attached here - the browser never holds it.
import { readSession } from './session.js';

export class Unauthorized extends Error {}

function baseUrl() {
  const b = process.env.CAHYANA_API;
  if (!b) throw new Error('CAHYANA_API is not set');
  return b.replace(/\/+$/, '');
}

// Returns the parsed body. Throws Unauthorized when the upstream session is
// gone, so a route can clear the cookie and send the browser back to /login
// instead of rendering a page with nothing in it.
export async function upstream(path, { method = 'GET', body, token } = {}) {
  const res = await fetch(baseUrl() + path, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });

  if (res.status === 401 || res.status === 403) throw new Unauthorized();

  let json = null;
  try { json = await res.json(); } catch { /* upstream sent no body */ }
  return { status: res.status, json };
}

// Convenience for the data routes: read the cookie, refuse when there is none.
export async function withSession() {
  const s = await readSession();
  if (!s) throw new Unauthorized();
  return s;
}
