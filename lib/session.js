// The session cookie, and nothing else. One place decides its name, its flags
// and how it is read, so a route can never set it one way and read it another.
//
// WHY THE TOKEN LIVES IN AN httpOnly COOKIE AND NOT IN THE BROWSER:
// the admin token opens real booking and price data. Anything the browser can
// read, a script on the page can read - an injected dependency, a browser
// extension, a copy/pasted snippet. httpOnly means the browser sends the cookie
// but no JavaScript can read it, not even ours. The pages here never see it;
// they call this app's own /api routes, and those routes call cahyana-api.
//
// That indirection also removes CORS from the picture entirely: the only
// cross-origin call is server-to-server, and CORS is a browser rule.
import { cookies } from 'next/headers';

export const COOKIE = 'cue_dash';

// Matches ADMIN_SESSION_DAYS in cahyana-api. The row there is what actually
// expires - this is only how long the browser bothers to keep sending it.
const DAYS = 30;

const base = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  path: '/',
};

// Value shape: "live:<upstream token>" or "demo:". The prefix is what tells a
// route which world it is in - demo requests must never reach cahyana-api.
export function packLive(token) { return `live:${token}`; }
export function packDemo() { return 'demo:'; }

export function parse(value) {
  if (!value) return null;
  const i = value.indexOf(':');
  if (i === -1) return null;
  const kind = value.slice(0, i);
  const token = value.slice(i + 1);
  if (kind === 'demo') return { demo: true, token: '' };
  if (kind === 'live' && token) return { demo: false, token };
  return null;
}

// Read the session in a route handler. Returns null when there is none.
export async function readSession() {
  const jar = await cookies();
  return parse(jar.get(COOKIE)?.value);
}

export function cookieFor(value) {
  return { name: COOKIE, value, ...base, maxAge: DAYS * 24 * 60 * 60 };
}

export function clearedCookie() {
  return { name: COOKIE, value: '', ...base, maxAge: 0 };
}
