// 到着したときの時間帯・天気・季節を自動で取る
// 天気は Open-Meteo（登録なし）。送る座標は小数2桁（約1km）に丸める
import { settings, mode } from './store.js';
import { seasonOf } from './places.js';

const round2 = x => Math.round(x * 100) / 100;

// WMO の天気コード → 晴れ・曇り・雨・雪
export function weatherOf(code) {
  if (code == null) return 'unknown';
  if (code <= 1) return 'clear';
  if (code <= 48) return 'cloudy';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  return 'rain';
}

// 時間帯の本当の区分（朝・昼・夕暮れ・夜）。日の出・日の入りがわかればそれで、なければ時刻で
export function timeOfDay(now, sun) {
  const h = now.getHours() + now.getMinutes() / 60;
  if (sun) {
    const rise = sun.rise.getHours() + sun.rise.getMinutes() / 60, set = sun.set.getHours() + sun.set.getMinutes() / 60;
    if (h < rise - .5 || h >= set + .75) return 'night';
    if (h < rise + 2) return 'morning';
    if (h >= set - 1) return 'evening';
    return 'day';
  }
  return h < 5 || h >= 19 ? 'night' : h < 8 ? 'morning' : h < 16 ? 'day' : 'evening';
}

// 名所に用意してある絵のうち、いちばん近い時間帯を選ぶ
const NEAR = { morning: ['morning', 'day', 'evening', 'night'], day: ['day', 'morning', 'evening', 'night'], evening: ['evening', 'day', 'night', 'morning'], night: ['night', 'evening', 'morning', 'day'] };
export const renderTime = (place, real) => NEAR[real].find(t => place.times.includes(t)) || place.times[0];

async function fetchWeather(lat, lng) {
  const u = `https://api.open-meteo.com/v1/forecast?latitude=${round2(lat)}&longitude=${round2(lng)}&current=weather_code&daily=sunrise,sunset&forecast_days=1&timezone=auto`;
  const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), 6000);
  try {
    const r = await fetch(u, { signal: ctl.signal, cache: 'no-store' }); if (!r.ok) throw new Error(r.status);
    const j = await r.json();
    const sun = j.daily?.sunrise?.[0] ? { rise: new Date(j.daily.sunrise[0]), set: new Date(j.daily.sunset[0]) } : null;
    return { code: j.current?.weather_code ?? null, sun };
  } catch (e) { return null; } finally { clearTimeout(to); }
}

// place：名所、pos：位置（なければ名所の位置で天気を調べる）
export async function conditionsAt(place, pos) {
  const now = new Date(), dbg = mode() === 'debug';
  const lat = pos?.lat ?? place.lat, lng = pos?.lng ?? place.lng;
  const wantTime = dbg && settings.time !== 'auto', wantWeather = dbg && settings.weather !== 'auto';
  const w = wantTime && wantWeather ? null : await fetchWeather(lat, lng);
  const timeReal = wantTime ? settings.time : timeOfDay(now, w?.sun);
  const weather = wantWeather ? settings.weather : w ? weatherOf(w.code) : 'unknown';
  return {
    time: renderTime(place, timeReal), timeReal, weather,
    weatherSrc: wantWeather ? 'debug' : w ? `open-meteo:${w.code}` : 'none',
    season: seasonOf(now), lat: pos?.lat ?? null, lng: pos?.lng ?? null,
  };
}

// 描くときの天気（不明は晴れで描く）
export const drawWeather = w => (w === 'rain' || w === 'snow' || w === 'cloudy' ? w : 'clear');
