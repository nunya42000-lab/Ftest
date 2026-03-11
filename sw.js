const CACHE_NAME = 'devos-gold-v2';

// 1. All local project files (Added missing modules to prevent boot errors)
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
    './mobile-ux.js',
    './visual-tools.js',
    './help-section.js',
    './git-lite.js',
    './preview-env.js',
    './manifest.json'
];

// 2. External CDNs (Ensuring all libraries in index.html are cached)
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
    'https://cdnjs.cloudflare.com/ajax/libs/terser/5.19.2/bundle.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/marked/4.3.0/marked.min.js'
];

const ASSETS_TO_CACHE = [...LOCAL_ASSETS, ...CDN_ASSETS];

// INSTALL: Pre-cache all essential files
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[SW] Pre-caching all IDE assets');
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
    self.skipWaiting();
});

// ACTIVATE: Clean up old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME) {
                        console.log('[SW] Clearing old cache:', cache);
                        return caches.delete(cache);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// FETCH: Cache-first, then network fallback
self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;

    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) return cachedResponse;

            return fetch(event.request).then((networkResponse) => {
                if (!networkResponse || networkResponse.status !== 200) {
                    return networkResponse;
                }

                const responseToCache = networkResponse.clone();
                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, responseToCache);
                });

                return networkResponse;
            }).catch(() => {
                console.warn('[SW] Offline and asset not in cache:', event.request.url);
            });
        })
    );
});
