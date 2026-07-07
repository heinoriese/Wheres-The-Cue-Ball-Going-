// Parliament of the Snake — Daily Edit · service worker
// Shell loads instantly & offline; manuscript data is network-first with an
// offline cache fallback. Commits (PUTs) always go straight to the network.
const CACHE = 'pots-v2';
const SHELL = [
  './editor.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return; // commits & writes: network only
  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    // App shell — stale-while-revalidate: instant from cache, refresh in background.
    e.respondWith(caches.open(CACHE).then(async c => {
      const cached = await c.match(req, { ignoreSearch: true });
      const network = fetch(req)
        .then(res => { if (res && res.ok) c.put(req, res.clone()); return res; })
        .catch(() => null);
      return cached || network || fetch(req);
    }));
  } else {
    // Manuscript / progress from GitHub — network-first, fall back to last cache offline.
    e.respondWith(
      fetch(req)
        .then(res => {
          if (res && res.ok) { const clone = res.clone(); caches.open(CACHE).then(c => c.put(req, clone)); }
          return res;
        })
        .catch(() => caches.open(CACHE).then(c => c.match(req, { ignoreSearch: true })))
    );
  }
});
