// The dashboard's worker does even less than the site's, on purpose.
//
// EVERYTHING HERE IS SOMEBODY'S LIVE DATA behind a session cookie: bookings,
// prices, guest messages. A cached page or a cached API response is a stale
// answer about money, or an answer shown to whoever picks the phone up next.
// So it caches NOTHING that came from the server. It exists because Chrome will
// not offer "Add to Home Screen" without a fetch handler, and because a page
// with no signal should say so.
const VERSION = 'cahyana-dash-v3';
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

// ---- Push (DASHBOARD BRIEF #5) ---------------------------------------------
// The payload is built by cahyana-api/push.js: { title, body, tab, tag }. Only
// a booking ref and a tour name ever reach the lock screen. The icon is the
// Lucide bell, the same glyph as the Settings row (tools/make-bell-icons.js).
const SECTIONS = new Set(['attention', 'upcoming', 'past', 'undated', 'dispatch', 'drivers', 'prices', 'promo', 'content', 'reviews', 'chat', 'settings']);
// The driver app's tabs (DASHBOARD BRIEF #7). A driver push carries
// url "/driver?tab=<tab>"; only these four tabs are honoured.
const DRIVER_TABS = new Set(['bookings', 'earnings', 'chat', 'account']);

function targetOf(p) {
  const m = typeof p.url === 'string' && p.url.match(/^\/driver\?tab=([a-z]+)$/);
  if (m) return DRIVER_TABS.has(m[1]) ? `/driver?tab=${m[1]}` : '/driver';
  const tab = SECTIONS.has(p.tab) ? p.tab : '';
  return tab ? `/?tab=${tab}` : '/';
}

self.addEventListener('push', (e) => {
  let p = {};
  try { p = e.data ? e.data.json() : {}; } catch { p = { body: e.data ? e.data.text() : '' }; }
  const url = targetOf(p);
  const driver = url.startsWith('/driver');
  e.waitUntil(self.registration.showNotification(p.title || (driver ? 'Cahyana driver' : 'Cahyana dashboard'), {
    body: p.body || '',
    icon: driver ? '/icons/driver-icon-192.png' : '/icons/bell-192.png',
    badge: '/icons/bell-badge-96.png',
    // Same kind replaces the last one instead of stacking ten "Chat" banners.
    tag: p.tag || 'dashboard',
    renotify: true,
    data: { url },
  }));
});

// Tap: focus a dashboard that is already open and move it to the section, or
// open one. Only paths on this origin, built above - never a URL from the payload.
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '/';
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const wantDriver = url.startsWith('/driver');
    for (const w of wins) {
      const u = new URL(w.url);
      const isDriver = u.pathname === '/driver' || u.pathname.startsWith('/driver/');
      if (u.origin === self.location.origin && isDriver === wantDriver && 'focus' in w) {
        await w.focus();
        if ('navigate' in w) return w.navigate(url);
        return undefined;
      }
    }
    return self.clients.openWindow(url);
  })());
});
