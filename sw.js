const CACHE_NAME = 'adventure-log-v2'; // Bumped version to force cache refresh
const ASSETS = [
  './',
  './index.html',
  './app.js',
  './planner.js',
  './journal.js',
  './calendar.js',
  './manifest.json'
];

// Install stage: Lock primary assets into local system cache
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Using cache.addAll on reliable internal files first
      return cache.addAll(ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activation stage: Flush older legacy caches safely
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch stage: Network-first fallback to local disk strategy
self.addEventListener('fetch', (e) => {
  // Pass non-GET requests (like data syncing pushes) straight to the web
  if (e.request.method !== 'GET') return;

  e.respondWith(
    fetch(e.request)
      .then((response) => {
        // If network works perfectly, duplicate the file into our offline cache dynamically
        if (response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(e.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // If offline completely, check our local phone storage disk
        return caches.match(e.request).then((cachedResponse) => {
          if (cachedResponse) return cachedResponse;
          
          // Fallback if user is looking at an un-cached external media route
          return new Response("Offline resource unavailable.", { 
            status: 503, 
            headers: { 'Content-Type': 'text/plain' } 
          });
        });
      })
  );
});
