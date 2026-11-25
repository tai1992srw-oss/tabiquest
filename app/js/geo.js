// 位置情報と到着の判定（常時GPSは使わず、確かめるときだけ1回取る）
import { PLACES } from './places.js';
import { settings, mode } from './store.js';

export function distance(a, b) {
  const R = 6371000, rad = x => x * Math.PI / 180;
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export const here = { pos: null, at: null, error: null, busy: false };

export function locate() {
  return new Promise(res => {
    if (!('geolocation' in navigator)) { here.error = 'この端末では位置情報が使えません'; return res(here); }
    if (!window.isSecureContext) { here.error = '位置情報は https のページでしか使えません'; return res(here); }
    here.busy = true;
    navigator.geolocation.getCurrentPosition(
      p => { Object.assign(here, { pos: { lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy }, at: new Date(), error: null, busy: false }); res(here); },
      e => { Object.assign(here, { error: e.code === 1 ? '位置情報の利用が許可されていません' : '現在地がわかりませんでした', busy: false }); res(here); },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 });
  });
}

// いまの現在地（デバッグの位置の上書きを含む）
export function current() {
  if (mode() === 'debug' && settings.loc !== 'none') {
    const p = PLACES.find(x => x.id === settings.loc);
    return p ? { lat: p.lat, lng: p.lng, acc: 0, fake: true } : { lat: 0, lng: 0, acc: 0, fake: true };
  }
  return here.pos;
}

export function statusOf(place) {
  // デバッグ版：位置を上書きしていないときは、どの名所もその場にいるあつかい（タップするだけで到着できる）。遠いときの見え方を試すなら、設定で位置を上書きする
  if (mode() === 'debug' && settings.loc === 'none') { const p = here.pos; return { known: true, d: p ? distance(p, place) : 0, inside: true, fake: true }; }
  const pos = current(); if (!pos) return { known: false };
  const d = distance(pos, place);
  return { known: true, d, inside: d <= place.radius + Math.min(pos.acc || 0, 100), fake: !!pos.fake };
}

export const fmtDist = d => (d < 1000 ? `${Math.round(d / 10) * 10}m` : `${(d / 1000).toFixed(d < 10000 ? 1 : 0)}km`);
