const CACHE_NAME = 'reptile-log-cache-v3'; // 再次增加版本號
const urlsToCache = [
  './',
  './index.html',
  'https://cdn.tailwindcss.com',
  'https://cdn.jsdelivr.net/npm/chart.js',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Noto+Sans+TC:wght@400;500;700&display=swap'
];

// 安裝 Service Worker
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache, caching individual resources...');
        // 逐一快取資源，而不是使用 all-or-nothing 的 addAll
        const promises = urlsToCache.map(url => {
          // 對於跨域請求，我們必須使用 no-cors 模式
          const request = new Request(url, { mode: 'no-cors' });
          return fetch(request).then(response => cache.put(request, response));
        });
        return Promise.all(promises);
      })
      .catch(error => {
        console.error('Failed to cache resources during install phase:', error);
      })
  );
});

// 啟用新的 Service Worker 後，刪除舊的快取
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(cacheName => {
          return cacheName !== CACHE_NAME;
        }).map(cacheName => {
          return caches.delete(cacheName);
        })
      );
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

