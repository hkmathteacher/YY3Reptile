const CACHE_NAME = 'reptile-log-cache-v1';
// 使用相對路徑，確保在子目錄部署時也能正常運作
const urlsToCache = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  'https://cdn.jsdelivr.net/npm/fullcalendar@6.1.13/index.global.min.js'
];

// 安裝 Service Worker 時，快取核心檔案
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

// 攔截網路請求，優先從快取中讀取
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // 如果快取中有，直接回傳快取版本
        if (response) {
          return response;
        }
        // 如果快取中沒有，則發出網路請求
        return fetch(event.request);
      }
    )
  );
});

// 當新的 Service Worker 啟動時，刪除舊的快取
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
