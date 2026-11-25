// 芦ノ湖（元箱根港）（2026-11-26）：元箱根から芦ノ湖・平和の鳥居・富士山を見る。絵は Codex（昼・夜・雪の3枚。夜と雪は昼の絵と同じ位置。実物の写真を形の見本にした）
// 動き・季節：海賊船が湖を行き来する（夜・雨・雪の日は出ない）、富士山の雪は夏だけ消える
import { buildDot } from './dotscene.js';
export const build = () => buildDot({ base: 'assets/ashinoko/', ground: { base: 1.02, top: 0.78, hz: 0.48, s: 2, x: 0.2 }, leaves: true, boat: true, boatDay: true });
