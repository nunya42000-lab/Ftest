/* DevOS Service Worker - Modular Build v1.1.0 */

const CACHE_NAME = 'devos-v2'; // Incremented version to force update
const urlsToCache = [
  './',
  './index.html',
  './main.js',
  './manifest.json',
  'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jshint/2.13.6/jshint.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/localforage/1.10.0/localforage.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.13/codemirror.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.13/theme/dracula.min.css'
];

// Install: Cache core application shell
self.addEventListener('install', event => {
  self.skipWaiting(); // Force active immediately
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('DevOS: Caching Shell');
      return cache.addAll(urlsToCache);
    })
  );
});

// Activate: Cleanup old caches to prevent storage bloat
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(keys.map(key => {
        if (key !== CACHE_NAME) return caches.delete(key);
      }));
    })
  );
});

// Fetch: Network-First Strategy
// We try the network first so you always get your latest code changes.
// If offline (or the network fails), we fall back to the cache.
self.addEventListener('fetch', event => {
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});
