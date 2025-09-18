const CACHE_NAME = 'reptile-log-cache-v2'; // 更改快取名稱以觸發更新
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

// 攔截網路請求，並根據請求類型採用不同策略
self.addEventListener('fetch', event => {
  const requestUrl = new URL(event.request.url);

  // **新增的邏輯：**
  // 如果請求是發往 Google Apps Script API 的，則繞過快取，直接從網路請求。
  if (requestUrl.hostname === 'script.google.com') {
    event.respondWith(fetch(event.request));
    return;
  }

  // 對於所有其他本地資源，繼續使用「快取優先」策略
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // 如果快取中有，直接回傳快取版本
        if (response) {
          return response;
        }
        // 如果快取中沒有，則發出網路請求
        return fetch(event.request);
      })
  );
});

// 當新的 Service Worker 啟動時，刪除舊的快取
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME]; // 只保留新版本的快取
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

