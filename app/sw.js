// オフライン対応：アプリ本体と絵を端末に保存して、電波がなくても開けるようにする
// 版を上げるときは VERSION を変える（古い保存は消える）
const VERSION = 'tabiquest-v0.3.3';
const CORE = [
  './', 'index.html', 'manifest.json', 'css/app.css', 'vendor/three.r128.min.js',
  'js/main.js', 'js/card.js', 'js/places.js', 'js/photo_places.js', 'js/store.js', 'js/geo.js', 'js/conditions.js', 'js/ui.js', 'js/arrival.js', 'js/zukan.js', 'js/debug.js',
  'js/map.js', 'js/goals.js', 'assets/map/map_jp.png', 'assets/map/map_jp.json',
  'js/scenes/minatomirai.js', 'js/scenes/chukagai.js', 'js/scenes/photo.js',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-180.png',
  'assets/minatomirai/data.json', 'assets/minatomirai/sky_evening.png', 'assets/minatomirai/sky_night.png', 'assets/minatomirai/city_evening.png', 'assets/minatomirai/city_night.png', 'assets/minatomirai/fg.png', 'assets/minatomirai/chara.png',
  'assets/chukagai/data.json', 'assets/chukagai/sky_evening.png', 'assets/chukagai/sky_night.png', 'assets/chukagai/scene_night.png', 'assets/chukagai/chara.png',
  'assets/photos/kanagawa-032.jpg', 'assets/photos/kanagawa-033.jpg', 'assets/photos/kanagawa-035.jpg', 'assets/photos/kanagawa-040.jpg',
  'assets/photos/kanagawa-043.jpg', 'assets/photos/kanagawa-044.jpg', 'assets/photos/kanagawa-045.jpg', 'assets/photos/kanagawa-046.jpg',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(CORE.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('tabiquest-') && k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  // 天気はいつもネットから（保存しない）
  if (u.hostname.endsWith('open-meteo.com')) return;
  // 文字（Google Fonts）：一度読んだものを保存して使う
  if (u.hostname === 'fonts.googleapis.com' || u.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.open(VERSION + '-fonts').then(async c => {
      const hit = await c.match(e.request); if (hit) return hit;
      try { const r = await fetch(e.request); if (r.ok || r.type === 'opaque') c.put(e.request, r.clone()); return r; } catch (err) { return hit || Response.error(); }
    }));
    return;
  }
  if (u.origin !== location.origin) return;
  // アプリ本体と絵：保存したものをすぐ返し、裏でネットから新しくする
  e.respondWith(caches.open(VERSION).then(async c => {
    const hit = await c.match(e.request, { ignoreSearch: true });
    const net = fetch(e.request, { cache: 'no-cache' }).then(r => { if (r.ok) c.put(e.request, r.clone()); return r; }).catch(() => null);
    if (hit) { e.waitUntil(net); return hit; }
    const r = await net; if (r) return r;
    if (e.request.mode === 'navigate') return (await c.match('index.html')) || Response.error();
    return Response.error();
  }));
});
