/* =====================================================
   Brochure Stock Management — Service Worker
   v5: app-shell + runtime cache for CDN libraries
   (Firebase SDK, Chart.js, ExcelJS, Font Awesome, Fonts)
   so the app actually works after being opened once,
   even with no internet connection.
===================================================== */

const SHELL_CACHE   = 'brochure-stock-shell-v5';
const RUNTIME_CACHE = 'brochure-stock-runtime-v5';

// ឯកសារសំខាន់ៗរបស់ app ដែលត្រូវតែមាន — បើខកខាន install ត្រូវ fail
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/css/styles.css',
  '/js/app.js',
  '/js/i18n.js',
  '/manifest.json'
];

// ធនធានបន្ថែម (icons ។ល។) — ល្អបើមាន ប៉ុន្តែមិនត្រូវធ្វើឲ្យ install fail
// ទាំងមូល ប្រសិនបើឯកសារណាមួយរកមិនឃើញ (404)
const OPTIONAL_ASSETS = [
  'assets/icon_stock.png',
  'assets/icon-192.png',
  'assets/icon-512.png'
];

// Host របស់ library ខាងក្រៅ (CDN) ដែលត្រូវ cache នៅ runtime
// ដើម្បីឲ្យ Chart.js / ExcelJS / Firebase / Font Awesome / Fonts
// នៅតែដំណើរការបានពេលគ្មាន internet (បន្ទាប់ពីបានបើក app លើកមុនរួច)
const RUNTIME_CACHE_HOSTS = [
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'cdnjs.cloudflare.com',
  'cdn.jsdelivr.net'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);

      // ១. Core assets — ត្រូវតែជោគជ័យទាំងអស់
      await cache.addAll(CORE_ASSETS);

      // ២. Optional assets — cache ម្តងមួយៗ កុំឲ្យ 1 ការបរាជ័យធ្វើឲ្យ
      //    ដំណើរការ install ទាំងមូល fail
      await Promise.allSettled(
        OPTIONAL_ASSETS.map(url => cache.add(url).catch(err => {
          console.warn('SW: optional asset not cached:', url, err);
        }))
      );
    })()
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter(k => k !== SHELL_CACHE && k !== RUNTIME_CACHE)
          .map(k => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

function isRuntimeCdnRequest(url){
  return RUNTIME_CACHE_HOSTS.some(host => url.hostname === host);
}

self.addEventListener('fetch', event => {
  const { request } = event;
  if(request.method !== 'GET') return; // កុំ cache POST ទៅ Firestore/Cloudinary

  const url = new URL(request.url);

  // === CDN libraries (Chart.js, ExcelJS, Firebase SDK, Font Awesome, Fonts) ===
  // Cache-first: ប្រើ cache ភ្លាមៗបើមាន (លឿន + ដំណើរការ offline បាន),
  // ហើយ update cache ក្នុងផ្ទៃខាងក្រោយពេលមាន network (stale-while-revalidate)
  if(isRuntimeCdnRequest(url)){
    event.respondWith(
      (async () => {
        const cache = await caches.open(RUNTIME_CACHE);
        const cached = await cache.match(request);

        const networkFetch = fetch(request).then(response => {
          if(response && response.ok){
            cache.put(request, response.clone());
          }
          return response;
        }).catch(() => null);

        return cached || (await networkFetch) || new Response('', { status: 504 });
      })()
    );
    return;
  }

  // === App shell (HTML/CSS/JS ផ្ទាល់ខ្លួន) ===
  // Network-first: ពេលមាន internet ទទួលបានកំណែថ្មីជានិច្ច,
  // ធ្លាក់ចុះទៅ cache វិញពេលគ្មាន internet
  if(url.origin === self.location.origin){
    event.respondWith(
      (async () => {
        try{
          const response = await fetch(request);
          if(response && response.ok){
            const cache = await caches.open(SHELL_CACHE);
            cache.put(request, response.clone());
          }
          return response;
        }catch(err){
          const cached = await caches.match(request);
          return cached || caches.match('/index.html');
        }
      })()
    );
    return;
  }

  // === ធនធានផ្សេងទៀត (Cloudinary images, Firestore) — កុំ intercept ===
  // ទុកឲ្យ browser ដោះស្រាយផ្ទាល់
});