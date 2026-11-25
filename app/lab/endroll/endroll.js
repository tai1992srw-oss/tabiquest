// エンドロールの試作：カードを選んで並べ → 記録を自動で入れ → プレビュー → 縦動画に書き出す（端末の中だけ）
// カードの絵は本体の描画エンジン（js/card.js）と名所の層（js/scenes/）をそのまま使う。絵は描き足さない
// このページは <base href="../../"> で app/ を基準にしている（名所の層が 'assets/…' を読むため）
import { engine } from '../../js/card.js';
import { placeById, LABEL, seasonOf } from '../../js/places.js';
import { build as buildMM } from '../../js/scenes/minatomirai.js';
import { build as buildCK } from '../../js/scenes/chukagai.js';
import { build as buildKK } from '../../js/scenes/kamakura.js';
import { muxMp4 } from './mp4.js';

engine.register('minatomirai', buildMM);
engine.register('chukagai', buildCK);
engine.register('kamakura', buildKK);

// ---- 仮の旅のデータ（v0.2 の到着ごとのカードと同じ形：store.js の arrive() が作るもの） ----
const TRIP = {
  title: '横浜 日帰りの旅',
  traveler: 'くりた',
  cards: [
    { id: 'kamakura-koukoumae-1', placeId: 'kamakura-koukoumae', n: 1, at: '2026-11-22T11:20:00+09:00', time: 'day', weather: 'clear', season: 'autumn', lat: 35.3068, lng: 139.5004, use: false },
    { id: 'minatomirai-1', placeId: 'minatomirai', n: 1, at: '2026-11-22T16:42:00+09:00', time: 'evening', weather: 'clear', season: 'autumn', lat: 35.4557, lng: 139.6361, use: true },
    { id: 'chukagai-1', placeId: 'chukagai', n: 1, at: '2026-11-22T18:35:00+09:00', time: 'night', weather: 'cloudy', season: 'autumn', lat: 35.4436, lng: 139.6467, use: true },
  ],
  // この旅より前に行ったことのある県・市（本番では、この旅より前のカードから数える）
  before: { prefs: ['東京都'], cities: ['東京都新宿区'] },
};

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const WD = '日月火水木金土';
const fmtD = d => `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}（${WD[d.getDay()]}）`;
const fmtT = d => `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
const cityOf = p => (p.city.match(/^.+?市/) || [p.city])[0];
const sceneOf = p => p.scene;
const drawWeather = w => (['rain', 'snow', 'cloudy'].includes(w) ? w : 'clear');

// ---- 記録を数える ----
function haversine(a, b) {
  const R = 6371, r = Math.PI / 180, dLat = (b.lat - a.lat) * r, dLng = (b.lng - a.lng) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
export function tripStats(cards, before) {
  const byTime = [...cards].sort((a, z) => (a.at < z.at ? -1 : 1));
  let km = 0; const pts = byTime.filter(c => c.lat != null && c.lng != null);
  for (let i = 1; i < pts.length; i++) km += haversine(pts[i - 1], pts[i]);
  const day0 = d => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
  const days = byTime.length ? Math.round((day0(byTime.at(-1).at) - day0(byTime[0].at)) / 864e5) + 1 : 0;
  const places = [...new Set(cards.map(c => c.placeId))].map(placeById);
  const count = (arr) => arr.reduce((m, k) => (m[k] = (m[k] || 0) + 1, m), {});
  const weather = count(cards.map(c => c.weather));
  const seasons = [...new Set(byTime.map(c => c.season || seasonOf(new Date(c.at))))];
  // 手に入れたもの：その名所に初めて行ったカード（n=1）でもらえるもの
  const items = cards.filter(c => c.n === 1).map(c => placeById(c.placeId).item.name);
  const prefs = [...new Set(places.map(p => p.pref))], cities = [...new Set(places.map(p => p.pref + cityOf(p)))];
  const newPrefs = prefs.filter(p => !before.prefs.includes(p));
  const newCities = places.filter(p => !before.cities.includes(p.pref + cityOf(p))).map(cityOf).filter((v, i, a) => a.indexOf(v) === i);
  return { km, days, first: byTime[0]?.at, last: byTime.at(-1)?.at, places: places.length, weather, seasons, items, prefs, cities: cities.length, newPrefs, newCities };
}

// ---- 縦の画面の組み立て（360×640 の小さな画面に描き、書き出すときに整数倍で大きくする） ----
const VW = 360, VH = 640, FPS = 30;
export const LAB_VER = 'endroll-lab 1';
const C = { bg: '#0B0E22', text: '#EDEBFF', sub: '#A9A6D6', gold: '#FFC857', teal: '#3ED6C4', coral: '#FF9A8A', frame: '#EDEBFF' };
const FONT = '"DotGothic16", monospace';

// 文字を 16px で描いて、ふちのぼけを切る（ドットの文字にする）。big は整数倍に大きくする
function textImg(s, color, big = 1) {
  const c = document.createElement('canvas'), x = c.getContext('2d');
  x.font = `16px ${FONT}`; const w = Math.max(1, Math.ceil(x.measureText(s).width)); c.width = w; c.height = 20;
  x.font = `16px ${FONT}`; x.textBaseline = 'top'; x.fillStyle = color; x.fillText(s, 0, 2);
  const d = x.getImageData(0, 0, c.width, c.height), a = d.data;
  for (let i = 3; i < a.length; i += 4) a[i] = a[i] >= 110 ? 255 : 0;
  x.putImageData(d, 0, 0);
  if (big === 1) return c;
  const b = document.createElement('canvas'); b.width = w * big; b.height = 20 * big; const bx = b.getContext('2d'); bx.imageSmoothingEnabled = false; bx.drawImage(c, 0, 0, b.width, b.height); return b;
}
function wrap(s, n = 20) { const out = []; for (let i = 0; i < s.length; i += n) out.push(s.slice(i, i + n)); return out; }

// 流れる列を作る：文字は1枚の長い絵に先に描いておき、カードの場所（slot）だけ毎コマ動く絵を描く
function buildRoll(opt) {
  const { title, traveler, cards, st } = opt;
  const rows = []; let y = 0;
  const line = (s, color = C.text, big = 1, gap = 6) => { for (const t of wrap(s, big > 1 ? 10 : 21)) { rows.push({ img: textImg(t, color, big), y }); y += 20 * big + gap; } };
  const space = h => { y += h; };
  const slots = [];
  const d0 = new Date(st.first), d1 = new Date(st.last);
  line(title, C.gold, 2, 10);
  line(st.days > 1 ? `${fmtD(d0)} 〜 ${fmtD(d1)}` : fmtD(d0), C.sub);
  space(120);
  cards.forEach((c, i) => {
    const p = placeById(c.placeId), at = new Date(c.at);
    line(`― CHAPTER ${i + 1} ―`, C.gold); space(6);
    line(p.name, C.text, 2, 6);
    line(`${p.pref} ${cityOf(p)}`, C.sub); space(14);
    const [w, h] = opt.size[c.placeId];
    slots.push({ card: c, place: p, x: Math.round((VW - w) / 2), y, w, h }); y += h + 16;
    line(`${fmtD(at)} ${fmtT(at)}`, C.text);
    line(`${LABEL.time[c.time]} ・ ${LABEL.weather[c.weather] || '天気不明'}`, C.teal);
    if (c.n === 1) { space(4); line(`${p.item.name}`, C.coral); line('を 手に入れた！', C.text); }
    space(110);
  });
  line('― 旅の記録 ―', C.gold); space(24);
  const pair = (k, v) => { line(k, C.sub, 1, 4); for (const s of [].concat(v)) line(s, C.text); space(22); };
  pair('総移動距離', `${st.km < 10 ? st.km.toFixed(1) : Math.round(st.km)} km`);
  pair('日数', `${st.days}日`);
  pair('行った場所', `${st.places}か所`);
  pair('天気', Object.entries(st.weather).map(([k, n]) => `${LABEL.weather[k] || '天気不明'} ${n}`).join(' ・ '));
  pair('季節', st.seasons.map(s => LABEL.season[s]).join(' ・ '));
  if (st.items.length) pair('手に入れたもの', st.items);
  pair('初めての県', st.newPrefs.length ? [`${st.newPrefs.length}つ`, st.newPrefs.join('・')] : 'なし');
  pair('初めての市', st.newCities.length ? [`${st.newCities.length}つ`, st.newCities.join('・')] : 'なし');
  space(60);
  line('旅人', C.sub, 1, 4); line(traveler || '名なしの旅人', C.text); space(40);
  line('絵', C.sub, 1, 4); line('Canva・Codex のドット絵', C.text); space(40);
  line('Presented by', C.sub, 1, 4); line('タビクエ', C.gold, 2); space(220);
  const endY = y; line('THE END', C.gold, 3, 14); line(title, C.sub);
  const endH = y - endY;
  // 文字の長い絵
  const sheet = document.createElement('canvas'); sheet.width = VW; sheet.height = y + 4; const sx = sheet.getContext('2d');
  for (const r of rows) sx.drawImage(r.img, Math.round((VW - r.img.width) / 2), r.y);
  for (const s of slots) { sx.fillStyle = C.frame; sx.fillRect(s.x - 3, s.y - 3, s.w + 6, s.h + 6); sx.fillStyle = C.bg; sx.fillRect(s.x - 1, s.y - 1, s.w + 2, s.h + 2); }
  // 流す量：THE END が真ん中で止まるまで
  const stopAt = Math.round(endY + endH / 2 - VH / 2) + VH; // 列の先頭が画面の下（y=VH）から始まる
  return { sheet, slots, stopAt, height: y };
}

// 時間の割りふり：黒1秒 → 流れる（1コマに px ドット。整数にするとドットがぶれない）→ THE END で止まって4秒 → 最後の0.8秒で暗くなる
// 長さは中身で決まる（カードが増えると長くなる）。速さを上げると読みにくくなるので、速さを選ぶ形にした
function timeline(roll, px) {
  const lead = FPS, hold = 4 * FPS, scrollF = Math.ceil(roll.stopAt / px);
  return { lead, hold, px, scrollF, total: lead + scrollF + hold };
}

// 1コマ描く。i はコマ番号
const applied = new Map(), lastF = new Map(), scenes = {};
async function prepareScenes(cards) {
  const size = {};
  for (const c of cards) { const p = placeById(c.placeId), s = await engine.get(sceneOf(p)); scenes[sceneOf(p)] = s; size[c.placeId] = [s.scene.userData.W, s.scene.userData.H]; }
  return size;
}
function drawCard(slot, t, reveal) {
  const p = slot.place, s = scenes[sceneOf(p)]; if (!s) return null;
  const st = { time: slot.card.time, weather: drawWeather(slot.card.weather), season: slot.card.season || seasonOf(new Date(slot.card.at)) }, key = slot.card.id;
  engine.fit(s);
  if (applied.get(s) !== key) { s.apply(st); applied.set(s, key); lastF.delete(key); }
  for (const m of [...s.layers, s.ch.chara]) m.material.uniforms.uReveal.value = reveal;
  s.ch.shadow.material.opacity = s.ch.shadowOpacity * reveal; s.drop = 0;
  const f = Math.floor(t * 12), par = Math.sin(t * .32) * .7;
  s.frame(par, f, lastF.get(key) !== f, false, st); lastF.set(key, f);
  engine.renderer.render(s.scene, engine.cam);
  return engine.canvas;
}
function drawFrame(ctx, roll, tl, i) {
  ctx.fillStyle = C.bg; ctx.fillRect(0, 0, VW, VH);
  const k = Math.min(Math.max(0, i - tl.lead), tl.scrollF);
  const top = VH - k * tl.px; // 列の先頭の画面上の y
  ctx.drawImage(roll.sheet, 0, Math.max(0, -top), VW, VH, 0, Math.max(0, top), VW, VH);
  const t = i / FPS;
  for (const s of roll.slots) {
    const y = top + s.y; if (y > VH || y + s.h < 0) continue;
    const reveal = Math.min(1, Math.max(0, (VH - y) / 220));
    const cv = drawCard(s, t, reveal); if (cv) ctx.drawImage(cv, s.x, y);
  }
  const fadeF = Math.round(.8 * FPS), left = tl.total - i;
  if (left < fadeF) { ctx.fillStyle = `rgba(11,14,34,${1 - left / fadeF})`; ctx.fillRect(0, 0, VW, VH); }
  if (i < 8) { ctx.fillStyle = C.bg; ctx.fillRect(0, 0, VW, VH); }
}

// ---- 画面 ----
let roll = null, tl = null, comp = null, cctx = null;
const state = { order: TRIP.cards.map(c => c.id), use: Object.fromEntries(TRIP.cards.map(c => [c.id, c.use])), speed: 3, res: 720, method: 'auto' };
const chosen = () => state.order.map(id => TRIP.cards.find(c => c.id === id)).filter(c => state.use[c.id]);

function renderList() {
  $('#cards').innerHTML = state.order.map((id, i) => {
    const c = TRIP.cards.find(x => x.id === id), p = placeById(c.placeId), at = new Date(c.at);
    return `<li class="${state.use[id] ? '' : 'off'}"><label><input type="checkbox" data-use="${id}" ${state.use[id] ? 'checked' : ''}>
      <span><b>${esc(p.name)}</b><small>${fmtD(at)} ${fmtT(at)} ・ ${LABEL.time[c.time]} ・ ${LABEL.weather[c.weather]}</small></span></label>
      <span class="mv"><button data-up="${i}" ${i ? '' : 'disabled'} aria-label="上へ">▲</button><button data-dn="${i}" ${i < state.order.length - 1 ? '' : 'disabled'} aria-label="下へ">▼</button></span></li>`;
  }).join('');
}
function renderStats() {
  const cs = chosen(); if (!cs.length) { $('#stats').innerHTML = '<p class="sub">カードを1枚以上えらんでください</p>'; return null; }
  const st = tripStats(cs, TRIP.before);
  const row = (k, v) => `<dt>${k}</dt><dd>${esc(v)}</dd>`;
  $('#stats').innerHTML = `<dl>${row('総移動距離', `${st.km.toFixed(1)} km（カードを撮った地点の直線距離の合計、時刻順）`)}${row('日数', `${st.days}日`)}${row('場所の数', `${st.places}か所`)}
    ${row('天気', Object.entries(st.weather).map(([k, n]) => `${LABEL.weather[k]}×${n}`).join('、'))}${row('季節', st.seasons.map(s => LABEL.season[s]).join('、'))}
    ${row('手に入れたもの', st.items.join('、') || 'なし')}${row('初めての県', st.newPrefs.join('、') || 'なし')}${row('初めての市', st.newCities.join('、') || 'なし')}</dl>`;
  return st;
}

async function rebuild() {
  stopPreview();
  const cs = chosen(); const st = renderStats(); if (!st) { roll = null; return; }
  const title = $('#title').value.trim() || TRIP.title, traveler = $('#traveler').value.trim();
  // 使う文字を先に読む（Google Fonts は日本語を分けて配るので、出す文字を渡して読む）
  const all = [title, traveler, '―CHAPTER0123456789旅の記録総移動距離日数行った場所天気季節手に入れたもの初めての県市人絵Presented byタビクエTHE END〜（）・を！km日か所つなし', ...cs.map(c => { const p = placeById(c.placeId); return p.name + p.pref + p.city + p.item.name; }), ...Object.values(LABEL.time), ...Object.values(LABEL.weather), ...Object.values(LABEL.season), WD, 'Canva・Codex のドット絵'].join('');
  try { await document.fonts.load(`16px "DotGothic16"`, all); } catch (e) {}
  const size = await prepareScenes(cs);
  roll = buildRoll({ title, traveler, cards: cs, st, size });
  tl = timeline(roll, state.speed);
  $('#seek').max = tl.total - 1; $('#seek').value = 0;
  $('#dur').textContent = `${(tl.total / FPS).toFixed(1)}秒（${tl.total}コマ、1コマ ${tl.px}ドットずつ流れる＝${tl.px * FPS}ドット/秒）`;
  drawFrame(cctx, roll, tl, Math.min(tl.total - 1, tl.lead + 60));
}

// プレビュー（実時間で再生）
let playing = false, startMs = 0, startI = 0;
function stopPreview() { playing = false; $('#play').textContent = '▶ 再生'; }
function tick(ms) {
  if (!playing) return;
  const i = startI + Math.floor((ms - startMs) / 1000 * FPS);
  if (i >= tl.total) { stopPreview(); return; }
  drawFrame(cctx, roll, tl, i); $('#seek').value = i; requestAnimationFrame(tick);
}

// ---- できることを調べる ----
const MR_TYPES = ['video/mp4;codecs=avc1.42E01F', 'video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
const AVC = { 720: ['avc1.64001f', 'avc1.4d001f', 'avc1.42001f', 'avc1.640028'], 1080: ['avc1.640028', 'avc1.4d0028', 'avc1.42e028', 'avc1.640032'] };
const DIM = { 720: [720, 1280], 1080: [1080, 1920] };
async function avcConfig(res) {
  if (!('VideoEncoder' in window)) return null;
  const [w, h] = DIM[res];
  for (const codec of AVC[res]) {
    for (const hw of ['prefer-hardware', 'no-preference']) {
      const cfg = { codec, width: w, height: h, bitrate: res === 1080 ? 8e6 : 5e6, framerate: FPS, latencyMode: 'realtime', avc: { format: 'avc' }, hardwareAcceleration: hw };
      try { const r = await VideoEncoder.isConfigSupported(cfg); if (r.supported) return r.config; } catch (e) {}
    }
  }
  return null;
}
const canShareType = type => { try { return !!navigator.canShare?.({ files: [new File([new Uint8Array(16)], 'a.' + (type.includes('mp4') ? 'mp4' : 'webm'), { type })] }); } catch (e) { return false; } };
async function probe() {
  const out = [];
  const c720 = await avcConfig(720), c1080 = await avcConfig(1080);
  out.push(['WebCodecs（VideoEncoder）', 'VideoEncoder' in window ? 'あり' : 'なし']);
  out.push(['H.264 720×1280', c720 ? `できる（${c720.codec}、${c720.hardwareAcceleration}）` : 'できない']);
  out.push(['H.264 1080×1920', c1080 ? `できる（${c1080.codec}、${c1080.hardwareAcceleration}）` : 'できない']);
  out.push(['MediaRecorder', 'MediaRecorder' in window ? (MR_TYPES.filter(t => MediaRecorder.isTypeSupported(t)).join(' / ') || '形式なし') : 'なし']);
  out.push(['共有（ファイルを渡す）', !navigator.share ? 'なし' : `MP4 ${canShareType('video/mp4') ? '○' : '×'} ・ WebM ${canShareType('video/webm') ? '○' : '×'}`]);
  $('#probe').innerHTML = out.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('');
  return { c720, c1080 };
}

// ---- 書き出し ----
const ua = () => { const m = navigator.userAgent.match(/Android [^;)]+; ([^;)]+)\)/); const ch = navigator.userAgent.match(/Chrome\/(\d+)/); return `${m ? m[1].replace(' Build', '') : navigator.platform} / Chrome ${ch ? ch[1] : '?'}`; };
function makeOut(res) { const [w, h] = DIM[res], c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d', { alpha: false }); x.imageSmoothingEnabled = false; return { c, x, w, h, S: w / VW }; }
const progress = (p, msg) => { $('#bar').style.width = `${Math.round(p * 100)}%`; $('#status').textContent = msg; };

// A：WebCodecs でコマを1枚ずつ作って H.264 にし、MP4 に詰める（実時間に縛られないのでカクつかない）
async function exportWebCodecs(res, cfg) {
  const o = makeOut(res), chunks = []; let avcC = null, err = null;
  const ve = new VideoEncoder({
    output: (ch, meta) => { if (meta?.decoderConfig?.description && !avcC) avcC = new Uint8Array(meta.decoderConfig.description); const d = new Uint8Array(ch.byteLength); ch.copyTo(d); chunks.push({ data: d, key: ch.type === 'key', ts: ch.timestamp }); },
    error: e => { err = e; },
  });
  ve.configure(cfg);
  const t0 = performance.now(); let drawMax = 0, drawSum = 0;
  for (let i = 0; i < tl.total; i++) {
    if (err) throw err;
    const a = performance.now();
    drawFrame(cctx, roll, tl, i); o.x.drawImage(comp, 0, 0, o.w, o.h);
    const vf = new VideoFrame(o.c, { timestamp: Math.round(i * 1e6 / FPS), duration: Math.round(1e6 / FPS) });
    ve.encode(vf, { keyFrame: i % (FPS * 2) === 0 }); vf.close();
    const dt = performance.now() - a; drawSum += dt; drawMax = Math.max(drawMax, dt);
    while (ve.encodeQueueSize > 6) await new Promise(r => setTimeout(r, 1));
    if (i % 10 === 0) { progress(i / tl.total, `書き出し中… ${i}/${tl.total}コマ`); await new Promise(r => setTimeout(r, 0)); }
  }
  await ve.flush(); ve.close(); if (err) throw err;
  if (!avcC) throw new Error('avcC が出てこなかった');
  let mono = true; for (let i = 1; i < chunks.length; i++) if (chunks[i].ts <= chunks[i - 1].ts) mono = false;
  const blob = muxMp4({ chunks, avcC, width: o.w, height: o.h, fps: FPS });
  const sec = (performance.now() - t0) / 1000;
  return { blob, ext: 'mp4', sec, note: `1コマ描く平均 ${(drawSum / tl.total).toFixed(1)}ms・最大 ${drawMax.toFixed(0)}ms、実時間の ${((tl.total / FPS) / sec).toFixed(1)}倍の速さ、コマの順 ${mono ? 'そろっている' : 'くずれている（B フレーム）'}、${cfg.codec}`, drops: 0 };
}

// B：MediaRecorder で画面を実時間で録る（再生と同じ速さでしか作れない。重いとコマが飛ぶ）
async function exportRecorder(res) {
  const type = MR_TYPES.find(t => MediaRecorder.isTypeSupported(t)); if (!type) throw new Error('MediaRecorder で使える形式がない');
  const o = makeOut(res), stream = o.c.captureStream(FPS), parts = [];
  const rec = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: res === 1080 ? 8e6 : 5e6 });
  rec.ondataavailable = e => { if (e.data.size) parts.push(e.data); };
  const done = new Promise(r => { rec.onstop = r; });
  drawFrame(cctx, roll, tl, 0); o.x.drawImage(comp, 0, 0, o.w, o.h);
  let hid = false; const onVis = () => { if (document.hidden) hid = true; }; document.addEventListener('visibilitychange', onVis);
  rec.start(1000);
  const t0 = performance.now(); let last = t0, drops = 0, maxGap = 0, frames = 0, prevI = -1;
  await new Promise(resolve => {
    const step = ms => {
      const i = Math.floor((ms - t0) / 1000 * FPS);
      const gap = ms - last; last = ms; maxGap = Math.max(maxGap, gap);
      if (prevI >= 0 && i - prevI > 1) drops += i - prevI - 1;
      if (i >= tl.total) { resolve(); return; }
      if (i !== prevI) { drawFrame(cctx, roll, tl, i); o.x.drawImage(comp, 0, 0, o.w, o.h); frames++; prevI = i; }
      if (i % 10 === 0) progress(i / tl.total, `録画中…（実時間）${(i / FPS).toFixed(0)}/${(tl.total / FPS).toFixed(0)}秒  画面を消さないでください`);
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
  rec.stop(); await done; stream.getTracks().forEach(t => t.stop()); document.removeEventListener('visibilitychange', onVis);
  const sec = (performance.now() - t0) / 1000;
  return { blob: new Blob(parts, { type: type.split(';')[0] }), ext: type.includes('mp4') ? 'mp4' : 'webm', sec, note: `${type}、描いたコマ ${frames}/${tl.total}、いちばん長いすきま ${maxGap.toFixed(0)}ms${hid || document.hidden ? '、途中で画面が隠れた（測り直し）' : ''}`, drops };
}

// 出来た動画を読んで、長さと大きさを確かめる
function checkVideo(url) {
  return new Promise(res => {
    const v = $('#out'); let done = false;
    const fin = ok => { if (done) return; done = true; res(ok ? `再生できる ${v.videoWidth}×${v.videoHeight}・長さ ${isFinite(v.duration) ? v.duration.toFixed(1) + '秒' : '不明（WebM は長さが入らないことがある）'}` : '読みこめない'); };
    v.onloadedmetadata = () => fin(true); v.onerror = () => fin(false); setTimeout(() => fin(v.readyState > 0), 5000);
    v.src = url; v.load();
  });
}

let result = null;
async function doExport() {
  if (!roll) return; stopPreview();
  const btn = $('#export'); btn.disabled = true; $('#result').hidden = true;
  const res = state.res; let method = state.method, r;
  try {
    const cfg = method !== 'recorder' ? await avcConfig(res) : null;
    if (method === 'webcodecs' && !cfg) throw new Error('この端末では WebCodecs の H.264 が使えない');
    if (method === 'auto') method = cfg ? 'webcodecs' : 'recorder';
    progress(0, '準備中…');
    r = method === 'webcodecs' ? await exportWebCodecs(res, cfg) : await exportRecorder(res);
  } catch (e) { progress(0, `失敗：${e.message || e}`); btn.disabled = false; return; }
  progress(1, 'できました');
  if (result?.url) URL.revokeObjectURL(result.url);
  const d = new Date(), name = `tabiquest-endroll-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}.${r.ext}`;
  const url = URL.createObjectURL(r.blob);
  result = { ...r, url, name, file: new File([r.blob], name, { type: r.blob.type }) };
  const check = await checkVideo(url);
  const mb = r.blob.size / 1048576, len = tl.total / FPS;
  const m = { at: new Date().toLocaleString('ja-JP'), dev: ua(), how: method === 'webcodecs' ? 'WebCodecs→MP4' : 'MediaRecorder', res: `${DIM[res][0]}×${DIM[res][1]}`, len: `${len.toFixed(1)}秒`,
    took: `${r.sec.toFixed(1)}秒`, size: `${mb.toFixed(1)}MB（${(r.blob.size * 8 / len / 1e6).toFixed(1)}Mbps）`, drops: method === 'webcodecs' ? 'なし（1コマずつ作る）' : `${r.drops}コマ飛んだ`, note: r.note, check,
    share: canShareType(r.blob.type) ? 'このファイルは共有できる' : 'このファイルは共有できない' };
  saveMeasure(m); showMeasure(m);
  $('#save').href = url; $('#save').download = name; $('#share').disabled = !navigator.share; $('#result').hidden = false; btn.disabled = false;
}
async function doShare() {
  if (!result) return;
  const files = [result.file];
  try {
    if (!navigator.canShare?.({ files })) { $('#shareMsg').textContent = 'この形式のファイルは共有できませんでした。「保存する」で端末に入れてから、SNS のアプリで選んでください'; return; }
    await navigator.share({ files, title: $('#title').value || TRIP.title, text: `${$('#title').value || TRIP.title} #タビクエ` });
    $('#shareMsg').textContent = '共有の画面を開けました';
  } catch (e) { $('#shareMsg').textContent = e.name === 'AbortError' ? '共有をやめました' : `共有できませんでした：${e.name} ${e.message}`; }
}

// ---- 測った結果（この端末の中だけに残す） ----
const MKEY = 'tabiquest:lab:endroll:measure';
const loadM = () => { try { return JSON.parse(localStorage.getItem(MKEY)) || []; } catch (e) { return []; } };
function saveMeasure(m) { try { localStorage.setItem(MKEY, JSON.stringify([m, ...loadM()].slice(0, 8))); } catch (e) {} }
const mText = m => `${m.at}｜${m.dev}｜${m.how} ${m.res} ${m.len}｜かかった時間 ${m.took}｜${m.size}｜カクつき ${m.drops}｜${m.check}｜${m.share}｜${m.note}`;
function showMeasure(m) { $('#measure').innerHTML = `<dt>端末</dt><dd>${esc(m.dev)}</dd><dt>方法</dt><dd>${esc(m.how)}　${esc(m.res)}　${esc(m.len)}</dd><dt>かかった時間</dt><dd>${esc(m.took)}</dd><dt>大きさ</dt><dd>${esc(m.size)}</dd><dt>カクつき</dt><dd>${esc(m.drops)}</dd><dt>確かめ</dt><dd>${esc(m.check)}・${esc(m.share)}</dd><dt>くわしく</dt><dd>${esc(m.note)}</dd>`; renderHistory(); }
function renderHistory() { const h = loadM(); $('#history').innerHTML = h.length ? h.map(m => `<li>${esc(mText(m))}</li>`).join('') : '<li>まだありません</li>'; }

// ---- つなぐ ----
async function init() {
  $('#ver').textContent = LAB_VER;
  comp = $('#view'); comp.width = VW; comp.height = VH; cctx = comp.getContext('2d', { alpha: false });
  $('#title').value = TRIP.title; $('#traveler').value = TRIP.traveler;
  renderList(); renderHistory();
  $('#cards').addEventListener('change', e => { const id = e.target.dataset.use; if (id) { state.use[id] = e.target.checked; renderList(); rebuild(); } });
  $('#cards').addEventListener('click', e => {
    const up = e.target.dataset.up, dn = e.target.dataset.dn, o = state.order;
    if (up !== undefined) { const i = +up; [o[i - 1], o[i]] = [o[i], o[i - 1]]; } else if (dn !== undefined) { const i = +dn; [o[i + 1], o[i]] = [o[i], o[i + 1]]; } else return;
    renderList(); rebuild();
  });
  let tmr; for (const s of ['#title', '#traveler']) $(s).addEventListener('input', () => { clearTimeout(tmr); tmr = setTimeout(rebuild, 500); });
  for (const [sel, key] of [['#speed', 'speed'], ['#res', 'res'], ['#method', 'method']]) $(sel).addEventListener('change', e => { state[key] = isNaN(+e.target.value) ? e.target.value : +e.target.value; if (key === 'speed') rebuild(); });
  $('#play').addEventListener('click', () => {
    if (!roll) return; if (playing) { stopPreview(); return; }
    playing = true; $('#play').textContent = '■ 止める'; startI = +$('#seek').value >= tl.total - 1 ? 0 : +$('#seek').value; startMs = performance.now(); requestAnimationFrame(tick);
  });
  $('#seek').addEventListener('input', e => { stopPreview(); if (roll) drawFrame(cctx, roll, tl, +e.target.value); });
  $('#export').addEventListener('click', doExport);
  $('#share').addEventListener('click', doShare);
  $('#copy').addEventListener('click', async () => { const t = loadM().map(mText).join('\n'); try { await navigator.clipboard.writeText(t); $('#copy').textContent = 'コピーしました'; } catch (e) { $('#copy').textContent = 'コピーできませんでした'; } });
  probe();
  await rebuild();
}
init();
