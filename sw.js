const CACHE_NAME = 'wild-animal-cards-v7';

const CORE_ASSETS = [
  'landing.html',
  'index.html',
  'css/main.css',
  'css/cards.css',
  'css/animations.css',
  'css/landing.css',
  'js/data.js',
  'js/spaced-repetition.js',
  'js/audio.js',
  'js/cards.js',
  'js/game.js',
  'js/app.js',
  'js/landing.js',
  'data/animals.json',
  'data/dinosaurs.json'
];

// Install: pre-cache core assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(CORE_ASSETS);
    })
  );
});

// Fetch: cache-first for static assets, network-first for images
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Only handle same-origin requests
  if (url.origin !== location.origin) return;

  // For requests with query parameters (e.g. ?deck=dinosaurs),
  // use network-first so the query string is preserved
  if (url.search) {
    event.respondWith(
      fetch(event.request).catch(() => {
        // Strip query params for cache fallback to find index.html
        const cleanUrl = url.origin + url.pathname;
        return caches.match(cleanUrl);
      })
    );
    return;
  }

  const isImage = event.request.destination === 'image' ||
    /\.(png|jpg|jpeg|gif|svg|webp)$/i.test(url.pathname);

  if (isImage) {
    // Network-first for images
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, clone);
          });
          return response;
        })
        .catch(() => {
          return caches.match(event.request);
        })
    );
  } else {
    // Cache-first for static assets (HTML, CSS, JS, JSON)
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) {
          // Update cache in the background
          fetch(event.request).then((response) => {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, response);
            });
          }).catch(() => {});
          return cached;
        }
        return fetch(event.request).then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, clone);
          });
          return response;
        });
      })
    );
  }
});

// Activate: clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      );
    })
  );
});
