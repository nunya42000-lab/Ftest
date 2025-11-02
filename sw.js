/* A minimal service worker to enable PWA installability.
   It doesn't cache anything, just passes requests through.
*/
self.addEventListener('fetch', (event) => {
    // Pass-through fetch
    event.respondWith(fetch(event.request));
});
