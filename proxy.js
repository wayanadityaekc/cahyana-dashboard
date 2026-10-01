import { NextResponse } from 'next/server';
import { COOKIE } from './lib/session.js';
import { DRIVER_COOKIE } from './lib/driverSession.js';

// WHAT THIS DOES, AND WHAT IT DOES NOT DO.
// It checks that a session cookie EXISTS before serving a dashboard page. That
// is a routing convenience, not the security boundary: it cannot tell a valid
// token from a made-up one without a network call on every request.
//
// The real gate is cahyana-api. Every figure on these pages comes from an
// endpoint behind requireAuth, so a forged cookie gets a page with nothing in
// it and an immediate bounce back to /login. Nothing sensitive is ever baked
// into the page itself.
//
// TWO APPS, TWO DOORS (brief #7). /driver/* wants the DRIVER cookie and sends a
// visitor without one to /driver/login; everything else wants the owner's. The
// owner's cookie does not open /driver and a driver's does not open /, so a
// phone signed in as a driver lands on the driver sign-in, never the owner's.
export function proxy(req) {
  const path = req.nextUrl.pathname;

  if (path === '/driver' || path.startsWith('/driver/')) {
    if (path === '/driver/login') return NextResponse.next();
    if (req.cookies.get(DRIVER_COOKIE)) return NextResponse.next();
    return to(req, '/driver/login');
  }

  if (req.cookies.get(COOKIE)) return NextResponse.next();
  return to(req, '/login');
}

function to(req, pathname) {
  const url = req.nextUrl.clone();
  url.pathname = pathname;
  url.search = '';
  return NextResponse.redirect(url);
}

// Everything except /login, this app's own API routes, and static files. The
// manifests, worker and icons MUST be reachable signed out: the install prompt
// lives on the sign-in page, and a manifest that redirects to /login is not a
// manifest.
export const config = {
  matcher: ['/((?!login|api|_next/static|_next/image|fonts|icons|favicon.ico|manifest.webmanifest|driver.webmanifest|sw.js|logo.webp|offline).*)'],
};
