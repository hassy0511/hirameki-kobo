const CACHE_PREFIX = 'hirameki-kobo-';
const CACHE_NAME = 'hirameki-kobo-v9';
const APP_FILES = [
  './',
  './index.html',
  './styles.css?v=9',
  './game-core.js?v=9',
  './grade2-curriculum.js?v=9',
  './grade2-runtime-arithmetic.js?v=9',
  './grade2-runtime-world.js?v=9',
  './course-core.js?v=9',
  './story-core.js?v=9',
  './audio-core.js?v=9',
  './app.js?v=9',
  './assets/workshop-hero-v1.jpg',
  './assets/story-guides-v1.jpg',
  './assets/measure-methods-v1.jpg',
  './assets/workshop-objects-v1.jpg',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_FILES)));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).then(response => {
      const copy=response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(event.request,copy));
      return response;
    }).catch(async () => (await caches.match(event.request)) || caches.match('./index.html')));
    return;
  }
  event.respondWith(caches.match(event.request).then(cached => {
    const fresh=fetch(event.request).then(response => {
      if (response?.ok) caches.open(CACHE_NAME).then(cache => cache.put(event.request,response.clone()));
      return response;
    }).catch(()=>cached);
    return cached || fresh;
  }));
});
