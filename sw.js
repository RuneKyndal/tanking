// sw.js — Bell 214ST W&B v1.0
const CACHE_NAME = 'wb214st-v1.2';

const ASSETS = [
    './index.html',
    './manifest.json',
    './sw.js',
    './icon.png'
];

// Install: pre-cache all assets
self.addEventListener('install', function(event) {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(function(cache) {
                console.log('[SW] Pre-caching assets');
                return cache.addAll(ASSETS);
            })
            .then(function() {
                return self.skipWaiting();
            })
    );
});

// Activate: delete old caches
self.addEventListener('activate', function(event) {
    event.waitUntil(
        caches.keys().then(function(keys) {
            return Promise.all(
                keys
                    .filter(function(key) { return key !== CACHE_NAME; })
                    .map(function(key) {
                        console.log('[SW] Removing old cache:', key);
                        return caches.delete(key);
                    })
            );
        }).then(function() {
            return self.clients.claim();
        })
    );
});

// Fetch: network-first, cache fallback
// Online  → fresh from GitHub, cache updated automatically
// Offline → falls back to cache, works 100% offline
self.addEventListener('fetch', function(event) {
    if (event.request.method !== 'GET') return;

    event.respondWith(
        fetch(event.request)
            .then(function(response) {
                if (response && response.status === 200) {
                    var clone = response.clone();
                    caches.open(CACHE_NAME).then(function(cache) {
                        cache.put(event.request, clone);
                    });
                }
                return response;
            })
            .catch(function() {
                return caches.match(event.request).then(function(cached) {
                    if (cached) return cached;
                    console.warn('[SW] Offline and not cached:', event.request.url);
                });
            })
    );
});
