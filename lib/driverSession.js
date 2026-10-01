// The DRIVER's session cookie (DASHBOARD BRIEF #7). Its own name, separate from
// the owner's `cue_dash`, so the two logins can sit in one browser (Wayan is
// both owner and a driver) and neither can be mistaken for the other.
//
// Same reasoning as lib/session.js: httpOnly, so no script on the page - ours
// included - can read the token. The driver pages call this app's /api/driver/*
// routes, and those carry it to cahyana-api server-to-server.
import { cookies } from 'next/headers';

export const DRIVER_COOKIE = 'cue_driver';

// Matches drivers.SESSION_DAYS in cahyana-api. The row there is what expires.
const DAYS = 30;

const base = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  path: '/',
};

export async function readDriverToken() {
  const jar = await cookies();
  const v = jar.get(DRIVER_COOKIE)?.value || '';
  return /^[0-9a-f]{48}$/.test(v) ? v : null;
}

export function driverCookie(token) {
  return { name: DRIVER_COOKIE, value: token, ...base, maxAge: DAYS * 24 * 60 * 60 };
}

export function clearedDriverCookie() {
  return { name: DRIVER_COOKIE, value: '', ...base, maxAge: 0 };
}
