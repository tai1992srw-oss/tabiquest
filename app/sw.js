// オフライン対応：アプリ本体と絵を端末に保存して、電波がなくても開けるようにする
// 版を上げるときは VERSION を変える（古い保存は消える）
const VERSION = 'tabiquest-v0.10.60';
const CORE = [
  './', 'index.html', 'manifest.json', 'css/app.css', 'vendor/three.r128.min.js',
  'js/main.js', 'js/card.js', 'js/places.js', 'js/photo_places.js', 'js/plain_places.js', 'js/store.js', 'js/geo.js', 'js/conditions.js', 'js/ui.js', 'js/arrival.js', 'js/zukan.js', 'js/debug.js',
  'js/map.js', 'js/goals.js', 'js/calendar.js', 'js/home.js', 'js/serifu.js', 'serifu/futsuu.json', 'js/characolor.js', 'js/charaparts.js', 'js/dress.js', 'js/camthumb.js', 'assets/chara/parts.json', 'assets/chara/body_close.png', 'assets/chara/body_normal.png', 'assets/chara/arms_close.png', 'assets/chara/arms_normal.png', 'assets/chara/hair_close.png', 'assets/chara/hair_normal.png', 'assets/chara/face_close.png', 'assets/chara/face_normal.png', 'assets/chara/zone_close.png', 'assets/chara/zone_normal.png',
  'assets/map/dot/levels.json', 'assets/map/dot/jp8.png', 'assets/map/dot/jp2.png', 'assets/map/dot/jp1.png', 'assets/map/dot/kt1000.png', 'assets/map/dot/kt250.png', 'assets/map/dot/kt100.png', 'assets/map/dot/kt50.png', 'assets/map/dot/near0.png', 'assets/map/dot/near1.png', 'assets/map/dot/near2.png',
  'js/scenes/minatomirai.js', 'js/scenes/chukagai.js', 'js/scenes/kamakura.js', 'js/scenes/photo.js', 'js/scenes/look.js', 'js/scenes/dotscene.js',
  'assets/minatomirai/boat.png', 'assets/minatomirai/chara.png', 'assets/minatomirai/data.json', 'assets/minatomirai/front.png', 'assets/minatomirai/front_night.png', 'assets/minatomirai/front_snow.png', 'assets/minatomirai/gulls.png', 'assets/minatomirai/scene.png', 'assets/minatomirai/scene_night.png', 'assets/minatomirai/scene_snow.png', 'assets/minatomirai/sky.png', 'assets/minatomirai/sky_evening.png', 'assets/minatomirai/sky_morning.png', 'assets/minatomirai/sky_night.png', 'assets/minatomirai/sky_overcast.png', 'assets/minatomirai/sky_winter.png',
  'assets/chukagai/chara.png', 'assets/chukagai/data.json', 'assets/chukagai/front.png', 'assets/chukagai/front_night.png', 'assets/chukagai/front_snow.png', 'assets/chukagai/scene.png', 'assets/chukagai/scene_night.png', 'assets/chukagai/scene_snow.png', 'assets/chukagai/sky.png', 'assets/chukagai/sky_evening.png', 'assets/chukagai/sky_morning.png', 'assets/chukagai/sky_night.png', 'assets/chukagai/sky_overcast.png', 'assets/chukagai/sky_winter.png',
  'js/scenes/tokyotower.js', 'assets/tokyotower/chara.png', 'assets/tokyotower/chara_close.png', 'assets/tokyotower/data.json', 'assets/tokyotower/gulls.png', 'assets/tokyotower/front.png', 'assets/tokyotower/front_night.png', 'assets/tokyotower/front_snow.png', 'assets/tokyotower/scene.png', 'assets/tokyotower/scene_night.png', 'assets/tokyotower/scene_snow.png', 'assets/tokyotower/sky.png', 'assets/tokyotower/sky_evening.png', 'assets/tokyotower/sky_morning.png', 'assets/tokyotower/sky_night.png', 'assets/tokyotower/sky_overcast.png', 'assets/tokyotower/sky_winter.png',
  'js/scenes/mitsumine.js', 'assets/mitsumine/chara.png', 'assets/mitsumine/chara_close.png', 'assets/mitsumine/data.json', 'assets/mitsumine/front.png', 'assets/mitsumine/front_night.png', 'assets/mitsumine/front_snow.png', 'assets/mitsumine/scene.png', 'assets/mitsumine/scene_night.png', 'assets/mitsumine/scene_snow.png', 'assets/mitsumine/sky.png', 'assets/mitsumine/sky_evening.png', 'assets/mitsumine/sky_morning.png', 'assets/mitsumine/sky_night.png', 'assets/mitsumine/sky_overcast.png', 'assets/mitsumine/sky_winter.png',
  'js/scenes/chichibu.js', 'assets/chichibu/chara.png', 'assets/chichibu/chara_close.png', 'assets/chichibu/data.json', 'assets/chichibu/front.png', 'assets/chichibu/front_night.png', 'assets/chichibu/front_snow.png', 'assets/chichibu/scene.png', 'assets/chichibu/scene_night.png', 'assets/chichibu/scene_snow.png', 'assets/chichibu/sky.png', 'assets/chichibu/sky_evening.png', 'assets/chichibu/sky_morning.png', 'assets/chichibu/sky_night.png', 'assets/chichibu/sky_overcast.png', 'assets/chichibu/sky_winter.png',
  'js/scenes/hodosan.js', 'assets/hodosan/chara.png', 'assets/hodosan/chara_close.png', 'assets/hodosan/data.json', 'assets/hodosan/front.png', 'assets/hodosan/front_night.png', 'assets/hodosan/front_snow.png', 'assets/hodosan/scene.png', 'assets/hodosan/scene_night.png', 'assets/hodosan/scene_snow.png', 'assets/hodosan/sky.png', 'assets/hodosan/sky_evening.png', 'assets/hodosan/sky_morning.png', 'assets/hodosan/sky_night.png', 'assets/hodosan/sky_overcast.png', 'assets/hodosan/sky_winter.png',
  'js/scenes/nagatoro.js', 'assets/nagatoro/boat.png', 'assets/nagatoro/chara.png', 'assets/nagatoro/chara_close.png', 'assets/nagatoro/data.json', 'assets/nagatoro/front.png', 'assets/nagatoro/front_night.png', 'assets/nagatoro/front_snow.png', 'assets/nagatoro/scene.png', 'assets/nagatoro/scene_night.png', 'assets/nagatoro/scene_snow.png', 'assets/nagatoro/sky.png', 'assets/nagatoro/sky_evening.png', 'assets/nagatoro/sky_morning.png', 'assets/nagatoro/sky_night.png', 'assets/nagatoro/sky_overcast.png', 'assets/nagatoro/sky_winter.png',
  'js/scenes/hitsujiyama.js', 'assets/hitsujiyama/chara.png', 'assets/hitsujiyama/chara_close.png', 'assets/hitsujiyama/data.json', 'assets/hitsujiyama/front.png', 'assets/hitsujiyama/front_night.png', 'assets/hitsujiyama/front_snow.png', 'assets/hitsujiyama/scene.png', 'assets/hitsujiyama/scene_night.png', 'assets/hitsujiyama/scene_snow.png', 'assets/hitsujiyama/sky.png', 'assets/hitsujiyama/sky_evening.png', 'assets/hitsujiyama/sky_morning.png', 'assets/hitsujiyama/sky_night.png', 'assets/hitsujiyama/sky_overcast.png', 'assets/hitsujiyama/sky_winter.png',
  'assets/kamakura/data.json', 'assets/kamakura/sky.png', 'assets/kamakura/scene.png', 'assets/kamakura/chara.png', 'assets/kamakura/chara_close.png', 'assets/minatomirai/chara_close.png', 'assets/chukagai/chara_close.png', 'assets/kamakura/front.png', 'assets/kamakura/train.png', 'assets/kamakura/gulls.png', 'assets/kamakura/scene_snow.png', 'assets/kamakura/front_snow.png',
  'assets/kamakura/sky_morning.png', 'assets/kamakura/sky_evening.png', 'assets/kamakura/sky_night.png', 'assets/kamakura/sky_overcast.png', 'assets/kamakura/sky_winter.png',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-180.png', 'ui/chara_wave.png', 'ui/chara_shoot.png', 'ui/chara_heart.png',
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
