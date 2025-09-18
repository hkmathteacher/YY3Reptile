const CACHE_NAME = 'reptile-log-cache-v2'; // 增加版本號以觸發更新
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
        
        // 建立一個請求陣列，對跨域請求使用 'no-cors' 模式
        const requests = urlsToCache.map(url => {
          if (url.startsWith('http')) {
            // 對於所有 CDN 或外部連結，建立一個 no-cors 請求
            return new Request(url, { mode: 'no-cors' });
          }
          // 對於本地資源，正常請求即可
          return url;
        });

        // 使用 addAll 搭配我們建立的請求陣列
        return cache.addAll(requests);
      })
      .catch(error => {
          // 增加更詳細的錯誤日誌，方便未來除錯
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
          // 刪除所有不等於目前 CACHE_NAME 的快取
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

