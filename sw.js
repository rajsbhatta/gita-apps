// Service Worker - Offline Support
const CACHE_NAME = 'gita-v1';
const RUNTIME_CACHE = 'gita-runtime';

// Files to cache immediately
const PRECACHE_URLS = [
    '/',
    '/index.html',
    '/styles.css',
    '/app.js',
    '/manifest.json',
    '/data/chapters.json'
];

// Install event - cache essential files
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(PRECACHE_URLS))
            .then(() => self.skipWaiting())
    );
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames
                    .filter(cacheName => cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE)
                    .map(cacheName => caches.delete(cacheName))
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
    // Skip non-GET requests
    if (event.request.method !== 'GET') return;

    event.respondWith(
        caches.match(event.request).then(cachedResponse => {
            if (cachedResponse) {
                return cachedResponse;
            }

            return caches.open(RUNTIME_CACHE).then(cache => {
                return fetch(event.request).then(response => {
                    // Cache chapter data for offline use
                    if (event.request.url.includes('/data/chapters/')) {
                        cache.put(event.request, response.clone());
                    }
                    return response;
                }).catch(() => {
                    // Return offline page if available
                    return caches.match('/index.html');
                });
            });
        })
    );
});

// Background sync for future features
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-bookmarks') {
        event.waitUntil(syncBookmarks());
    }
});

async function syncBookmarks() {
    // Placeholder for future sync functionality
    console.log('Syncing bookmarks...');
}

// Push notifications (for daily shloka)
self.addEventListener('push', (event) => {
    const data = event.data ? event.data.json() : {};
    const options = {
        body: data.body || 'Your daily verse is ready',
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        data: data.url
    };

    event.waitUntil(
        self.registration.showNotification(data.title || 'Bhagavad Gita', options)
    );
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        clients.openWindow(event.notification.data || '/')
    );
});
