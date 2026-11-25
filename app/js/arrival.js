// 到着演出：絵の組み上がり → 光 → スタンプ → 紙吹雪 →「カードを手に入れた！」の帯
// 組み上がりは Canva から写し取った層を順に出すだけ。背景は描き足さない
import { engine, reduceMotion } from './card.js';
import { cardEl, esc } from './ui.js';

const clamp = x => Math.max(0, Math.min(1, x));
const bounce = x => { const n = 7.5625, d = 2.75; if (x < 1 / d) return n * x * x; if (x < 2 / d) return n * (x -= 1.5 / d) * x + .75; if (x < 2.5 / d) return n * (x -= 2.25 / d) * x + .9375; return n * (x -= 2.625 / d) * x + .984375; };

// result: { first, count, points, item }  v: 到着で撮ったカード（時間帯・天気・季節・日時・通し番号）
export function playArrival(place, v, result, { onZukan } = {}) {
  return new Promise(async resolve => {
    const root = document.createElement('div'); root.className = 'arrival'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-label', place.welcome);
    const card = cardEl(place, v); card.classList.add('pre');
    const bandText = result.first ? 'カードを手に入れた！' : `${result.count}回目の到着！`;
    const gains = [];
    if (result.points) gains.push(`<em>+${result.points}pt</em>`);
    if (result.item) gains.push(`ご当地アイテム「<em>${esc(result.item.name)}</em>」`);
    root.innerHTML = `<div class="rays"></div><div class="stage"></div><canvas class="confetti" width="120" height="214"></canvas><div class="flash"></div>
      <div class="band"><span>${esc(bandText)}</span></div>
      <div class="after"><div class="gain">${gains.length ? gains.join(' ／ ') + ' を手に入れた' : 'きょうの到着は記録ずみ'}</div>
        <div class="row"><button class="primary" data-a="zukan">図鑑で見る</button><button data-a="close">とじる</button></div></div>
      <button class="skip">とばす</button>`;
    root.querySelector('.stage').append(card);
    document.body.append(root);
    const s = await engine.show(card, place.scene, v);
    engine.canvas.setAttribute('role', 'img'); engine.canvas.setAttribute('aria-label', place.alt);

    const parts = [...s.layers, s.ch.chara];
    const band = root.querySelector('.band'), after = root.querySelector('.after'), flash = root.querySelector('.flash'), skipBtn = root.querySelector('.skip');
    const L = s.layers.length, charaAt = 150 + L * 450, flashAt = charaAt + 650, stampAt = flashAt + 420, confAt = stampAt + 120, bandAt = stampAt + 480, upAt = bandAt + 1300, endAt = upAt + 400;
    const fired = new Set(); const once = (k, t, fn) => { if (t >= k && !fired.has(k)) { fired.add(k); fn(); } };
    let skip = reduceMotion(), t0 = performance.now(), done = false;
    const conf = confetti(root.querySelector('.confetti'));

    function step(now) {
      if (done) return;
      const t = skip ? endAt : now - t0;
      s.layers.forEach((m, i) => { m.material.uniforms.uReveal.value = clamp((t - 150 - i * 450) / 600); });
      const k = clamp((t - charaAt) / 520);
      s.ch.chara.material.uniforms.uReveal.value = k > 0 ? 1 : 0; s.drop = Math.round(230 * (1 - bounce(k))); s.ch.shadow.material.opacity = s.ch.shadowOpacity * k;
      once(flashAt, t, () => { s.forcePose = 1; if (!skip) flash.classList.add('on'); root.classList.add('lit'); card.classList.remove('pre'); card.classList.add('lit'); });
      once(stampAt, t, () => { card.classList.add('stamped'); if (!skip) { card.classList.add('shake'); navigator.vibrate?.(40); } });
      once(confAt, t, () => { if (!skip) conf.start(); });
      once(bandAt, t, () => band.classList.add('in'));
      once(upAt, t, () => { band.classList.add('up'); after.classList.add('on'); skipBtn.remove(); after.querySelector('button.primary').focus({ preventScroll: true }); });
      if (t < endAt) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);

    const toEnd = () => { if (!fired.has(upAt)) { skip = true; } };
    skipBtn.addEventListener('click', e => { e.stopPropagation(); toEnd(); });
    root.addEventListener('click', e => { if (!e.target.closest('button')) toEnd(); });
    after.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      done = true; conf.stop(); engine.stop(); root.remove();
      if (b.dataset.a === 'zukan') onZukan?.();
      resolve(b.dataset.a);
    });
  });
}

// 紙吹雪（低い解像度で描いて拡大し、ドットに見せる）
function confetti(cv) {
  const ctx = cv.getContext('2d'), Wc = cv.width, Hc = cv.height, cols = ['#FFC857', '#FF6B5A', '#3ED6C4', '#FFF4E0', '#FF9AD5', '#8FA8FF'];
  let ps = [], raf = 0, t0 = 0;
  function start() {
    ps = Array.from({ length: 110 }, () => ({ x: Wc / 2 + (Math.random() - .5) * 30, y: Hc * .42, vx: (Math.random() - .5) * 3.4, vy: -Math.random() * 3.6 - 1.2, c: cols[Math.random() * cols.length | 0], s: Math.random() < .3 ? 2 : 1, ph: Math.random() * 6 }));
    t0 = performance.now(); raf = requestAnimationFrame(tick);
  }
  function tick(now) {
    const age = now - t0; ctx.clearRect(0, 0, Wc, Hc);
    for (const p of ps) { p.vy += .07; p.vx *= .985; p.x += p.vx; p.y += Math.min(p.vy, 1.6); p.ph += .25;
      const w = Math.abs(Math.cos(p.ph)) > .4 ? p.s + 1 : 1; ctx.fillStyle = p.c; ctx.fillRect(Math.round(p.x), Math.round(p.y), w, p.s); }
    if (age < 4200) raf = requestAnimationFrame(tick); else ctx.clearRect(0, 0, Wc, Hc);
  }
  return { start, stop() { cancelAnimationFrame(raf); } };
}
