// オフライン対応：アプリ本体と絵を端末に保存して、電波がなくても開けるようにする
// 版を上げるときは VERSION を変える（古い保存は消える）
const VERSION = 'tabiquest-v0.9.11';
const CORE = [
  './', 'index.html', 'manifest.json', 'css/app.css', 'vendor/three.r128.min.js',
  'js/main.js', 'js/card.js', 'js/places.js', 'js/photo_places.js', 'js/plain_places.js', 'js/store.js', 'js/geo.js', 'js/conditions.js', 'js/ui.js', 'js/arrival.js', 'js/zukan.js', 'js/debug.js',
  'js/map.js', 'js/goals.js', 'js/calendar.js', 'js/home.js', 'js/room_voxel.js', 'js/characolor.js',
  'assets/map/dot/levels.json', 'assets/map/dot/jp8.png', 'assets/map/dot/jp2.png', 'assets/map/dot/jp1.png', 'assets/map/dot/kt1000.png', 'assets/map/dot/kt250.png', 'assets/map/dot/kt100.png', 'assets/map/dot/kt50.png', 'assets/map/dot/near0.png', 'assets/map/dot/near1.png', 'assets/map/dot/near2.png',
  'js/scenes/minatomirai.js', 'js/scenes/chukagai.js', 'js/scenes/kamakura.js', 'js/scenes/photo.js', 'js/scenes/look.js', 'js/scenes/dotscene.js',
  'assets/minatomirai/boat.png', 'assets/minatomirai/chara.png', 'assets/minatomirai/data.json', 'assets/minatomirai/front.png', 'assets/minatomirai/front_night.png', 'assets/minatomirai/front_snow.png', 'assets/minatomirai/gulls.png', 'assets/minatomirai/scene.png', 'assets/minatomirai/scene_night.png', 'assets/minatomirai/scene_snow.png', 'assets/minatomirai/sky.png', 'assets/minatomirai/sky_evening.png', 'assets/minatomirai/sky_morning.png', 'assets/minatomirai/sky_night.png', 'assets/minatomirai/sky_overcast.png', 'assets/minatomirai/sky_winter.png',
  'assets/chukagai/chara.png', 'assets/chukagai/data.json', 'assets/chukagai/front.png', 'assets/chukagai/front_night.png', 'assets/chukagai/front_snow.png', 'assets/chukagai/scene.png', 'assets/chukagai/scene_night.png', 'assets/chukagai/scene_snow.png', 'assets/chukagai/sky.png', 'assets/chukagai/sky_evening.png', 'assets/chukagai/sky_morning.png', 'assets/chukagai/sky_night.png', 'assets/chukagai/sky_overcast.png', 'assets/chukagai/sky_winter.png',
  'assets/kamakura/data.json', 'assets/kamakura/sky.png', 'assets/kamakura/scene.png', 'assets/kamakura/chara.png', 'assets/kamakura/chara_close.png', 'assets/minatomirai/chara_close.png', 'assets/chukagai/chara_close.png', 'assets/kamakura/front.png', 'assets/kamakura/train.png', 'assets/kamakura/gulls.png', 'assets/kamakura/scene_snow.png', 'assets/kamakura/front_snow.png',
  'assets/kamakura/sky_morning.png', 'assets/kamakura/sky_evening.png', 'assets/kamakura/sky_night.png', 'assets/kamakura/sky_overcast.png', 'assets/kamakura/sky_winter.png',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-180.png',
  'assets/photos/kanagawa-032.jpg', 'assets/photos/kanagawa-033.jpg', 'assets/photos/kanagawa-035.jpg', 'assets/photos/kanagawa-040.jpg',
  'assets/photos/kanagawa-043.jpg', 'assets/photos/kanagawa-044.jpg', 'assets/photos/kanagawa-045.jpg', 'assets/photos/kanagawa-046.jpg',
  'assets/photos/tokyo-001.jpg', 'assets/photos/tokyo-002.jpg', 'assets/photos/tokyo-003.jpg', 'assets/photos/tokyo-004.jpg',
  'assets/photos/tokyo-008.jpg', 'assets/photos/tokyo-009.jpg', 'assets/photos/kanagawa-061.jpg', 'assets/photos/kanagawa-063.jpg', 'assets/photos/plain.png',
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
