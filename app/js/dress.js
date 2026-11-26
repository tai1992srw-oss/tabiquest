// お着替えの画面（2026-11-26）。ホームと撮影で同じ部品を使う。ちがうのは保存先だけ（ホーム＝ふだんの見た目、撮影＝そのカードだけ）
//   上＝キャラ（いつも見える。髪型・顔をえらぶときは顔に寄る）／下＝部位のタブ → アイテムの一覧（絵つき）→ 色
//   見た目（look）：{ colors: { skin, cloth, eye, hair }, hair：髪型の番号, outfit：衣装の番号, kao：顔のタイプ }（store.js の defaultLook と同じ形）
//   絵は描き足さない。assets/chara/ の層を重ねた絵（charaparts.js の sheet）に、色の置きかえ（characolor.js）をかけて見せるだけ
//   部位を足すとき：TABS に1行足し、items(P) でアイテムの一覧、get／set で look のどこに入れるかを書く
import { settings, saveSettings } from './store.js';
import { PARTS, recolorChara } from './characolor.js';
import { loadParts, sheet, hairList, outfitList, kaoList, wearOf, packWear, WEAR_KEYS, shapeInfo, shapeSteps, packShape } from './charaparts.js';
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
// キャラのテンプレート（parts.json の charas）：顔・髪型・服・色をまとめて着せる。体型は変えない。あとから髪型や服を1つずつ替えられる（服の「セット」と同じ考え方）
const tmplOn = (L, c) => (L.kao || '') === (c.look.kao || '') && (L.hair || '') === (c.look.hair || '') && (L.outfit || '') === (c.look.outfit || '') && JSON.stringify(L.colors || {}) === JSON.stringify(c.look.colors || {});
const TABS = [
  { id: 'chara', name: 'キャラ', icon: '●', kind: 'items', focus: 'body', colors: [], crop: 'body', hint: 'キャラをえらぶと、顔・髪型・服・色がまとめて変わります。そのあと、髪型や服を1つずつ替えられます',
    items: P => (P.J.charas || []).map(c => ({ id: c.id, name: c.name })), get: () => '', on: (L, v, P) => { const c = (P.J.charas || []).find(q => q.id === v); return !!c && tmplOn(L, c); },
    set: (L, v, P) => { const c = (P.J.charas || []).find(q => q.id === v); if (!c) return; L.colors = { ...(c.look.colors || {}) }; L.hair = c.look.hair || ''; L.outfit = c.look.outfit || ''; if (c.look.kao) L.kao = c.look.kao; else delete L.kao; } },
  { id: 'hair', name: '髪型', icon: '✂', kind: 'items', focus: 'face', colors: ['hair'], items: P => hairList(P), get: L => L.hair || '', set: (L, v) => { L.hair = v; }, crop: 'face' },
  { id: 'face', name: '顔', icon: '☺', kind: 'items', focus: 'face', colors: ['skin', 'eye'], crop: 'face', items: P => kaoList(P), get: L => L.kao || '', set: (L, v) => { if (v) L.kao = v; else delete L.kao; } },
  // 服：絞りこみ（セット・トップス・ボトムス・くつ下・くつ）。parts.json の outfits の type（なければ 'set'＝上下そろい）で分ける
  { id: 'wear', name: '服', icon: '♥', kind: 'items', focus: 'body', colors: ['cloth'], crop: 'body',
    // 一覧：セット（上下そろい）と、部位ごと（'top:u01' のように「部位:番号」。番号なし＝その部位はインナー・なし）
    items: P => [...outfitList(P).map(u => ({ type: 'set', id: 'set:' + u.id, name: u.id ? u.name + 'セット' : 'ぜんぶインナー' })),
      ...WEAR_KEYS.flatMap(k => [{ type: k, id: k + ':', name: NONE[k] }, ...(P.J.wear?.[k] || []).map(u => ({ type: k, id: k + ':' + u.id, name: u.name }))])],
    get: L => 'set:' + (L.outfit || ''), on: (L, v) => { const [k, id] = v.split(':'), W = wearOf(L.outfit); return k === 'set' ? JSON.stringify(W) === JSON.stringify(wearOf(id)) : W[k] === id; },
    set: (L, v) => { const [k, id] = v.split(':'); if (k === 'set') L.outfit = id; else { const W = wearOf(L.outfit); W[k] = id; L.outfit = packWear(W); } },
    colorNote: L => (wearOf(L.outfit).top && wearOf(L.outfit).bottom ? '服の色は、インナーの見えている所だけ変わります' : ''),
    filters: [['all', 'すべて'], ['set', 'セット'], ['top', 'トップス'], ['bottom', 'ボトムス'], ['socks', 'くつ下'], ['shoes', 'くつ'], ['acc', '装飾品']] },
  // 体型：頭の大きさ・脚の長さ・あごの長さを、5段でえらぶ（look.shape。charaparts.js の「体型」）
  { id: 'shape', name: '体型', icon: '◆', kind: 'shape', focus: 'body', colors: [] },
  { id: 'coord', name: 'コーデ', icon: '★', kind: 'coord', focus: 'body', colors: [] },
];
const NONE = { top: 'インナー（上）', bottom: 'インナー（下）', socks: 'くつ下なし', shoes: 'はだし', acc: '装飾品なし' };
const clone = L => ({ colors: { ...(L?.colors || {}) }, hair: L?.hair || '', outfit: L?.outfit || '', ...(L?.shape ? { shape: L.shape } : {}), ...(L?.kao ? { kao: L.kao } : {}) });
const SHAPES = [['頭の大きさ', ['小さい', 'やや小さい', 'ふつう', 'やや大きい', '大きい']], ['脚の長さ', ['短い', 'やや短い', 'ふつう', 'やや長い', '長い']], ['あごの長さ', ['短い', 'やや短い', 'ふつう', 'やや長い', '長い']]];
const same = (a, b) => JSON.stringify(clone(a)) === JSON.stringify(clone(b));

let dataP = null;
const loadData = () => dataP || (dataP = Promise.all([loadParts(), fetch('assets/kamakura/data.json').then(r => r.json())]).then(([P, D]) => ({ P, D })).catch(e => { dataP = null; throw e; }));

// 見た目 L の立ちの絵を、cv に描く。crop：[x, y, w, h]（寄り用の絵の中の範囲）、z：何倍か
function draw(cv, { P, D }, L, lod, crop, z) {
  const src = sheet(P, L.hair || '', lod, L.outfit || '', '', L.shape || '', L.kao || '').px, [fw] = P.J[lod], pal = D.pal.chara.map((c, i) => recolorChara(c, i, D, L.colors || {}));
  // 体型を変えた絵は上へ長い：全身は上へ広げ、顔は動いた先へ合わせる
  const si = shapeInfo(P, lod, L.shape); if (si) crop = crop.face ? [crop[0], Math.max(0, crop[1] + si.dy - si.up), crop[2], crop[3]] : [crop[0], crop[1], crop[2], crop[3] + si.ext];
  const [cx, cy, cw, ch] = crop, out = new ImageData(cw, ch), o = out.data, p = src.data;
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
    const sx = cx + x, sy = cy + y; if (sx < 0 || sx >= fw || sy < 0 || sy >= src.height) continue;
    const q = (sy * src.width + sx) * 4, k = (y * cw + x) * 4; if (p[q + 3] < 128) continue;
    const c = pal[p[q]] || [255, 0, 255]; o[k] = c[0]; o[k + 1] = c[1]; o[k + 2] = c[2]; o[k + 3] = 255;
  }
  const t = document.createElement('canvas'); t.width = cw; t.height = ch; t.getContext('2d').putImageData(out, 0, 0);
  cv.width = cw * z; cv.height = ch * z; const x = cv.getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(t, 0, 0, cv.width, cv.height);
  return crop;
}
// 絵の中で、キャラがいる範囲（透明でない所）を1回だけ調べる。顔＝上から髪と顔が入る高さまで
function bounds(P, lod) {
  const k = 'bounds_' + lod; if (P[k]) return P[k];
  const [fw, fh] = P.J[lod]; let x0 = fw, x1 = 0, y0 = fh, y1 = 0;
  for (const h of ['', ...P.J.hairs.map(h => h.id)]) { const d = sheet(P, h, lod, '').px; for (let y = 0; y < fh; y += 2) for (let x = 0; x < fw; x += 2) if (d.data[(y * d.width + x) * 4 + 3] > 127) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } }
  const H = y1 - y0 + 1, mid = Math.round((x0 + x1) / 2), fs = Math.round(H * .44);
  return (P[k] = { body: [Math.max(0, x0 - 4), Math.max(0, y0 - 4), Math.min(fw, x1 + 5) - Math.max(0, x0 - 4), Math.min(fh, y1 + 3) - Math.max(0, y0 - 4)], face: Object.assign([Math.max(0, mid - Math.round(fs / 2)), Math.max(0, y0 - 6), fs, fs], { face: true }) });
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
      <div class="du-filters" hidden></div>
      <div class="du-colorbar"></div>
      <div class="du-body"><p class="du-load">読みこみ中…</p></div>
    </div>`;
  document.body.append(root); document.body.classList.add('du-open');
  const stage = root.querySelector('.du-stage'), cv = root.querySelector('.du-chara'), body = root.querySelector('.du-body'), bar = root.querySelector('.du-colorbar'), fbar = root.querySelector('.du-filters'), panel = root.querySelector('.du-panel');
  const flt = {};   // タブごとの絞りこみ
  let whole = false;   // 「全身」を押している間は、どのタブでも全身を見せる
  // 上のキャラを描く。入りきる大きさで、いちばん大きく。全身を見せるときは、寄り用の絵（360ドット）がそのまま入るように、下の枠を少しちぢめる
  //   それでも入らない小さな画面では、半分の細かさの絵を使う（ドットが割り切れるように）
  const paint = () => {
    if (!env) return; const kind = (whole || tab.focus === 'body') ? 'body' : 'face';
    let lod = 'close', crop = bounds(env.P, lod)[kind];
    const free = root.clientHeight - root.querySelector('.du-top').offsetHeight, max = Math.min(free * .56, 470), min = Math.min(max, 300);
    panel.style.height = Math.round(Math.max(min, Math.min(max, free - crop[3] * (kind === 'body' ? 1 : 2) - 22))) + 'px';   // 顔は2倍、全身は1倍がちょうど入る高さに
    const fit = c => Math.min((stage.clientHeight - 20) / c[3], (stage.clientWidth - 16) / c[2]); let z = Math.floor(fit(crop));
    if (z < 1) { lod = 'normal'; crop = bounds(env.P, lod)[kind]; z = Math.max(1, Math.floor(fit(crop))); }
    const used = draw(cv, env, L, lod, crop, 1), zz = Math.min(z, (stage.clientHeight - 12) / used[3]); cv.style.width = used[2] * zz + 'px'; cv.style.height = used[3] * zz + 'px';
  };
  const change = (fn, keep = true) => { if (keep) { hist.push(clone(L)); if (hist.length > 30) hist.shift(); } fn(L); root.querySelector('[data-a=undo]').disabled = !hist.length; paint(); renderBody(false); onChange?.(clone(L)); };
  // 色の帯：いつも見える所（タブのすぐ下）に、その部位の色を横1列で出す。多いときは横にすべらせる
  const renderBar = () => { bar.innerHTML = tab.colors.map(swatches).join('') + (tab.colorNote?.(L) ? `<p class="du-note">${esc(tab.colorNote(L))}</p>` : ''); bar.hidden = !tab.colors.length;
    fbar.hidden = !tab.filters; if (tab.filters) fbar.innerHTML = tab.filters.map(([id, nm]) => `<button data-flt="${id}" aria-pressed="${(flt[tab.id] || 'all') === id}">${nm}</button>`).join(''); };
  const swatches = k => { const cur = L.colors[k] || '', list = MORE[k] || COLORS[k].presets;
    return `<div class="du-colors" data-k="${k}"><span class="du-lab">${COLORS[k].name}の色</span><div class="du-sws"><button class="du-sw none" data-c="" aria-pressed="${!cur}" aria-label="${COLORS[k].name}を元の色に">元</button>${list.map(h => `<button class="du-sw" data-c="${h}" style="background:${h}" aria-pressed="${cur.toLowerCase() === h}" aria-label="${COLORS[k].name}を ${h} に"></button>`).join('')}<label class="du-sw pick${cur && !list.includes(cur.toLowerCase()) ? ' on' : ''}" aria-label="${COLORS[k].name}の色を自由にえらぶ"><input type="color" value="${cur || list[0]}"><span aria-hidden="true">＋</span></label></div></div>`; };
  const coords = () => settings.charaCoords || [];
  // 下の一覧を描く。full＝タブを切りかえたとき（絵から作り直す）。そうでなければ、えらんだ印と色だけ直す
  function renderBody(full = true) {
    if (!env) return; renderBar();
    if (!full && tab.kind !== 'coord' && tab.kind !== 'shape') { body.querySelectorAll('.du-item').forEach(b => b.setAttribute('aria-pressed', String(tab.on ? tab.on(L, b.dataset.v, env.P) : b.dataset.v === tab.get(L)))); if (tab.kind === 'items') thumbs(); return; }
    if (tab.kind === 'shape') {
      const st = shapeSteps(L.shape);
      body.innerHTML = `<p class="du-hint">頭・脚・あごの長さで、幼く／大人っぽく見せます。服や髪は、そのまま合います</p>` + SHAPES.map(([nm, labs], i) => `<div class="du-shape"><span class="du-lab">${nm}</span><div class="du-steps">${labs.map((l, k) => `<button data-shape="${i}:${k - 2}" aria-pressed="${st[i] === k - 2}">${l}</button>`).join('')}</div></div>`).join('')
        + `<div class="du-shape"><button data-shape="reset" ${L.shape ? '' : 'disabled'}>体型を元にもどす</button></div>`;
      return;
    }
    if (tab.kind === 'coord') {
      const cs = coords();
      body.innerHTML = `<p class="du-hint">気に入った組み合わせを残して、1回で着替えられます（${cs.length}／12）</p><div class="du-grid coord"><button class="du-item add" data-a="addcoord" ${cs.length >= 12 ? 'disabled' : ''}><span class="du-plus" aria-hidden="true">＋</span><span class="du-nm">いまのコーデを残す</span></button>${cs.map((c, i) => `<div class="du-cell"><button class="du-item" data-coord="${i}" aria-pressed="${same(c.look, L)}"><canvas></canvas><span class="du-nm">${esc(c.name)}</span></button><button class="du-del" data-del="${i}" aria-label="${esc(c.name)}を消す">×</button></div>`).join('')}</div>`;
      const B = bounds(env.P, 'normal'); body.querySelectorAll('[data-coord]').forEach(b => draw(b.querySelector('canvas'), env, clone(cs[+b.dataset.coord].look), 'normal', B.body, 1));
      return;
    }
    const f = flt[tab.id] || 'all', all = tab.kind === 'items' ? tab.items(env.P) : [], items = all.filter(it => f === 'all' || (it.type ? it.type === f : !it.id || f === 'set'));
    const none = tab.kind === 'items' && f !== 'all' && !items.some(it => it.id && !it.id.endsWith(':'));
    body.innerHTML = tab.kind !== 'items' ? '<p class="du-hint">上の色をえらぶと、キャラの色が変わります</p>'
      : none ? `<p class="du-hint">「${esc(tab.filters.find(x => x[0] === f)[1])}」の服は、まだありません</p>`
      : `${tab.hint ? `<p class="du-hint">${esc(tab.hint)}</p>` : ''}<div class="du-grid ${tab.crop}">${items.map(it => `<button class="du-item" data-v="${esc(it.id)}" aria-pressed="${tab.on ? tab.on(L, it.id, env.P) : it.id === tab.get(L)}"><canvas></canvas><span class="du-nm">${esc(it.name)}</span></button>`).join('')}</div>`;
    thumbs();
  }
  // 一覧の小さな絵：そのアイテムだけを替えた見た目（色はいまのまま）
  function thumbs() {
    const B = bounds(env.P, 'normal');
    body.querySelectorAll('.du-item[data-v]').forEach(b => { const t = clone(L); delete t.shape; tab.set(t, b.dataset.v, env.P); draw(b.querySelector('canvas'), env, t, 'normal', B[tab.crop], 1); });
  }
  const close = () => { root.remove(); document.body.classList.remove('du-open'); removeEventListener('resize', paint); document.removeEventListener('keydown', onKey); onClose?.(); };
  const onKey = e => { if (e.key === 'Escape') { e.preventDefault(); root.querySelector('[data-a=cancel]').click(); } };
  root.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return; const a = b.dataset.a;
    if (b.dataset.flt) { flt[tab.id] = b.dataset.flt; renderBody(); }
    else if (b.dataset.shape) {
      const st = shapeSteps(L.shape); if (b.dataset.shape === 'reset') st.fill(0); else { const [i, v] = b.dataset.shape.split(':').map(Number); if (st[i] === v) return; st[i] = v; }
      change(x => { const k = packShape(...st); if (k) x.shape = k; else delete x.shape; }); renderBody();
    }
    else if (b.dataset.tab) { tab = TABS.find(t => t.id === b.dataset.tab); root.querySelectorAll('[data-tab]').forEach(x => x.setAttribute('aria-selected', String(x === b))); paint(); renderBody(); }
    else if (b.dataset.v !== undefined) { if (!(tab.on ? tab.on(L, b.dataset.v, env.P) : tab.get(L) === b.dataset.v)) change(x => tab.set(x, b.dataset.v, env.P)); }
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
