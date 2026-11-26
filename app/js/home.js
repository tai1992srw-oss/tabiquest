// ホーム：アプリを開いて最初に出る画面。キャラが主役（2026-11-26、くりたが案B2「景色をぼかす」に決定）
//   後ろ：きょうの名所のドット絵（近くの名所、なければ日がわり）。時間帯・天気・季節で変わり、ぼかして敷く（白くはしない）
//   まん中：分身キャラを大きく（1ドット＝2マス。入らない画面では少し小さく）。押すと喜ぶ、ときどき手をふる
//   キャラは案内役：ふきだしで次にやることを話す。右にお着替え（いちばん大きく）・撮影・図鑑・目標、下に「近くの名所へ」
//   ぼかし具合は「ぼかし」ボタンで変えて、この端末に覚えておく（くりたが画面でいじって決めるため）
//   前のボクセルのマイルーム（模様がえ・写真・家具・ショップ）はやめた。アプリの外 archive/home-room-voxel/ に保管
import { PLACES, LABEL, seasonOf } from './places.js';
import { book, mode, settings, saveBook, saveSettings, defaultLook } from './store.js';
import { openDress } from './dress.js';
import { engine, clearSnaps, reduceMotion } from './card.js';
import { loadParts, homeLook, frameCanvas, FACES } from './chara2.js';
import { current, distance } from './geo.js';
import { conditionsAt, renderTime, timeOfDay } from './conditions.js';
import { esc, toast, icon } from './ui.js';
import { loadSerifu, pick, fill } from './serifu.js';

const DOTS = PLACES.filter(p => p.kind === 'dot');
const dayNo = d => Math.floor((d.getTime() - d.getTimezoneOffset() * 60000) / 86400000);

// ---- ログインボーナス ----
const dayKey = d => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
const bonusOf = streak => (streak % 7 === 0 ? 100 : 20);   // 7日つづけるごとに大きく
function loginState(b, now) {
  const L = b.login || { last: null, streak: 0, days: 0 };
  const y = new Date(now); y.setDate(y.getDate() - 1);
  const got = L.last === dayKey(now), next = got ? L.streak : L.last === dayKey(y) ? L.streak + 1 : 1;
  return { L, got, next };
}
function claimLogin(b, now) {
  const { L, got, next } = loginState(b, now); if (got) return 0;
  const pts = bonusOf(next); b.login = { last: dayKey(now), streak: next, days: (L.days || 0) + 1 }; b.points += pts; saveBook(); return pts;
}

// 後ろの景色に使うドット絵の名所：近くにあればそこ、なければ日がわりで
function homeScene(now) {
  const pos = current();
  if (pos) { const n = [...DOTS].sort((a, z) => distance(pos, a) - distance(pos, z))[0]; if (distance(pos, n) < 30000) return n; }
  return DOTS[dayNo(now) % DOTS.length];
}

// ぼかし具合（px）。この端末に覚えておく
const BLUR_MAX = 24;
const getBlur = () => { try { const v = localStorage.getItem('tabiquest:homeblur'); return v === null ? 6 : Math.max(0, Math.min(BLUR_MAX, +v || 0)); } catch (e) { return 6; } };
const setBlur = v => { try { localStorage.setItem('tabiquest:homeblur', String(v)); } catch (e) {} };

// 分身キャラ：寄り（360ドット）の層を、いまの髪型・衣装で重ね、ふつうの色にもどした絵（横にポーズのコマが並ぶ）
let charaImg = null;
function loadChara() {
  return charaImg || (charaImg = (async () => {
    const P = await loadParts(), im = frameCanvas(P, homeLook(P)), c = im;   // ふだんの見た目の立ち絵（色つき・1コマ）
    const d = c.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, c.width, c.height);
    // 足もと：立ちのコマで、いちばん下のドットの行
    let bot = 0; for (let y = 0; y < im.fh; y++) for (let i = 0; i < im.fw; i++) if (d.data[(y * c.width + i) * 4 + 3]) { bot = y; break; }
    let top = im.fh; for (let y = 0; y < im.fh && top === im.fh; y++) for (let i = 0; i < im.fw; i++) if (d.data[(y * c.width + i) * 4 + 3]) { top = y; break; }
    // 表情ごとの絵は、はじめて使うときに作る（get('grin') など。'blink' ＝ まばたき）
    const L = homeLook(P), cache = new Map([['', c]]);
    const get = f => { if (!cache.has(f)) cache.set(f, frameCanvas(P, f === 'blink' ? { ...L, blink: 1 } : { ...L, face: f })); return cache.get(f); };
    return Object.assign(c, { poses: ['立ち'], top, bot: bot + 1, get });
  })().catch(e => { charaImg = null; throw e; }));
}

// view：表示する場所、header：上のポイント表示を新しくする関数。返す関数で、絵の動きを止める
export function renderHome(view, { header } = {}) {
  const now = new Date(), b = book(), dbg = mode() === 'debug';
  const scene = homeScene(now);
  const timeReal = dbg && settings.time !== 'auto' ? settings.time : timeOfDay(now);
  let wx = dbg && settings.weather !== 'auto' ? settings.weather : null;   // わかるまでは天気を書かない
  // キャラは絵の外へ出して、景色だけにする（photo.x を大きく）
  let st = { time: renderTime(scene, timeReal), timeReal, weather: wx || 'clear',
    season: dbg && settings.season && settings.season !== 'auto' ? settings.season : seasonOf(now), at: now.toISOString(), photo: { x: 9 } };
  const lg = loginState(b, now);
  const cond = () => [LABEL.time[timeReal], wx && LABEL.weather[wx], LABEL.season[st.season]].filter(Boolean).join('・');

  view.classList.add('homemode');
  view.innerHTML = `
    <div class="hh" style="--blur:${getBlur()}px">
      <div class="hh-bg" aria-hidden="true"></div>
      <button class="hh-me" aria-label="分身キャラ（押すと喜びます）"><canvas></canvas></button>
      <div class="hh-tk"><div><small>きょうの景色</small><b>${esc(scene.name)}</b></div><span class="cond">${esc(cond())}</span></div>
      ${lg.got ? '' : `<button class="hh-bonus" data-a="login">${icon('gift', 18)}ログボ<span class="n">+${bonusOf(lg.next)}</span></button>`}
      <p class="bubble hh-say" aria-live="polite"></p>
      <div class="hh-menu">
        <button class="big" data-a="dress"><i>${icon('hanger', 30)}</i><span>お着替え</span></button>
        <button data-a="shoot"><i>${icon('camera', 22)}</i><span>撮影</span></button>
        <a href="#/zukan"><i>${icon('book', 22)}</i><span>図鑑</span></a>
        <a href="#/goals"><i>${icon('star', 22)}</i><span>目標</span></a>
        <button data-a="blur"><i>${icon('drop', 22)}</i><span>ぼかし</span></button>
      </div>
      <a class="cta hh-go" href="#/">${icon('place', 22)}近くの名所へ</a>
    </div>`;
  const root = view.querySelector('.hh'), meEl = view.querySelector('.hh-me'), cv = meEl.querySelector('canvas'), say = view.querySelector('.hh-say');

  // 景色：名所のカードの絵を後ろで動かす（キャラなし）
  const bg = view.querySelector('.hh-bg');
  engine.show(bg, scene.scene, st);
  if (!wx) conditionsAt(scene, null).then(v => {   // 天気は名所の位置で調べる（現在地は送らない）
    if (!view.contains(bg)) return;
    wx = v.weather === 'unknown' ? null : v.weather; st = { ...st, time: v.time, timeReal: v.timeReal, weather: v.weather }; engine.setState(st);
    view.querySelector('.hh-tk .cond').textContent = cond();
  }).catch(() => {});

  // ふきだし：次にやることを話す（キャラの性格ごとのセリフ。serifu.js）
  let S = null;
  const lines = () => {
    const pos = current(), L = [], when = { time: timeReal, season: st.season }, C = S.common;
    let near = null;
    if (pos) { near = [...PLACES].sort((a, z) => distance(pos, a) - distance(pos, z))[0]; const m = distance(pos, near);
      L.push(fill(m < 1000 ? C.nearClose : C.near, { name: near.name, km: (m / 1000).toFixed(m < 10000 ? 1 : 0) })); }
    L.push(...pick(S.places[scene.id], when));   // 後ろの景色の名所のセリフ
    if (near && near.id !== scene.id) L.push(...pick(S.places[near.id], when));   // いちばん近い名所のセリフ
    if (!b.cards.length) L.push(C.firstCard); else L.push(C.zukan, C.dress);
    if (!lg.got) L.push(fill(C.login, { n: lg.next }));
    L.push(...pick(S.extra, when));   // その性格らしい一言
    return L.filter(Boolean);
  };
  let li = 0; const talk = () => { if (!S) return; const L = lines(); say.textContent = (li === 0 ? S.greet[timeReal] : '') + L[li % L.length]; li++; };
  loadSerifu().then(d => { S = d; talk(); }).catch(() => { say.hidden = true; });

  // キャラ：2倍（1ドット＝2マス）。入らない画面だけ小さく。足もとをナビの上にそろえる
  // 表情：押すとよろこぶ（にっこり・ウインク）、話すと笑顔、ときどき別の表情、数秒に1回まばたき（動きを減らす設定のときは、まばたきだけしない）
  let C = null, face = '', joyUntil = 0, moodUntil = 0, mood = '', nextMood = performance.now() + 6000, nextBlink = performance.now() + 2500, blinkUntil = 0, raf = 0, alive = true;
  const MOODS = ['smile', 'smile', 'close', 'smug', 'wow'];
  const fit = () => {
    if (!C) return;
    const room = root.clientHeight - 96 - 110, s = Math.min(2, room / (C.bot - C.top));   // 上の札と、下のナビのぶんを空ける
    Object.assign(cv.style, { width: C.fw * s + 'px', height: C.fh * s + 'px', marginBottom: -(C.fh - C.bot) * s + 'px' });
  };
  const draw = f => { const im = C.get(f), x = cv.getContext('2d'); x.clearRect(0, 0, cv.width, cv.height); x.drawImage(im, 0, 0); };
  const tick = t => {
    if (!alive) return; raf = requestAnimationFrame(tick);
    const rm = reduceMotion();
    if (t > nextMood && t > joyUntil) { mood = MOODS[Math.floor(Math.random() * MOODS.length)]; moodUntil = t + 2200; nextMood = t + 8000 + Math.random() * 9000; }
    if (!rm && t > nextBlink) { blinkUntil = t + 140; nextBlink = t + 2600 + Math.random() * 3200; if (Math.random() < .2) nextBlink = t + 320; }   // ときどき2回つづけて
    const base = t < joyUntil ? face : t < moodUntil ? mood : '';
    const f = t < blinkUntil && !['close', 'grin', 'shy'].includes(base) ? 'blink' : base;
    if (f !== cv.dataset.p) { cv.dataset.p = f; draw(f); }
  };
  const showChara = () => loadChara().then(c => {
    if (!alive) return; C = c; cv.width = c.fw; cv.height = c.fh; fit(); cv.dataset.p = ''; meEl.classList.add('on');
    cancelAnimationFrame(raf); raf = requestAnimationFrame(tick);
  }).catch(() => { meEl.hidden = true; });
  showChara();
  const ro = new ResizeObserver(fit); ro.observe(root);

  // キャラを押すと喜ぶ（ばんざい・ピース、ぴょんと跳ねる）。ふきだしも次の話に
  const JOYS = ['grin', 'wink', 'shy'];
  meEl.addEventListener('click', () => {
    if (!C) return; face = JOYS[Math.floor(Math.random() * JOYS.length)]; joyUntil = performance.now() + 1800;
    if (!reduceMotion()) { meEl.classList.remove('hop'); void meEl.offsetWidth; meEl.classList.add('hop'); }
    talk();
  });

  view.onclick = e => {
    const t = e.target.closest('button[data-a]'); if (!t) return;
    const a = t.dataset.a;
    if (a === 'login') { const pts = claimLogin(b, new Date()); if (pts) { toast(`ログインボーナス +${pts}pt`); header?.(); } t.remove(); }
    else if (a === 'shoot') {   // いちばん新しいカードを、撮影（ポーズ）で開く
      const c = [...b.cards].sort((x, z) => z.at.localeCompare(x.at))[0];
      if (!c) { toast('名所に到着すると、カードを撮影できます'); return; }
      try { sessionStorage.setItem('tabiquest:posing', c.id); } catch (err) {}
      location.hash = `#/card/${encodeURIComponent(c.id)}`;
    }
    else if (a === 'dress') {   // ホームのお着替え＝ふだんの見た目。これから作るカードと、ホームのキャラに使う（前に撮ったカードは変わらない）
      openDress({ look: defaultLook(), title: 'お着替え', note: 'ふだんの見た目。これからのカードにも使います',
        onSave: L => { settings.chara2 = L;
          saveSettings(); clearSnaps(); charaImg = null; showChara(); toast('お着替えを保存しました'); } });
    }
    else if (a === 'blur') {   // ぼかし具合を動かして見る（後ろが見えるシート）
      const bx = document.createElement('div'); bx.className = 'hh-blur';
      bx.innerHTML = `<label><span>ぼかし</span><input type="range" min="0" max="${BLUR_MAX}" step="1" value="${getBlur()}"><b class="v"></b></label>
        <p class="note">後ろの景色のぼかし具合です。この端末に覚えておきます。</p>`;
      const r = bx.querySelector('input'), v = bx.querySelector('.v');
      const upd = () => { v.textContent = r.value + 'px'; root.style.setProperty('--blur', r.value + 'px'); setBlur(+r.value); };
      r.oninput = upd; upd(); sheet('景色のぼかし', bx, null, true);
    }
  };
  return () => { alive = false; cancelAnimationFrame(raf); ro.disconnect(); engine.stop(); view.classList.remove('homemode'); view.onclick = null; document.querySelector('.hm-pick')?.remove(); };
}

// 下から出るシート。light：後ろが見えるように、暗くしない
function sheet(title, body, onClose, light = false) {
  document.querySelector('.hm-pick')?.remove();
  const el = document.createElement('div'); el.className = 'hm-pick' + (light ? ' light' : ''); el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', title);
  el.innerHTML = `<div class="in"><div class="hd"><b>${esc(title)}</b><button class="x" data-a="close" aria-label="とじる">×</button></div><div class="bd"></div></div>`;
  el.querySelector('.bd').append(body);
  const close = () => { el.remove(); onClose?.(); };
  el.addEventListener('click', e => { if (e.target === el || e.target.closest('[data-a=close]')) close(); });
  document.body.append(el); el.querySelector('.x').focus({ preventScroll: true });
  return close;
}
