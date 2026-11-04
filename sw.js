// MyFitness 서비스 워커: 앱 파일은 네트워크 우선(최신 반영) + 오프라인 폴백, CDN 자원(3D 라이브러리/모델/폰트)은 캐시 우선
const SHELL_CACHE = 'mf-shell-v1';
const CDN_CACHE = 'mf-cdn-v1';                       // 버전이 고정된 CDN URL만 쓰므로 영구 캐시
const SHELL = ['./', 'index.html', 'style.css', 'app.js', 'body3d.js', 'manifest.webmanifest',
  'favicon.svg', 'favicon.ico', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL_CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== SHELL_CACHE && k !== CDN_CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

const timeout = ms => new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms));

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.origin === location.origin) {               // 네트워크 우선 (느리거나 오프라인이면 캐시)
    e.respondWith(
      Promise.race([fetch(req, { cache: 'no-cache' }), timeout(4000)])
        .then(res => { if (res.ok) { const cp = res.clone(); caches.open(SHELL_CACHE).then(c => c.put(req, cp)); } return res; })
        .catch(() => caches.match(req, { ignoreSearch: true }).then(hit => hit || (req.mode === 'navigate' ? caches.match('index.html') : Response.error())))
    );
  } else if (url.hostname === 'cdn.jsdelivr.net') {   // 캐시 우선
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok || res.type === 'opaque') { const cp = res.clone(); caches.open(CDN_CACHE).then(c => c.put(req, cp)); }
      return res;
    })));
  }
});
