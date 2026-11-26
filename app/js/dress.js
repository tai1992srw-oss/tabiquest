// お着替え（キャラクリ）の画面（2026-11-26 作り替え）。ホームと撮影で同じ部品を使う。ちがうのは保存先だけ（ホーム＝ふだんの見た目、撮影＝そのカードだけ）
//   上＝キャラ（いつも見える）／下＝ふだんは「服・髪・コーデ」のタブ → 絵つきの一覧。「顔をつくる」で、輪郭・目・まゆ・口・ほおと、「バランス」→ 1ドットずつ動かすスライダー、「コーデ」→ 残した組み合わせ
//   見た目（look）と、絵の組み立ては chara2.js。絵は描き足さない
//   輪郭を替えると、バランスはその輪郭のプリセットになる（そこから自由に動かせる）
import { settings, saveSettings } from './store.js';
import { loadParts, SLOTS, NONE, VALS, HAIR_VALS, COLORS, presetOf, fixLook, has, itemName, drawLook, cropOf } from './chara2.js';
import { esc, toast } from './ui.js';

const ICON = { rin: '◯', eye: '◉', brow: '⌒', mouth: '◡', cheek: '❀', hairF: '✂', hairB: '≋', wear: '♥' };
const slot = id => ({ id, name: SLOTS.find(q => q[0] === id)[1], icon: ICON[id], kind: 'slot', focus: id === 'wear' ? 'body' : 'face' });
// ふだんのお着替え：服・髪・コーデ。顔（輪郭・目・まゆ・口・ほお・バランス）は、ふだんはさわらないので、「顔をつくる」を押したときだけ出す
// 髪は、前髪と後ろ髪をセットでえらぶ（look の hairF と hairB に、同じ物を入れる）
const DRESS = [slot('wear'), { id: 'hair', name: '髪', icon: ICON.hairF, kind: 'slot', focus: 'face' }, { id: 'coord', name: 'コーデ', icon: '★', kind: 'coord', focus: 'body' }];
const FACE = [slot('rin'), slot('eye'), slot('brow'), slot('mouth'), slot('cheek'), { id: 'bal', name: 'バランス', icon: '⇔', kind: 'bal', focus: 'face' }];
const clone = L => JSON.parse(JSON.stringify(L));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// お着替えの画面をひらく
//   look：はじめの見た目（空なら、はじめの見た目）。home：ふだんの見た目（「ホームに合わせる」ボタン用。ホームからひらくときは渡さない）
//   title・note：上に出す言葉。onChange(look)：えらぶたび。onSave(look)：決定。onClose()：とじたとき（決定でも取り消しでも）
export function openDress({ look, home = null, title = 'お着替え', note = '', onChange, onSave, onClose } = {}) {
  document.querySelector('.dressup')?.remove();
  let P = null, first = null, L = null, homeL = null, TABS = DRESS, tab = TABS[0], hist = [], whole = false;
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
  const change = (fn, keep = true) => { if (keep) { hist.push(clone(L)); if (hist.length > 40) hist.shift(); } fn(L); root.querySelector('[data-a=undo]').disabled = !hist.length; paint(); renderBody(false); onChange?.(clone(L)); };
  const coords = () => (settings.chara2Coords || []).filter(c => c.look?.rin);
  // 下の一覧を描く。full＝タブを切りかえたとき（絵から作り直す）。そうでなければ、えらんだ印と数字だけ直す
  function renderBody(full = true) {
    if (!P) return;
    if (tab.kind === 'slot') {
      const ids = P.ids.filter(c => has(P, tab.id, c)).concat(NONE[tab.id] ? [''] : []);
      // 髪のタブには、髪の大きさ・位置の調整も出す（輪郭に合わせた所から、どれだけ変えるか）
      const adj = tab.id === 'hair' ? `<p class="du-hint">髪は、輪郭の大きさに合わせて置きます。合わないときは、ここで直せます</p>${sliders(HAIR_VALS)}<div class="du-shape"><button data-a="hair0">髪の大きさと位置をもどす</button></div>` : '';
      const ck = tab.id === 'hair' ? 'hair' : tab.id === 'rin' ? 'skin' : '';   // 色をえらべるタブ：髪＝髪の色、輪郭＝肌の色
      if (full) body.innerHTML = `${ck ? swatches(ck) : ''}<div class="du-grid ${tab.focus}">${ids.map(c => `<button class="du-item" data-v="${c}"><canvas></canvas><span class="du-nm">${esc(itemName(P, tab.id, c))}</span></button>`).join('')}</div>${tab.id === 'rin' ? '<p class="du-hint">輪郭を替えると、顔のバランスは、その輪郭に合う値になります</p>' : ''}${adj}`;
      setSliders(); if (ck) markColors(ck);
      body.querySelectorAll('.du-item').forEach(b => { b.setAttribute('aria-pressed', String(cur(L, tab.id) === b.dataset.v)); const t = clone(L); pick(t, tab.id, b.dataset.v); drawLook(b.querySelector('canvas'), P, t, tab.focus); });
    } else if (tab.kind === 'bal') {
      if (full) body.innerHTML = `<p class="du-hint">1ドットずつ動かせます。「もどす」で、いまの輪郭に合う値にもどります</p>${sliders(VALS)}<div class="du-shape"><button data-a="preset">輪郭に合う値にもどす</button></div>`;
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
  const setSliders = () => body.querySelectorAll('.du-sl').forEach(s => { s.querySelector('input').value = L.v[s.dataset.k]; s.querySelector('output').textContent = L.v[s.dataset.k]; });
  // 部品を替える。輪郭を替えたら、バランスをその輪郭のプリセットにする
  const pick = (t, k, c) => { if (k === 'hair') { t.hairF = c; t.hairB = c; } else t[k] = c; if (k === 'rin') t.v = presetOf(P, c, t.v); };
  const cur = (t, k) => (k === 'hair' ? (t.hairF === t.hairB ? t.hairF : null) : t[k]);   // 前髪と後ろ髪がちがう見た目（前に残した物）は、どれにも印を付けない
  const close = () => { root.remove(); document.body.classList.remove('du-open'); removeEventListener('resize', paint); document.removeEventListener('keydown', onKey); onClose?.(); };
  const onKey = e => { if (e.key === 'Escape') { e.preventDefault(); root.querySelector('[data-a=cancel]').click(); } };
  root.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b || !P) { if (b?.dataset.a === 'cancel') close(); return; } const a = b.dataset.a;
    if (b.dataset.tab) { tab = TABS.find(t => t.id === b.dataset.tab); root.querySelectorAll('[data-tab]').forEach(x => x.setAttribute('aria-selected', String(x === b))); paint(); renderBody(); }
    else if (b.dataset.c !== undefined) { const k = b.closest('.du-colors').dataset.k; if ((L.colors?.[k] || '') !== b.dataset.c) change(x => setColor(x, k, b.dataset.c)); }
    else if (b.dataset.v !== undefined) { if (cur(L, tab.id) !== b.dataset.v) change(x => pick(x, tab.id, b.dataset.v)); }
    else if (b.dataset.d) { const s = b.closest('.du-sl'), r = s.querySelector('input'), nv = Math.max(+r.min, Math.min(+r.max, L.v[s.dataset.k] + +b.dataset.d)); if (nv !== L.v[s.dataset.k]) change(x => { x.v[s.dataset.k] = nv; }); }
    else if (a === 'preset') { const pv = presetOf(P, L.rin, L.v); if (!same(pv, L.v)) change(x => { x.v = pv; }); }
    else if (a === 'hair0') { if (HAIR_VALS.some(([k]) => L.v[k])) change(x => { for (const [k] of HAIR_VALS) x.v[k] = 0; }); }
    else if (b.dataset.coord !== undefined) { const c = coords()[+b.dataset.coord]; if (c) { change(x => Object.assign(x, fixLook(P, c.look))); renderBody(); } }
    else if (b.dataset.del !== undefined) { const cs = coords().slice(), c = cs[+b.dataset.del]; if (c && confirm(`「${c.name}」を消しますか？`)) { cs.splice(+b.dataset.del, 1); settings.chara2Coords = cs; saveSettings(); renderBody(); } }
    else if (a === 'addcoord') { const cs = coords().slice(), name = (prompt('コーデの名前', `コーデ${cs.length + 1}`) || '').trim().slice(0, 12); if (!name) return; cs.push({ name, look: clone(L) }); settings.chara2Coords = cs; saveSettings(); renderBody(); toast(`「${name}」を残しました`); }
    else if (a === 'undo') { const p = hist.pop(); if (p) { L = p; b.disabled = !hist.length; paint(); renderBody(); onChange?.(clone(L)); } }
    else if (a === 'home' && homeL) { if (!same(L, homeL)) { change(x => { for (const k of Object.keys(x)) delete x[k]; Object.assign(x, clone(homeL)); }); renderBody(); } }
    else if (a === 'face') {   // 「顔をつくる」の入り切り：下のタブを、顔の部品とバランスに切りかえる
      const on = TABS !== FACE; TABS = on ? FACE : DRESS; tab = TABS[0]; b.setAttribute('aria-pressed', String(on)); b.textContent = on ? 'お着替えにもどる' : '顔をつくる'; renderTabs(); paint(); renderBody();
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
    const s = e.target.closest('.du-sl'); if (!s) return; if (!sliding) sliding = clone(L); L.v[s.dataset.k] = +e.target.value; s.querySelector('output').textContent = e.target.value; paint(); onChange?.(clone(L));
  });
  root.addEventListener('change', e => { if (!(e.target.closest('.du-sl') || e.target.type === 'color') || !sliding) return; hist.push(sliding); sliding = null; root.querySelector('[data-a=undo]').disabled = false; renderBody(false); });
  addEventListener('resize', paint); document.addEventListener('keydown', onKey);
  loadParts().then(v => { P = v; L = fixLook(P, look); first = clone(L); homeL = home ? fixLook(P, home) : null; paint(); renderBody(); }).catch(() => { body.innerHTML = '<p class="du-load">キャラの絵を読みこめませんでした</p>'; });
  root.querySelector('.du-ok').focus({ preventScroll: true });
  return close;
}
