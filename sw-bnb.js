const CACHE = 'bailo-bnb-v1';
const ASSETS = ['/', '/index.html'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  // Network first pour les API Supabase et Netlify Functions
  if (e.request.url.includes('supabase.co') || e.request.url.includes('.netlify/functions')) {
    return;
  }
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request).then(r => r || caches.match('/index.html')))
  );
});
