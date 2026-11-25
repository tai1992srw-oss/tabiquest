// 案B：本物の地図（Leaflet）に、案A と同じドット絵風の印を載せる
/* global L */
import { LAB_PLACES } from './places_lab.js';
import { isVisited, toggleVisited, onVisitedChange, pinURL } from './common.js';

const BASES = {
  pale: { url: 'https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png', min: 5, max: 18,
    attr: '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noopener">国土地理院（淡色地図）</a>' },
  osm: { url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', min: 0, max: 19,
    attr: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors' },
};
let map, layer, base = 'pale', dotty = false;
const markers = {};
export const rstats = { tiles: 0, tileBytes: 0, firstTileMs: 0 };

const icon = v => L.divIcon({ className: 'rm-pin', html: `<img src="${pinURL(v)}" alt="">`, iconSize: [24, 27], iconAnchor: [12, 27], popupAnchor: [0, -26] });

function setBase() {
  if (layer) map.removeLayer(layer);
  const b = BASES[base];
  // ドット風：1つ下の段のタイルを2倍に拡大して、にじませずに見せる
  layer = L.tileLayer(b.url, dotty ? { tileSize: 512, zoomOffset: -1, minZoom: b.min + 1, maxZoom: b.max + 1, maxNativeZoom: b.max + 1, attribution: b.attr, className: 'rm-pix' }
    : { minZoom: b.min, maxZoom: b.max, attribution: b.attr });
  const t0 = performance.now();
  layer.once('tileload', () => { if (!rstats.firstTileMs) rstats.firstTileMs = Math.round(performance.now() - t0); });
  layer.on('tileload', () => { rstats.tiles++; });
  layer.addTo(map);
}

function popup(p) {
  const v = isVisited(p.id);
  const d = document.createElement('div'); d.className = 'rm-pop';
  d.innerHTML = `<b>${p.name}</b> <span class="dm-tag ${v ? 'y' : ''}">${v ? '行った' : 'まだ'}</span><div class="dm-sub">${p.cat}</div><button>${v ? '「まだ」に戻す' : '行ったことにする'}</button>`;
  d.querySelector('button').onclick = () => toggleVisited(p.id);
  return d;
}

export function initRealMap(root) {
  const el = root.querySelector('.rm-map');
  if (map) { map.invalidateSize(); return; }
  map = L.map(el, { zoomControl: false, attributionControl: true }).setView([35.45, 139.45], 9);
  map.attributionControl.setPrefix('<a href="https://leafletjs.com" target="_blank" rel="noopener">Leaflet</a>');
  setBase();
  for (const p of LAB_PLACES) {
    markers[p.id] = L.marker([p.lat, p.lng], { icon: icon(isVisited(p.id)) }).addTo(map).bindPopup(() => popup(p));
  }
  onVisitedChange(() => {
    for (const p of LAB_PLACES) markers[p.id].setIcon(icon(isVisited(p.id)));
    const open = LAB_PLACES.find(p => markers[p.id].isPopupOpen());
    if (open) markers[open.id].setPopupContent(popup(open));
  });
  root.querySelectorAll('[data-base]').forEach(b => b.onclick = () => {
    base = b.dataset.base; root.querySelectorAll('[data-base]').forEach(x => x.classList.toggle('on', x === b)); setBase();
  });
  const dt = root.querySelector('[data-dot]');
  dt.onclick = () => { dotty = !dotty; dt.classList.toggle('on', dotty); setBase(); };
  root.querySelectorAll('[data-rgo]').forEach(b => b.onclick = () => {
    const g = b.dataset.rgo;
    if (g === 'jp') map.flyTo([37.6, 137.5], 5); if (g === 'kanto') map.flyTo([35.8, 139.6], 8);
    if (g === 'kana') map.flyTo([35.42, 139.35], 10); if (g === 'spot') map.flyTo([35.4556, 139.636], 16);
  });
}
