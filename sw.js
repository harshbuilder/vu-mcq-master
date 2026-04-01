// ============================================
// VU MCQ Master — Service Worker v2.0
// Offline support + Smart caching
// ============================================

const CACHE_NAME = 'vu-mcq-master-v2';  // ✅ Bumped to v2 — forces cache refresh
const STATIC_CACHE = 'vu-static-v2';
const DYNAMIC_CACHE = 'vu-dynamic-v2';

// Files to cache immediately on install
const STATIC_ASSETS = [
  '/vu-mcq-master/',
  '/vu-mcq-master/index.html',
  'https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;600;700&family=Nunito:wght@400;600;700;800&display=swap',
];

// ===== INSTALL — Cache static assets =====
self.addEventListener('install', event => {
  console.log('[SW] Installing VU MCQ Master Service Worker v2...');
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache => {
      console.log('[SW] Caching static assets');
      return cache.addAll(STATIC_ASSETS).catch(err => {
        console.warn('[SW] Some assets failed to cache:', err);
      });
    })
  );
  self.skipWaiting(); // ✅ Activate immediately
});

// ===== ACTIVATE — Clean ALL old caches =====
self.addEventListener('activate', event => {
  console.log('[SW] Activating VU MCQ Master Service Worker v2...');
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys
          .filter(key => key !== STATIC_CACHE && key !== DYNAMIC_CACHE)
          .map(key => {
            console.log('[SW] Deleting old cache:', key);
            return caches.delete(key);
          })
      );
    })
  );
  self.clients.claim(); // ✅ Take control immediately
});

// ===== FETCH — Smart cache strategy =====
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests and chrome-extension
  if (request.method !== 'GET') return;
  if (url.protocol === 'chrome-extension:') return;

  // Firebase / Razorpay — Network only (always fresh)
  if (
    url.hostname.includes('firebase') ||
    url.hostname.includes('firestore') ||
    url.hostname.includes('razorpay') ||
    (url.hostname.includes('googleapis.com') && url.pathname.includes('firestore'))
  ) {
    event.respondWith(fetch(request));
    return;
  }

  // Google Fonts — Cache first
  if (url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com')) {
    event.respondWith(
      caches.match(request).then(cached => {
        return cached || fetch(request).then(response => {
          const clone = response.clone();
          caches.open(STATIC_CACHE).then(cache => cache.put(request, clone));
          return response;
        });
      })
    );
    return;
  }

  // Main app (index.html) — Network first, fallback to cache
  if (url.pathname.includes('/vu-mcq-master') || url.pathname === '/') {
    event.respondWith(
      fetch(request)
        .then(response => {
          // Update cache with fresh version
          const clone = response.clone();
          caches.open(STATIC_CACHE).then(cache => cache.put(request, clone));
          return response;
        })
        .catch(() => {
          // Offline: serve from cache
          return caches.match(request).then(cached => {
            if (cached) return cached;
            return caches.match('/vu-mcq-master/index.html');
          });
        })
    );
    return;
  }

  // Everything else — Cache first, then network
  event.respondWith(
    caches.match(request).then(cached => {
      return cached || fetch(request).then(response => {
        if (response.status === 200) {
          const clone = response.clone();
          caches.open(DYNAMIC_CACHE).then(cache => {
            cache.put(request, clone);
          });
        }
        return response;
      }).catch(() => {
        return caches.match(request);
      });
    })
  );
});

// ===== BACKGROUND SYNC (future use) =====
self.addEventListener('sync', event => {
  console.log('[SW] Background sync:', event.tag);
});

// ===== PUSH NOTIFICATIONS (future use) =====
self.addEventListener('push', event => {
  if (!event.data) return;
  const data = event.data.json();
  self.registration.showNotification(data.title || 'VU MCQ Master', {
    body: data.body || 'New content available!',
    icon: '/vu-mcq-master/icons/icon-192.png',
    badge: '/vu-mcq-master/icons/icon-72.png',
    vibrate: [200, 100, 200],
    data: { url: data.url || '/vu-mcq-master/' }
  });
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data.url)
  );
});

console.log('[SW] VU MCQ Master Service Worker v2 loaded ✅');
