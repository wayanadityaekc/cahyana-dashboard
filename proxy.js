import { NextResponse } from 'next/server';
import { COOKIE } from './lib/session.js';

// WHAT THIS DOES, AND WHAT IT DOES NOT DO.
// It checks that a session cookie EXISTS before serving a dashboard page. That
// is a routing convenience, not the security boundary: it cannot tell a valid
// token from a made-up one without a network call on every request.
//
// The real gate is cahyana-api. Every figure on these pages comes from an
// endpoint behind requireAuth, so a forged cookie gets a page with nothing in
// it and an immediate bounce back to /login. Nothing sensitive is ever baked
// into the page itself.
export function proxy(req) {
  if (req.cookies.get(COOKIE)) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = '/login';
  url.search = '';
  return NextResponse.redirect(url);
}

// Everything except /login, this app's own API routes, and static assets.
export const config = {
  matcher: ['/((?!login|api|_next/static|_next/image|fonts|favicon.ico).*)'],
};
