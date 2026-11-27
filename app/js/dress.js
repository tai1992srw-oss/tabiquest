// お着替え（キャラクリ）の画面（2026-11-26 作り替え）。ホームと撮影で同じ部品を使う。ちがうのは保存先だけ（ホーム＝ふだんの見た目、撮影＝そのカードだけ）
//   上＝キャラ（いつも見える）／下＝ふだんは「服・髪・コーデ」のタブ → 絵つきの一覧。「顔をつくる」で、輪郭・目・まゆ・口・ほおと、「バランス」→ 1ドットずつ動かすスライダー、「コーデ」→ 残した組み合わせ
//   見た目（look）と、絵の組み立ては chara2.js。絵は描き足さない
//   輪郭を替えると、バランスはその輪郭のプリセットになる（そこから自由に動かせる）
import { settings, saveSettings } from './store.js';
import { loadParts, itemList, toggleItem, WEAR_PARTS, WEAR_NAMES, pickWear, wearOn, wearItems, wearName, SLOTS, NONE, VALS, HAIR_VALS, COLORS, presetOf, charaLook, charaName, fixLook, has, itemName, drawLook, cropOf, bigWears, bigHairs, bigParts, bigWearOn, bigPickWear, bigHairStyles, WEAR15_PARTS, HAIR15_VALS, bigItems, toggleItem15 } from './chara2.js';
import { esc, toast } from './ui.js';

const ICON = { rin: '◯', eye: '◉', brow: '⌒', mouth: '◡', cheek: '❀', hairF: '✂', hairB: '≋', wear: '♥' };
const slot = id => ({ id, name: SLOTS.find(q => q[0] === id)[1], icon: ICON[id], kind: 'slot', focus: id === 'wear' ? 'body' : 'face' });
// ふだんのお着替え：服・髪・コーデ。顔（輪郭・目・まゆ・口・ほお・バランス）は、ふだんはさわらないので、「顔をつくる」を押したときだけ出す
// 髪は、前髪と後ろ髪をセットでえらぶ（look の hairF と hairB に、同じ物を入れる）
// 服のタブ：上の絞りこみ（セット・トップス・ボトムス・足もと）で、ひとそろいと部分を切りかえる
const DRESS = [{ id: 'wear', name: '服', icon: ICON.wear, kind: 'wear', focus: 'body' }, { id: 'hair', name: '髪', icon: ICON.hairF, kind: 'slot', focus: 'face' }, { id: 'items', name: '小物', icon: '✿', kind: 'items', focus: 'body' }, { id: 'coord', name: 'コーデ', icon: '★', kind: 'coord', focus: 'body' }];
const FACE = [{ id: 'chara', name: 'キャラ', icon: '☻', kind: 'chara', focus: 'body' }, slot('rin'), slot('eye'), slot('brow'), slot('mouth'), slot('cheek'), { id: 'bal', name: 'バランス', icon: '⇔', kind: 'bal', focus: 'face' }];
// 1.5倍のキャラ（キャラ1b・キャラ0）：服（Tシャツ・デザインの服・素体）と髪の色だけえらべる。顔の部品・バランス・小物は、まだ合わない
const DRESS15 = [{ id: 'w15', name: '服', icon: ICON.wear, kind: 'w15', focus: 'body' }, { id: 'h15', name: '髪', icon: ICON.hairF, kind: 'h15', focus: 'face' }, { id: 'items15', name: '小物', icon: '✿', kind: 'items15', focus: 'face' }, DRESS[3]];
const FACE15 = [FACE[0], { id: 'skin15', name: '肌の色', icon: '◯', kind: 'skin15', focus: 'body' }];
const clone = L => JSON.parse(JSON.stringify(L));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// お着替えの画面をひらく
//   look：はじめの見た目（空なら、はじめの見た目）。home：ふだんの見た目（「ホームに合わせる」ボタン用。ホームからひらくときは渡さない）
//   title・note：上に出す言葉。onChange(look)：えらぶたび。onSave(look)：決定。onClose()：とじたとき（決定でも取り消しでも）
export function openDress({ look, home = null, title = 'お着替え', note = '', onChange, onSave, onClose } = {}) {
  document.querySelector('.dressup')?.remove();
  let wf = 'set';   // 服の絞りこみ
  let P = null, first = null, L = null, homeL = null, TABS = DRESS, tab = TABS[0], hist = [], whole = false, faceMode = false;
  // タブの組：ふつうのキャラか 1.5倍のキャラか、「顔をつくる」か で変わる
  const syncTabs = () => { const T = L?.big ? (faceMode ? FACE15 : DRESS15) : (faceMode ? FACE : DRESS); if (T !== TABS) { TABS = T; if (!TABS.includes(tab)) tab = TABS[0]; renderTabs(); return true; } return false; };
  const root = document.createElement('div'); root.className = 'dressup'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-label', title);
  root.innerHTML = `
    <div class="du-top"><button class="du-x" data-a="cancel" aria-label="やめてとじる">×</button><div class="du-ttl"><b>${esc(title)}</b>${note ? `<small>${esc(note)}</small>` : ''}</div><button class="du-ok" data-a="save">決定</button></div>
    <div class="du-stage"><canvas class="du-chara" aria-label="いまの見た目"></canvas>
      <div class="du-tools"><button data-a="undo" disabled>1つ戻す</button>${home ? '<button data-a="home">ホームに合わせる</button>' : ''}<button data-a="zoom" aria-pressed="false">全身</button><button data-a="face" aria-pressed="false">顔をつくる</button></div></div>
    <div class="du-panel">
      <div class="du-tabs" role="tablist"></div>
      <div class="du-body"><p class="du-load">読みこみ中…</p></div>
    </div>`;
  document.body.append(root); document.body.classList.add('du-open');
  const tabsEl = root.querySelector('.du-tabs');
  const renderTabs = () => { tabsEl.innerHTML = TABS.map(t => `<button role="tab" data-tab="${t.id}" aria-selected="${t === tab}"><i aria-hidden="true">${t.icon}</i><span>${t.name}</span></button>`).join(''); };
  renderTabs();
  const stage = root.querySelector('.du-stage'), cv = root.querySelector('.du-chara'), body = root.querySelector('.du-body'), panel = root.querySelector('.du-panel');
  // 上のキャラを描く。入りきる大きさで、いちばん大きく（ドットが割り切れる倍率で）
  const paint = () => {
    if (!P) return; const kind = whole || tab.focus === 'body' ? 'body' : 'face', crop = cropOf(P, L, kind);
    const free = root.clientHeight - root.querySelector('.du-top').offsetHeight, max = Math.min(free * .56, 470), min = Math.min(max, 300);
    panel.style.height = Math.round(Math.max(min, Math.min(max, free - crop[3] * (kind === 'body' ? 1 : 2) - 22))) + 'px';
    const z = Math.max(.5, Math.floor(Math.min((stage.clientHeight - 20) / crop[3], (stage.clientWidth - 16) / crop[2]) * 2) / 2);
    drawLook(cv, P, L, kind); cv.style.width = crop[2] * z + 'px'; cv.style.height = crop[3] * z + 'px';
  };
  const change = (fn, keep = true) => { if (keep) { hist.push(clone(L)); if (hist.length > 40) hist.shift(); } fn(L); root.querySelector('[data-a=undo]').disabled = !hist.length; const sw = syncTabs(); paint(); renderBody(sw); onChange?.(clone(L)); };
  const coords = () => (settings.chara2Coords || []).filter(c => c.look?.rin || c.look?.big);
  // 下の一覧を描く。full＝タブを切りかえたとき（絵から作り直す）。そうでなければ、えらんだ印と数字だけ直す
  function renderBody(full = true) {
    if (!P) return;
    if (tab.kind === 'w15') {   // b版の服：上の絞りこみ（セット・トップス・ボトムス・くつ）で、ひとそろいと部分を切りかえる。部分は、キャラをこえて組み合わせられる
      const f = wf, list = f === 'set' ? bigWears(P, L.big) : [['', 'なし'], ...bigParts(P, f)];
      if (full) body.innerHTML = `<div class="du-chips">${[['set', 'セット'], ...WEAR15_PARTS].map(([k, n]) => `<button data-wf="${k}" aria-pressed="${k === f}">${n}</button>`).join('')}</div><div class="du-shape"><button data-a="tuck15"></button></div><div class="du-grid body">${list.map(([k, n]) => `<button class="du-item" data-w15="${esc(k)}"><canvas></canvas><span class="du-nm">${esc(n)}</span></button>`).join('')}</div>`;
      const tb = body.querySelector('[data-a=tuck15]'); if (tb) { const ok = L.w15 === 'parts' && L.p15?.top && L.p15?.bottom; tb.disabled = !ok; tb.setAttribute('aria-pressed', String(!!L.tuck15)); tb.textContent = L.tuck15 ? 'トップス：中に入れている（押すと外に出す）' : 'トップス：外に出している（押すと中に入れる）'; }
      body.querySelectorAll('[data-w15]').forEach(b => { const v = b.dataset.w15; b.setAttribute('aria-pressed', String(bigWearOn(P, L, f, v))); const t = clone(L); bigPickWear(P, t, f, v); drawLook(b.querySelector('canvas'), P, fixLook(P, t), 'body'); });
    } else if (tab.kind === 'h15') {   // b版の髪：髪型（みんなの髪）と、髪の色（プリセット）
      if (full) body.innerHTML = `<div class="du-colors"><span class="du-lab">髪の色</span><div class="du-sws"><button class="du-sw none" data-h15="" aria-label="髪の色を元の色に">元</button>${bigHairs(P).map(([k, c]) => `<button class="du-sw" data-h15="${esc(k)}" style="background:${c}" aria-label="${esc(k)}" title="${esc(k)}"></button>`).join('')}</div></div><div class="du-grid face">${bigHairStyles(P).map(([c, n]) => `<button class="du-item" data-hs15="${c}"><canvas></canvas><span class="du-nm">${esc(n)}</span></button>`).join('')}</div>`;
      if (full) body.insertAdjacentHTML('beforeend', `<p class="du-hint">髪は、頭の大きさに合わせて置きます。合わないときは、ここで直せます（±0＝頭に合わせた所）</p>${sliders(HAIR15_VALS)}<div class="du-shape"><button data-a="hair15_0">髪の大きさと位置をもどす</button></div>`);
      setSliders();
      body.querySelectorAll('[data-h15]').forEach(b => b.setAttribute('aria-pressed', String((L.h15 || '') === b.dataset.h15)));
      body.querySelectorAll('[data-hs15]').forEach(b => { const c = b.dataset.hs15; b.setAttribute('aria-pressed', String((L.hair15 || L.big) === c)); drawLook(b.querySelector('canvas'), P, fixLook(P, { ...L, hair15: c }), 'face'); });
    } else if (tab.kind === 'items15') {   // b版の小物・装飾品：押すと付ける・はずす
      if (full) body.innerHTML = `<p class="du-hint">押すと付けたり、はずしたりできます</p><div class="du-grid face"><button class="du-item" data-it15=""><canvas></canvas><span class="du-nm">ぜんぶはずす</span></button>${bigItems(P).map(([id, n]) => `<button class="du-item" data-it15="${esc(id)}"><canvas></canvas><span class="du-nm">${esc(n)}</span></button>`).join('')}</div>`;
      body.querySelectorAll('[data-it15]').forEach(b => { const id = b.dataset.it15, on = id ? (L.items15 || []).includes(id) : !(L.items15 || []).length; b.setAttribute('aria-pressed', String(on)); const t = clone(L); if (id) { if (!on) toggleItem15(P, t, id); } else t.items15 = []; drawLook(b.querySelector('canvas'), P, t, 'face'); });
    } else if (tab.kind === 'skin15') {   // b版の肌の色：体と頭の肌を、えらんだ色に寄せる
      if (full) body.innerHTML = `${swatches('skin')}<p class="du-hint">体と顔の肌の色が変わります。服の色は変わりません</p>`;
      markColors('skin');
    } else if (tab.kind === 'items') {   // 持ち物・かざり：押すと付ける・はずす（同じ所に付く物は入れかわる）。いくつでも組み合わせられる
      if (full) body.innerHTML = `<p class="du-hint">押すと付けたり、はずしたりできます。同じ所に付く物（右手の紙袋とぬいぐるみなど）は、入れかわります</p><div class="du-grid body"><button class="du-item" data-it=""><canvas></canvas><span class="du-nm">ぜんぶはずす</span></button>${itemList(P).map(it => `<button class="du-item" data-it="${it.id}"><canvas></canvas><span class="du-nm">${esc(it.name)}</span></button>`).join('')}</div>`;
      body.querySelectorAll('[data-it]').forEach(b => { const id = b.dataset.it, on = id ? (L.items || []).includes(id) : !(L.items || []).length; b.setAttribute('aria-pressed', String(on)); const t = clone(L); if (id) { if (!on) toggleItem(P, t, id); } else delete t.items; drawLook(b.querySelector('canvas'), P, t, 'body'); });
    } else if (tab.kind === 'wear') {
      const f = wf; if (full) body.innerHTML = `<div class="du-chips">${['set', ...WEAR_PARTS].map(k => `<button data-wf="${k}" aria-pressed="${k === f}">${WEAR_NAMES[k]}</button>`).join('')}</div><div class="du-grid body">${wearItems(P, f).map(v => `<button class="du-item" data-w="${v}"><canvas></canvas><span class="du-nm">${esc(wearName(P, f, v))}</span></button>`).join('')}</div>${f === 'set' ? '' : '<p class="du-hint">上下つながった服（ワンピースなど）を着ているときにボトムスをえらぶと、トップスはインナーになります</p>'}`;
      body.querySelectorAll('[data-w]').forEach(b => { b.setAttribute('aria-pressed', String(wearOn(P, L, f, b.dataset.w))); const t = clone(L); pickWear(P, t, f, b.dataset.w); drawLook(b.querySelector('canvas'), P, t, 'body'); });
    } else if (tab.kind === 'slot') {
      const ids = P.ids.filter(c => has(P, tab.id, c)).concat(NONE[tab.id] ? [''] : []);
      // 髪のタブには、髪の大きさ・位置の調整も出す（輪郭に合わせた所から、どれだけ変えるか）
      const adj = tab.id === 'hair' ? `<p class="du-hint">髪は、輪郭の大きさに合わせて置きます。合わないときは、ここで直せます</p>${sliders(HAIR_VALS)}<div class="du-shape"><button data-a="hair0">髪の大きさと位置をもどす</button></div>` : '';
      const ck = { hair: 'hair', rin: 'skin', eye: 'eye' }[tab.id] || '';   // 色をえらべるタブ：髪＝髪の色、輪郭＝肌の色、目＝目の色
      if (full) body.innerHTML = `${ck ? swatches(ck) : ''}<div class="du-grid ${tab.focus}">${ids.map(c => `<button class="du-item" data-v="${c}"><canvas></canvas><span class="du-nm">${esc(itemName(P, tab.id, c))}</span></button>`).join('')}</div>${tab.id === 'rin' ? '<p class="du-hint">輪郭を替えると、顔のバランスは、その輪郭に合う値になります</p>' : ''}${adj}`;
      setSliders(); if (ck) markColors(ck);
      body.querySelectorAll('.du-item').forEach(b => { b.setAttribute('aria-pressed', String(cur(L, tab.id) === b.dataset.v)); const t = clone(L); pick(t, tab.id, b.dataset.v); drawLook(b.querySelector('canvas'), P, t, tab.focus); });
    } else if (tab.kind === 'chara') {   // キャラのプリセット：部品とバランスを、そのキャラのひとそろいにする
      if (full) body.innerHTML = `<p class="du-hint">キャラをえらぶと、顔・髪・服・バランスが、そのキャラのひとそろいになります。そこから自由に変えられます</p><div class="du-grid coord">${[...P.ids, ...P.bigIds].map(c => `<button class="du-item" data-chara="${c}"><canvas></canvas><span class="du-nm">${esc(charaName(P, c))}</span></button>`).join('')}</div>`;
      body.querySelectorAll('[data-chara]').forEach(b => { const t = fixLook(P, charaLook(P, b.dataset.chara)); b.setAttribute('aria-pressed', String(same(t, fixLook(P, L)))); drawLook(b.querySelector('canvas'), P, t, 'body'); });
    } else if (tab.kind === 'bal') {
      if (full) body.innerHTML = `<p class="du-hint">1ドットずつ動かせます。数字は、キャラ1の顔を ±0 とした差です。「もどす」で、いまの輪郭に合う値にもどります</p>${sliders(VALS)}<div class="du-shape"><button data-a="preset">輪郭に合う値にもどす</button></div>`;
      setSliders();
    } else {
      const cs = coords();
      body.innerHTML = `<p class="du-hint">気に入った組み合わせを残して、1回で着替えられます（${cs.length}／12）</p><div class="du-grid coord"><button class="du-item add" data-a="addcoord" ${cs.length >= 12 ? 'disabled' : ''}><span class="du-plus" aria-hidden="true">＋</span><span class="du-nm">いまの見た目を残す</span></button>${cs.map((c, i) => `<div class="du-cell"><button class="du-item" data-coord="${i}" aria-pressed="${same(fixLook(P, c.look), L)}"><canvas></canvas><span class="du-nm">${esc(c.name)}</span></button><button class="du-del" data-del="${i}" aria-label="${esc(c.name)}を消す">×</button></div>`).join('')}</div>`;
      body.querySelectorAll('[data-coord]').forEach(b => drawLook(b.querySelector('canvas'), P, fixLook(P, cs[+b.dataset.coord].look), 'body'));
    }
  }
  // 色の列：元の色・候補・自由にえらぶ
  const swatches = k => `<div class="du-colors" data-k="${k}"><span class="du-lab">${COLORS[k].name}</span><div class="du-sws"><button class="du-sw none" data-c="" aria-label="${COLORS[k].name}を元の色に">元</button>${COLORS[k].list.map(h => `<button class="du-sw" data-c="${h}" style="background:${h}" aria-label="${h}"></button>`).join('')}<label class="du-sw pick" aria-label="${COLORS[k].name}を自由にえらぶ"><input type="color" value="${COLORS[k].list[0]}"><span>＋</span></label></div></div>`;
  const markColors = k => { const cur = L.colors?.[k] || '', box = body.querySelector(`.du-colors[data-k="${k}"]`); if (!box) return; let hit = false;
    box.querySelectorAll('button.du-sw').forEach(b => { const on = b.dataset.c.toLowerCase() === cur.toLowerCase(); hit = hit || on; b.setAttribute('aria-pressed', String(on)); });
    const pk = box.querySelector('.pick'); pk.classList.toggle('on', !!cur && !hit); pk.style.background = cur && !hit ? cur : ''; if (cur) pk.querySelector('input').value = cur; };
  const setColor = (x, k, hex) => { const c = { ...(x.colors || {}) }; if (hex) c[k] = hex; else delete c[k]; if (Object.keys(c).length) x.colors = c; else delete x.colors; };
  const sliders = list => list.map(([k, nm, mn, mx, hint]) => `<div class="du-sl" data-k="${k}"><b>${nm}</b><button data-d="-1" aria-label="${nm}を1へらす">−</button><input type="range" min="${mn}" max="${mx}" step="1" aria-label="${nm}"><button data-d="1" aria-label="${nm}を1ふやす">＋</button><output></output><small>${hint}</small></div>`).join('');
  const sg = n => (n > 0 ? '+' + n : n === 0 ? '±0' : String(n));   // どの値も、キャラ1（髪は、輪郭に合わせた所）を ±0 として見せる
  // スライダーの値：b版は髪の調整（look.hv15）、前の版は look.v
  const vGet = (x, k) => (x.big ? +(x.hv15?.[k] || 0) : x.v[k]);
  const vSet = (x, k, n) => { if (!x.big) { x.v[k] = n; return; } const h = { ...(x.hv15 || {}) }; if (n) h[k] = n; else delete h[k]; if (Object.keys(h).length) x.hv15 = h; else delete x.hv15; };
  const setSliders = () => body.querySelectorAll('.du-sl').forEach(s => { s.querySelector('input').value = vGet(L, s.dataset.k); s.querySelector('output').textContent = sg(vGet(L, s.dataset.k)); });
  // 部品を替える。輪郭を替えたら、バランスをその輪郭のプリセットにする
  const pick = (t, k, c) => { if (k === 'hair') { t.hairF = c; t.hairB = c; } else t[k] = c; if (k === 'rin') t.v = presetOf(P, c, t.v); };
  const cur = (t, k) => (k === 'hair' ? (t.hairF === t.hairB ? t.hairF : null) : t[k]);   // 前髪と後ろ髪がちがう見た目（前に残した物）は、どれにも印を付けない
  const close = () => { root.remove(); document.body.classList.remove('du-open'); removeEventListener('resize', paint); document.removeEventListener('keydown', onKey); onClose?.(); };
  const onKey = e => { if (e.key === 'Escape') { e.preventDefault(); root.querySelector('[data-a=cancel]').click(); } };
  root.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b || !P) { if (b?.dataset.a === 'cancel') close(); return; } const a = b.dataset.a;
    if (b.dataset.tab) { tab = TABS.find(t => t.id === b.dataset.tab); root.querySelectorAll('[data-tab]').forEach(x => x.setAttribute('aria-selected', String(x === b))); paint(); renderBody(); }
    else if (b.dataset.w15 !== undefined) { const v = b.dataset.w15; if (!bigWearOn(P, L, wf, v)) change(x => { bigPickWear(P, x, wf, v); Object.assign(x, fixLook(P, x)); }); }
    else if (b.dataset.it15 !== undefined) { const id = b.dataset.it15; if (id) change(x => toggleItem15(P, x, id)); else if ((L.items15 || []).length) change(x => { x.items15 = []; }); }
    else if (b.dataset.hs15) { const c = b.dataset.hs15; if ((L.hair15 || L.big) !== c) change(x => { if (c === x.big) delete x.hair15; else x.hair15 = c; }); }
    else if (b.dataset.h15 !== undefined) { if ((L.h15 || '') !== b.dataset.h15) change(x => { x.h15 = b.dataset.h15; }); }
    else if (b.dataset.chara) { const t = fixLook(P, charaLook(P, b.dataset.chara)); if (!same(t, fixLook(P, L))) change(x => { for (const k of Object.keys(x)) delete x[k]; Object.assign(x, t); }); }
    else if (b.dataset.c !== undefined) { const k = b.closest('.du-colors').dataset.k; if ((L.colors?.[k] || '') !== b.dataset.c) change(x => setColor(x, k, b.dataset.c)); }
    else if (b.dataset.it !== undefined) { const id = b.dataset.it; if (id) change(x => toggleItem(P, x, id)); else if ((L.items || []).length) change(x => { delete x.items; }); }
    else if (b.dataset.wf) { wf = b.dataset.wf; renderBody(); }
    else if (b.dataset.w !== undefined) { if (!wearOn(P, L, wf, b.dataset.w)) change(x => pickWear(P, x, wf, b.dataset.w)); }
    else if (b.dataset.v !== undefined) { if (cur(L, tab.id) !== b.dataset.v) change(x => pick(x, tab.id, b.dataset.v)); }
    else if (b.dataset.d) { const s = b.closest('.du-sl'), r = s.querySelector('input'), k = s.dataset.k, nv = Math.max(+r.min, Math.min(+r.max, vGet(L, k) + +b.dataset.d)); if (nv !== vGet(L, k)) change(x => vSet(x, k, nv)); }
    else if (a === 'tuck15') change(x => { if (x.tuck15) delete x.tuck15; else x.tuck15 = true; });
    else if (a === 'hair15_0') { if (L.hv15) change(x => { delete x.hv15; }); }
    else if (a === 'preset') { const pv = presetOf(P, L.rin, L.v); if (!same(pv, L.v)) change(x => { x.v = pv; }); }
    else if (a === 'hair0') { if (HAIR_VALS.some(([k]) => L.v[k])) change(x => { for (const [k] of HAIR_VALS) x.v[k] = 0; }); }
    else if (b.dataset.coord !== undefined) { const c = coords()[+b.dataset.coord]; if (c) { change(x => { for (const k of Object.keys(x)) delete x[k]; Object.assign(x, fixLook(P, c.look)); }); renderBody(); } }
    else if (b.dataset.del !== undefined) { const cs = coords().slice(), c = cs[+b.dataset.del]; if (c && confirm(`「${c.name}」を消しますか？`)) { cs.splice(+b.dataset.del, 1); settings.chara2Coords = cs; saveSettings(); renderBody(); } }
    else if (a === 'addcoord') { const cs = coords().slice(), name = (prompt('コーデの名前', `コーデ${cs.length + 1}`) || '').trim().slice(0, 12); if (!name) return; cs.push({ name, look: clone(L) }); settings.chara2Coords = cs; saveSettings(); renderBody(); toast(`「${name}」を残しました`); }
    else if (a === 'undo') { const p = hist.pop(); if (p) { L = p; b.disabled = !hist.length; syncTabs(); paint(); renderBody(); onChange?.(clone(L)); } }
    else if (a === 'home' && homeL) { if (!same(L, homeL)) { change(x => { for (const k of Object.keys(x)) delete x[k]; Object.assign(x, clone(homeL)); }); renderBody(); } }
    else if (a === 'face') {   // 「顔をつくる」の入り切り：下のタブを、顔の部品とバランスに切りかえる
      faceMode = !faceMode; syncTabs(); tab = TABS[0]; renderTabs(); b.setAttribute('aria-pressed', String(faceMode)); b.textContent = faceMode ? 'お着替えにもどる' : '顔をつくる'; paint(); renderBody();
    }
    else if (a === 'zoom') { whole = !whole; b.setAttribute('aria-pressed', String(whole)); paint(); }
    else if (a === 'save') { onSave?.(clone(L)); close(); }
    else if (a === 'cancel') { if (!same(L, first)) { if (!confirm('えらんだお着替えをやめて、とじますか？')) return; onChange?.(clone(first)); } close(); }
  });
  // スライダー：動かしている間はキャラだけ描き直し、はなしたら1回ぶんとして残す
  let sliding = null;
  root.addEventListener('input', e => {
    if (!P) return;
    if (e.target.type === 'color') { const k = e.target.closest('.du-colors').dataset.k; if (!sliding) sliding = clone(L); setColor(L, k, e.target.value); markColors(k); paint(); onChange?.(clone(L)); return; }   // 色を自由にえらぶ
    const s = e.target.closest('.du-sl'); if (!s) return; if (!sliding) sliding = clone(L); vSet(L, s.dataset.k, +e.target.value); s.querySelector('output').textContent = sg(+e.target.value); paint(); onChange?.(clone(L));
  });
  root.addEventListener('change', e => { if (!(e.target.closest('.du-sl') || e.target.type === 'color') || !sliding) return; hist.push(sliding); sliding = null; root.querySelector('[data-a=undo]').disabled = false; renderBody(false); });
  addEventListener('resize', paint); document.addEventListener('keydown', onKey);
  loadParts().then(v => { P = v; L = fixLook(P, look); first = clone(L); homeL = home ? fixLook(P, home) : null; syncTabs(); paint(); renderBody(); }).catch(() => { body.innerHTML = '<p class="du-load">キャラの絵を読みこめませんでした</p>'; });
  root.querySelector('.du-ok').focus({ preventScroll: true });
  return close;
}
