// 地図の試作ページ：タブの切り替えと「わかったこと」
import { initDotMap, redraw, stats, PALETTE, bench } from './dotmap.js';
import { initRealMap, rstats } from './realmap.js';
import { FINDINGS } from './findings.js';

const $ = s => document.querySelector(s);
let tab = 'a';
try { tab = localStorage.getItem('tabiquest-lab-map-tab') || 'a'; } catch (e) { /* なくてよい */ }

function show(t) {
  tab = t;
  try { localStorage.setItem('tabiquest-lab-map-tab', t); } catch (e) { /* なくてよい */ }
  document.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('on', b.dataset.tab === t));
  document.querySelectorAll('section').forEach(s => s.classList.toggle('on', s.id === t));
  if (t === 'a') redraw();
  if (t === 'b') initRealMap($('#b'));
  if (t === 'm') memo();
}
document.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => show(b.dataset.tab));

const kb = n => (n / 1024).toFixed(1) + 'KB';
function memo() {
  setTimeout(() => { const b = $('#bench'); if (b) b.onclick = () => { bench(); memo(); }; });
  const levelsRow = id => `<tr><td>${id}</td><td>${stats.bytes[id] ? kb(stats.bytes[id]) : '-'}</td><td>${stats.loadMs[id] ?? '-'}ms</td><td>${stats.paintMs[id] ?? '-'}ms</td></tr>`;
  const total = Object.values(stats.bytes).reduce((a, b) => a + b, 0);
  const avg = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
  $('#memo').innerHTML = FINDINGS + `
  <h2>この端末で測った数字（いま）</h2>
  <table><tr><th>段</th><th>大きさ</th><th>読み込み</th><th>色ぬり</th></tr>
  ${['jp8', 'jp2', 'jp1', 'kt1000', 'kt250', 'kt100', 'kt50'].map(levelsRow).join('')}
  <tr><td>levels.json</td><td>${stats.bytes.levels ? kb(stats.bytes.levels) : '-'}</td><td></td><td></td></tr>
  <tr><th>合計</th><th>${kb(total)}</th><th colspan="2">最初の表示 ${stats.firstDrawMs}ms・全部 ${stats.allMs ?? '-'}ms</th></tr></table>
  <p><small>案A を指で動かしたときの1回の描画：平均 ${avg(stats.draws).toFixed(1)}ms／最大 ${Math.max(0, ...stats.draws).toFixed(1)}ms（直近${stats.draws.length}回）。
  案B：読み込んだタイル ${rstats.tiles}枚、最初のタイルまで ${rstats.firstTileMs || '-'}ms。</small></p>
  <p><button id="bench">案A の描く速さを測る</button> <small id="benchout">${stats.bench ? Object.entries(stats.bench).map(([k, v]) => `${k} ${v}ms`).join('・') : '（1回あたりの描画。16ms 以下なら 60fps に間に合う）'}</small></p>
  <p><small>案A のパレット（${PALETTE.length}色）</small></p><div class="pal">${PALETTE.map(c => `<i style="background:${c}"></i>`).join('')}</div>
  <p><small>画面 ${innerWidth}×${innerHeight}・devicePixelRatio ${devicePixelRatio}・${navigator.userAgent.replace(/^Mozilla\/5.0 /, '')}</small></p>`;
}

initDotMap($('#a')).then(() => show(tab));
