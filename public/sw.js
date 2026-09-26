// The dashboard's worker does even less than the site's, on purpose.
//
// EVERYTHING HERE IS SOMEBODY'S LIVE DATA behind a session cookie: bookings,
// prices, guest messages. A cached page or a cached API response is a stale
// answer about money, or an answer shown to whoever picks the phone up next.
// So it caches NOTHING that came from the server. It exists because Chrome will
// not offer "Add to Home Screen" without a fetch handler, and because a page
// with no signal should say so.
const VERSION = 'cahyana-dash-v1';
const ASSETS = `${VERSION}-assets`;
const OFFLINE_URL = '/offline';   // a server-rendered route, not a static file - this app is not an export

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(ASSETS).then((c) => c.add(new Request(OFFLINE_URL, { cache: 'reload' })))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;              // never touched

  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).catch(() => caches.match(OFFLINE_URL)));
    return;
  }

  // Only the build's own hashed files and the self-hosted font, whose names
  // change when their contents do.
  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/fonts/')) {
    e.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(ASSETS).then((c) => c.put(req, copy)); }
        return res;
      })),
    );
  }
});
