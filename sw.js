const CACHE = 'thegame-v2';
const CORE = [
  './',
  './index.html',
  './css/theGame.min.css',
  './css/theGame.css',
  './js/theGame.js',
  './img/SpriteShoes.png',
  './img/icon-192.png',
  './img/icon-512.png',
  './manifest.webmanifest'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (url.origin === location.origin) {
    e.respondWith(
      caches.match(e.request)
        .then((cachedResponse) => {
          // Return the cached response if available
          if (cachedResponse) {
            return cachedResponse;
          }
          
          // Otherwise fetch from network
          return fetch(e.request)
            .then((response) => {
              // Check if we received a valid response
              if (!response || response.status !== 200 || response.type !== 'basic') {
                return response;
              }
              
              // Clone the response so we can put one copy in cache and return the other
              const responseToCache = response.clone();
              
              caches.open(CACHE)
                .then((cache) => {
                  cache.put(e.request, responseToCache);
                });
                
              return response;
            });
        })
    );
  }
});
