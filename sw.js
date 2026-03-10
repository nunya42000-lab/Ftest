const CACHE_NAME = 'devos-gold-v1';

// 1. Local project files to cache
const LOCAL_ASSETS = [
    './',
    './index.html',
    './styles.css',
    './main.js',
    './explorer.js',
    './diff.js',
    './history.js',
    './search.js',
    './intelligence.js',
    './vault-compiler.js',
    './manifest.json'
];

// 2. External CDNs (CodeMirror, Linters, Formatters, Utilities)
const CDN_ASSETS = [
    'https://cdnjs.cloudflare.com/ajax/libs/jshint/2.13.6/jshint.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/htmlhint/1.1.4/htmlhint.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/csslint/1.0.5/csslint.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/js-beautify/1.14.9/beautify.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/js-beautify/1.14.9/beautify-html.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/js-beautify/1.14.9/beautify-css.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/localforage/1.10.0/localforage.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/diff_match_patch/20121119/diff_match_patch.js',
    'https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.13/codemirror.min.css',
    'https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.13/theme/dracula.min.css',
    'https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.13/addon/fold/foldgutter.min.css',
    'https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.13/addon/dialog/dialog.min.css',
    'https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.13/addon/merge/merge.min.css',
    'https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.13/codemirror.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.13/mode/javascript/javascript.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.13/mode/xml/xml.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.13/mode/css/css.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.13/mode/htmlmixed/htmlmixed.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.13/addon/edit/closebrackets.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.13/addon/edit/closetag.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.13/addon/fold/foldcode.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.13/addon/fold/foldgutter.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.13/addon/fold/brace-fold.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.13/addon/fold/xml-fold.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.13/addon/merge/merge.min.js'
];

const ALL_ASSETS = [...LOCAL_ASSETS, ...CDN_ASSETS];

// --- INSTALL EVENT: Pre-cache all assets ---
self.addEventListener('install', (event) => {
    console.log('[Service Worker] Installing Cache...');
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[Service Worker] Caching all local and external assets.');
            return cache.addAll(ALL_ASSETS);
        })
    );
    // Force the waiting service worker to become the active service worker
    self.skipWaiting();
});

// --- ACTIVATE EVENT: Clean up old caches ---
self.addEventListener('activate', (event) => {
    console.log('[Service Worker] Activating...');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('[Service Worker] Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    // Ensure the Service Worker takes control immediately
    self.clients.claim();
});

// --- FETCH EVENT: Intercept requests and serve from cache ---
self.addEventListener('fetch', (event) => {
    // Only intercept GET requests
    if (event.request.method !== 'GET') return;

    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            // 1. Return the cached version if we have it
            if (cachedResponse) {
                return cachedResponse;
            }

            // 2. Otherwise, fetch it from the network
            return fetch(event.request).then((networkResponse) => {
                // If the response is valid, dynamically cache it for the future
                if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic' && networkResponse.type !== 'cors') {
                    return networkResponse;
                }

                const responseToCache = networkResponse.clone();
                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, responseToCache);
                });

                return networkResponse;
            }).catch(() => {
                // 3. Fallback if offline and file is not cached
                console.warn('[Service Worker] Network request failed and no cache available for:', event.request.url);
            });
        })
    );
});
