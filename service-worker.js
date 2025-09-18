const CACHE_NAME = 'reptile-log-cache-v1';
const urlsToCache = [
  './',
  './index.html',
  'https://cdn.tailwindcss.com',
  'https://cdn.jsdelivr.net/npm/chart.js',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Noto+Sans+TC:wght@400;500;700&display=swap'
];

// 安裝 Service Worker 並快取靜態資源
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

// 攔截網路請求
self.addEventListener('fetch', event => {
  const requestUrl = new URL(event.request.url);

  // 對於 Google Apps Script 的 API 請求，總是從網路獲取
  if (requestUrl.hostname === 'script.google.com') {
    event.respondWith(fetch(event.request));
    return;
  }

  // 對於其他請求，採用「快取優先」策略
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // 如果快取中有對應的回應，就直接回傳
        if (response) {
          return response;
        }
        // 否則，從網路獲取
        return fetch(event.request);
      })
  );
});

