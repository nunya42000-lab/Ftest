/*
  A service worker for full offline caching.
  Uses a "Cache, falling back to Network, then update cache" strategy.
*/

const CACHE_NAME = 'follow-me-cache-v1';

// These are the core files for the app shell.
// They will be pre-cached on install.
const APP_SHELL_URLS = [
    '.', // Alias for index.html
    'index.html',
    'app.js',
    'style.css',
    'manifest.json'
    // '1000021086.jpg' has been removed as it's no longer needed
];

// --- Install Event ---
// Pre-caches the app shell.
self.addEventListener('install', (event) => {
    console.log('[Service Worker] Install');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[Service Worker] Caching App Shell');
                // We use addAll which fetches and caches.
                // We add a catch block to log if any single resource fails.
                return cache.addAll(APP_SHELL_URLS).catch(error => {
                    console.error('[Service Worker] Failed to cache app shell resource:', error);
                });
            })
            .then(() => {
                // Force the new service worker to activate immediately
                return self.skipWaiting();
            })
    );
});

// --- Activate Event ---
// Cleans up old caches.
self.addEventListener('activate', (event) => {
    console.log('[Service Worker] Activate');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    // If this cache's name isn't the current one, delete it.
                    if (cacheName !== CACHE_NAME) {
                        console.log('[Service Worker] Clearing old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            // Tell the active service worker to take control of the page immediately
            return self.clients.claim();
        })
    );
});

// --- Fetch Event ---
// Implements a "Cache, falling back to Network" strategy.
// For assets not pre-cached (like fonts), it will fetch, cache, and serve.
self.addEventListener('fetch', (event) => {
    // We only want to cache GET requests.
    if (event.request.method !== 'GET') {
        // For non-GET requests, just do the network request
        event.respondWith(fetch(event.request));
        return;
    }

    event.respondWith(
        caches.match(event.Request)
            .then((cachedResponse) => {
                // 1. Try to get from Cache
                if (cachedResponse) {
                    // console.log('[Service Worker] Serving from Cache:', event.request.url);
                    return cachedResponse;
                }

                // 2. If not in Cache, try to fetch from Network
                // console.log('[Service Worker] Fetching from Network:', event.request.url);
                return fetch(event.request)
                    .then((networkResponse) => {
                        
                        // Check if we received a valid response
                        if (!networkResponse || !networkResponse.ok) {
                            // Don't cache bad responses (e.g., 404s, 500s)
                            // Also don't cache chrome-extension:// requests
                            if (!networkResponse.ok && !event.request.url.startsWith('chrome-extension://')) {
                                console.warn('[Service Worker] Network request failed:', event.request.url, networkResponse.status);
                            }
                            return networkResponse;
                        }

                        // 3. If Network fetch succeeds, cache the response and return it
                        // We need to clone the response because it's a stream
                        // that can only be consumed once.
                        const responseToCache = networkResponse.clone();

                        caches.open(CACHE_NAME)
                            .then((cache) => {
                                // console.log('[Service Worker] Caching new resource:', event.request.url);
                                // Only cache http/https protocols
                                if (event.request.url.startsWith('http')) {
                                    cache.put(event.request, responseToCache);
                                }
                            });

                        return networkResponse;
                    })
                    .catch((error) => {
                        // 4. If Network fetch fails (offline) and it wasn't in cache...
                        console.error('[Service Worker] Fetch failed, and not in cache:', error);
                        // We could return a generic offline page here if we had one.
                        // For now, just let the request fail.
                    });
            })
    );
});
