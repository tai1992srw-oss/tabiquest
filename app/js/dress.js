// お着替えの画面（2026-11-26）。ホームと撮影で同じ部品を使う。ちがうのは保存先だけ（ホーム＝ふだんの見た目、撮影＝そのカードだけ）
//   上＝キャラ（いつも見える。髪型・顔をえらぶときは顔に寄る）／下＝部位のタブ → アイテムの一覧（絵つき）→ 色
//   見た目（look）：{ colors: { skin, cloth, eye, hair }, hair：髪型の番号, outfit：衣装の番号 }（store.js の defaultLook と同じ形）
//   絵は描き足さない。assets/chara/ の層を重ねた絵（charaparts.js の sheet）に、色の置きかえ（characolor.js）をかけて見せるだけ
//   部位を足すとき：TABS に1行足し、items(P) でアイテムの一覧、get／set で look のどこに入れるかを書く
import { settings, saveSettings } from './store.js';
import { PARTS, recolorChara } from './characolor.js';
import { loadParts, sheet, hairList, outfitList } from './charaparts.js';
import { esc, toast } from './ui.js';

const COLORS = Object.fromEntries(PARTS.map(p => [p.k, p]));
// 色の候補（部位ごと）。characolor.js の候補に、選びやすい色を足す
const MORE = {
  skin: ['#fbe3d2', '#f7d6bf', '#f1c4a0', '#e4b088', '#d9a074', '#c08458', '#a86c48', '#8a5638', '#6b4330', '#4a2e22'],
  hair: ['#a8643c', '#6b4226', '#2b2224', '#e6c070', '#f4e2a8', '#f09ab8', '#e2667a', '#c8ccd8', '#8a6ce0', '#3b5fb8', '#5fb8c8', '#6fbf8a'],
  eye: ['#3a6fd8', '#5fb8e8', '#2f8c5a', '#8a4cbc', '#c23a52', '#d4a22a', '#7a4a2a', '#2b2a4c', '#e2667a', '#3ed6c4'],
  cloth: ['#f2f2f4', '#2a2c38', '#26345e', '#f3a6bf', '#9fd8c4', '#f4d36b', '#c8b8f0', '#e2667a', '#8fc4f0', '#f0c8a0'],
};
// 部位のタブ。kind：'items'（絵の一覧）／'colors'（色だけ）。focus：上のキャラをどこに寄せるか（'face'／'body'）。colors：その下に出す色の行
const TABS = [
  { id: 'hair', name: '髪型', icon: '✂', kind: 'items', focus: 'face', colors: ['hair'], items: P => hairList(P), get: L => L.hair || '', set: (L, v) => { L.hair = v; }, crop: 'face' },
  { id: 'face', name: '顔', icon: '☺', kind: 'colors', focus: 'face', colors: ['skin', 'eye'] },
  { id: 'wear', name: '服', icon: '♥', kind: 'items', focus: 'body', colors: ['cloth'], items: P => outfitList(P), get: L => L.outfit || '', set: (L, v) => { L.outfit = v; }, crop: 'body', colorNote: L => (L.outfit ? '服の色は、インナーのときだけ変わります' : '') },
  { id: 'coord', name: 'コーデ', icon: '★', kind: 'coord', focus: 'body', colors: [] },
];
const clone = L => ({ colors: { ...(L?.colors || {}) }, hair: L?.hair || '', outfit: L?.outfit || '' });
const same = (a, b) => JSON.stringify(clone(a)) === JSON.stringify(clone(b));

let dataP = null;
const loadData = () => dataP || (dataP = Promise.all([loadParts(), fetch('assets/kamakura/data.json').then(r => r.json())]).then(([P, D]) => ({ P, D })).catch(e => { dataP = null; throw e; }));

// 見た目 L の立ちの絵を、cv に描く。crop：[x, y, w, h]（寄り用の絵の中の範囲）、z：何倍か
function draw(cv, { P, D }, L, lod, crop, z) {
  const src = sheet(P, L.hair || '', lod, L.outfit || '').px, [fw] = P.J[lod], pal = D.pal.chara.map((c, i) => recolorChara(c, i, D, L.colors || {}));
  const [cx, cy, cw, ch] = crop, out = new ImageData(cw, ch), o = out.data, p = src.data;
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
    const sx = cx + x, sy = cy + y; if (sx < 0 || sx >= fw || sy < 0 || sy >= src.height) continue;
    const q = (sy * src.width + sx) * 4, k = (y * cw + x) * 4; if (p[q + 3] < 128) continue;
    const c = pal[p[q]] || [255, 0, 255]; o[k] = c[0]; o[k + 1] = c[1]; o[k + 2] = c[2]; o[k + 3] = 255;
  }
  const t = document.createElement('canvas'); t.width = cw; t.height = ch; t.getContext('2d').putImageData(out, 0, 0);
  cv.width = cw * z; cv.height = ch * z; const x = cv.getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(t, 0, 0, cv.width, cv.height);
}
// 絵の中で、キャラがいる範囲（透明でない所）を1回だけ調べる。顔＝上から髪と顔が入る高さまで
function bounds(P, lod) {
  const k = 'bounds_' + lod; if (P[k]) return P[k];
  const [fw, fh] = P.J[lod]; let x0 = fw, x1 = 0, y0 = fh, y1 = 0;
  for (const h of ['', ...P.J.hairs.map(h => h.id)]) { const d = sheet(P, h, lod, '').px; for (let y = 0; y < fh; y += 2) for (let x = 0; x < fw; x += 2) if (d.data[(y * d.width + x) * 4 + 3] > 127) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } }
  const H = y1 - y0 + 1, mid = Math.round((x0 + x1) / 2), fs = Math.round(H * .44);
  return (P[k] = { body: [Math.max(0, x0 - 4), Math.max(0, y0 - 4), Math.min(fw, x1 + 5) - Math.max(0, x0 - 4), Math.min(fh, y1 + 3) - Math.max(0, y0 - 4)], face: [Math.max(0, mid - Math.round(fs / 2)), Math.max(0, y0 - 6), fs, fs] });
}

// お着替えの画面をひらく
//   look：はじめの見た目。home：ふだんの見た目（「ホームに合わせる」ボタン用。ホームからひらくときは渡さない）
//   title・note：上に出す言葉。onChange(look)：えらぶたび。onSave(look)：決定。onClose()：とじたとき（決定でも取り消しでも）
export function openDress({ look, home = null, title = 'お着替え', note = '', onChange, onSave, onClose } = {}) {
  document.querySelector('.dressup')?.remove();
  const first = clone(look); let L = clone(look), tab = TABS[0], hist = [], env = null;
  const root = document.createElement('div'); root.className = 'dressup'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-label', title);
  root.innerHTML = `
    <div class="du-top"><button class="du-x" data-a="cancel" aria-label="やめてとじる">×</button><div class="du-ttl"><b>${esc(title)}</b>${note ? `<small>${esc(note)}</small>` : ''}</div><button class="du-ok" data-a="save">決定</button></div>
    <div class="du-stage"><canvas class="du-chara" aria-label="いまの見た目"></canvas>
      <div class="du-tools"><button data-a="undo" disabled>1つ戻す</button>${home ? '<button data-a="home">ホームに合わせる</button>' : ''}<button data-a="zoom" aria-pressed="false">全身</button></div></div>
    <div class="du-panel">
      <div class="du-tabs" role="tablist">${TABS.map(t => `<button role="tab" data-tab="${t.id}" aria-selected="${t === tab}"><i aria-hidden="true">${t.icon}</i><span>${t.name}</span></button>`).join('')}</div>
      <div class="du-body"><p class="du-load">読みこみ中…</p></div>
    </div>`;
  document.body.append(root); document.body.classList.add('du-open');
  const stage = root.querySelector('.du-stage'), cv = root.querySelector('.du-chara'), body = root.querySelector('.du-body');
  let whole = false;   // 「全身」を押している間は、どのタブでも全身を見せる
  const paint = () => {   // 入りきる大きさで、いちばん大きく。寄り用の絵が入らないときは、半分の細かさの絵を使う（ドットが割り切れるように）
    if (!env) return; const kind = (whole || tab.focus === 'body') ? 'body' : 'face', fit = c => Math.min((stage.clientHeight - 20) / c[3], (stage.clientWidth - 16) / c[2]);
    let lod = 'close', crop = bounds(env.P, lod)[kind], z = Math.floor(fit(crop));
    if (z < 1) { lod = 'normal'; crop = bounds(env.P, lod)[kind]; z = Math.max(1, Math.floor(fit(crop))); }
    draw(cv, env, L, lod, crop, 1); cv.style.width = crop[2] * z + 'px'; cv.style.height = crop[3] * z + 'px';
  };
  const change = (fn, keep = true) => { if (keep) { hist.push(clone(L)); if (hist.length > 30) hist.shift(); } fn(L); root.querySelector('[data-a=undo]').disabled = !hist.length; paint(); renderBody(false); onChange?.(clone(L)); };
  const swatches = k => { const cur = L.colors[k] || '', list = MORE[k] || COLORS[k].presets;
    return `<div class="du-colors" data-k="${k}"><span class="du-lab">${COLORS[k].name}の色</span><div class="du-sws"><button class="du-sw none" data-c="" aria-pressed="${!cur}" aria-label="${COLORS[k].name}を元の色に">元</button>${list.map(h => `<button class="du-sw" data-c="${h}" style="background:${h}" aria-pressed="${cur.toLowerCase() === h}" aria-label="${COLORS[k].name}を ${h} に"></button>`).join('')}<label class="du-sw pick${cur && !list.includes(cur.toLowerCase()) ? ' on' : ''}" aria-label="${COLORS[k].name}の色を自由にえらぶ"><input type="color" value="${cur || list[0]}"><span aria-hidden="true">＋</span></label></div></div>`; };
  const coords = () => settings.charaCoords || [];
  // 下の一覧を描く。full＝タブを切りかえたとき（絵から作り直す）。そうでなければ、えらんだ印と色だけ直す
  function renderBody(full = true) {
    if (!env) return;
    if (!full && tab.kind !== 'coord') {
      body.querySelectorAll('.du-item').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === tab.get(L))));
      body.querySelectorAll('.du-colors').forEach(el => { el.outerHTML = swatches(el.dataset.k); });
      const nt = body.querySelector('.du-note'); if (nt) nt.textContent = tab.colorNote?.(L) || '';
      if (tab.kind === 'items') thumbs(); return;
    }
    if (tab.kind === 'coord') {
      const cs = coords();
      body.innerHTML = `<p class="du-hint">気に入った組み合わせを残して、1回で着替えられます（${cs.length}／12）</p><div class="du-grid coord"><button class="du-item add" data-a="addcoord" ${cs.length >= 12 ? 'disabled' : ''}><span class="du-plus" aria-hidden="true">＋</span><span class="du-nm">いまのコーデを残す</span></button>${cs.map((c, i) => `<div class="du-cell"><button class="du-item" data-coord="${i}" aria-pressed="${same(c.look, L)}"><canvas></canvas><span class="du-nm">${esc(c.name)}</span></button><button class="du-del" data-del="${i}" aria-label="${esc(c.name)}を消す">×</button></div>`).join('')}</div>`;
      const B = bounds(env.P, 'normal'); body.querySelectorAll('[data-coord]').forEach(b => draw(b.querySelector('canvas'), env, clone(cs[+b.dataset.coord].look), 'normal', B.body, 1));
      return;
    }
    const items = tab.kind === 'items' ? tab.items(env.P) : [];
    body.innerHTML = (items.length ? `<div class="du-grid">${items.map(it => `<button class="du-item" data-v="${esc(it.id)}" aria-pressed="${it.id === tab.get(L)}"><canvas></canvas><span class="du-nm">${esc(it.name)}</span></button>`).join('')}</div>` : '')
      + tab.colors.map(swatches).join('') + `<p class="du-note">${esc(tab.colorNote?.(L) || '')}</p>`;
    thumbs();
  }
  // 一覧の小さな絵：そのアイテムだけを替えた見た目（色はいまのまま）
  function thumbs() {
    const B = bounds(env.P, 'normal');
    body.querySelectorAll('.du-item[data-v]').forEach(b => { const t = clone(L); tab.set(t, b.dataset.v); draw(b.querySelector('canvas'), env, t, 'normal', B[tab.crop], 1); });
  }
  const close = () => { root.remove(); document.body.classList.remove('du-open'); removeEventListener('resize', paint); document.removeEventListener('keydown', onKey); onClose?.(); };
  const onKey = e => { if (e.key === 'Escape') { e.preventDefault(); root.querySelector('[data-a=cancel]').click(); } };
  root.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return; const a = b.dataset.a;
    if (b.dataset.tab) { tab = TABS.find(t => t.id === b.dataset.tab); root.querySelectorAll('[data-tab]').forEach(x => x.setAttribute('aria-selected', String(x === b))); paint(); renderBody(); }
    else if (b.dataset.v !== undefined) { if (tab.get(L) !== b.dataset.v) change(x => tab.set(x, b.dataset.v)); }
    else if (b.dataset.c !== undefined) { const k = b.closest('.du-colors').dataset.k; change(x => { if (b.dataset.c) x.colors[k] = b.dataset.c; else delete x.colors[k]; }); }
    else if (b.dataset.coord !== undefined) { const c = coords()[+b.dataset.coord]; if (c) { change(x => Object.assign(x, clone(c.look))); renderBody(); } }
    else if (b.dataset.del !== undefined) { const cs = coords().slice(), c = cs[+b.dataset.del]; if (c && confirm(`「${c.name}」を消しますか？`)) { cs.splice(+b.dataset.del, 1); settings.charaCoords = cs; saveSettings(); renderBody(); } }
    else if (a === 'addcoord') { const cs = coords().slice(), name = (prompt('コーデの名前', `コーデ${cs.length + 1}`) || '').trim().slice(0, 12); if (!name) return; cs.push({ name, look: clone(L) }); settings.charaCoords = cs; saveSettings(); renderBody(); toast(`「${name}」を残しました`); }
    else if (a === 'undo') { const p = hist.pop(); if (p) { L = p; b.disabled = !hist.length; paint(); renderBody(); onChange?.(clone(L)); } }
    else if (a === 'home' && home) { if (!same(L, home)) { change(x => Object.assign(x, clone(home))); renderBody(); } }
    else if (a === 'zoom') { whole = !whole; b.setAttribute('aria-pressed', String(whole)); paint(); }
    else if (a === 'save') { onSave?.(clone(L)); close(); }
    else if (a === 'cancel') { if (!same(L, first)) { if (!confirm('えらんだお着替えをやめて、とじますか？')) return; onChange?.(clone(first)); } close(); }
  });
  // 色を自由にえらぶ：動かしている間はキャラだけ描き直し、決まったら1回ぶんとして残す
  let picking = null;
  root.addEventListener('input', e => { if (e.target.type !== 'color') return; const k = e.target.closest('.du-colors').dataset.k; if (!picking) { picking = clone(L); } L.colors[k] = e.target.value; paint(); onChange?.(clone(L)); });
  root.addEventListener('change', e => { if (e.target.type !== 'color' || !picking) return; hist.push(picking); picking = null; root.querySelector('[data-a=undo]').disabled = false; renderBody(false); });
  addEventListener('resize', paint); document.addEventListener('keydown', onKey);
  loadData().then(v => { env = v; paint(); renderBody(); }).catch(() => { body.innerHTML = '<p class="du-load">キャラの絵を読みこめませんでした</p>'; });
  root.querySelector('.du-ok').focus({ preventScroll: true });
  return close;
}
