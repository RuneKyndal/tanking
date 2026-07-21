// sw.js — Tanking App service worker
// No version number in this file, ever. Cache name is fixed and never needs
// bumping; freshness comes from the strategy below, not from a string.
const CACHE_NAME = 'tanking-runtime-cache';

const ASSETS = [
    './', './index.html', './manual.html', './manifest.json', './sw.js', './tank.png', './rickroll.mp4'
];

self.addEventListener('install', function(event) {
    event.waitUntil(
        caches.open(CACHE_NAME).then(function(cache) {
            return Promise.all(ASSETS.map(function(url) {
                // cache:'reload' forces this initial fetch past the HTTP cache too.
                return fetch(url, { cache: 'reload' })
                    .then(function(resp) { return cache.put(url, resp); })
                    .catch(function() {});
            }));
        }).then(function() { return self.skipWaiting(); })
    );
});

self.addEventListener('activate', function(event) {
    event.waitUntil(
        caches.keys().then(function(keys) {
            return Promise.all(
                keys.filter(function(k) { return k !== CACHE_NAME; })
                    .map(function(k) { return caches.delete(k); })
            );
        }).then(function() { return self.clients.claim(); })
    );
});

// Network-first, but with a timeout. Online and responsive -> always fresh.
// Online but slow/poor -> falls back to cache after NETWORK_TIMEOUT_MS rather
// than hanging (a hung fetch() never rejects on its own, so the old
// catch()-only fallback below never fired on a poor connection - only on a
// hard network error). Fully offline -> same, via the fetch's own rejection.
// The network request keeps running in the background either way, so the
// cache still gets refreshed the moment it does eventually answer.
const NETWORK_TIMEOUT_MS = 3000;

self.addEventListener('fetch', function(event) {
    if (event.request.method !== 'GET') return;

    event.respondWith(
        new Promise(function(resolve) {
            var networkDone = false;

            var networkPromise = fetch(event.request, { cache: 'no-store' })
                .then(function(response) {
                    networkDone = true;
                    if (response && response.status === 200) {
                        var clone = response.clone();
                        caches.open(CACHE_NAME).then(function(cache) { cache.put(event.request, clone); });
                    }
                    return response;
                })
                .catch(function() {
                    networkDone = true;
                    return null;
                });

            var timeoutId = setTimeout(function() {
                if (networkDone) return; // network already answered, nothing to do
                caches.match(event.request).then(function(cached) {
                    if (cached) { resolve(cached); return; }
                    // Nothing cached yet (e.g. very first load ever) - this is
                    // the only case left where we still have to wait it out.
                    networkPromise.then(function(resp) { resolve(resp || Response.error()); });
                });
            }, NETWORK_TIMEOUT_MS);

            networkPromise.then(function(response) {
                clearTimeout(timeoutId);
                if (response) { resolve(response); return; }
                caches.match(event.request).then(function(cached) { resolve(cached || Response.error()); });
            });
        })
    );
});

// Page-triggered nuclear option (Force Update button): wipe everything this
// worker owns, then let the page handle the reload.
self.addEventListener('message', function(event) {
    if (event.data && event.data.type === 'FORCE_UPDATE') {
        event.waitUntil(
            caches.keys()
                .then(function(keys) { return Promise.all(keys.map(function(k) { return caches.delete(k); })); })
                .then(function() { return self.skipWaiting(); })
                .then(function() {
                    return self.clients.matchAll().then(function(clients) {
                        clients.forEach(function(c) { c.postMessage({ type: 'FORCE_UPDATE_DONE' }); });
                    });
                })
        );
    }
});
