// 箱根神社（2026-11-26）：芦ノ湖に立つ平和の鳥居を岸から見る。絵は Codex（昼・夜・雪の3枚。夜と雪は昼の絵と同じ位置。実物の写真を形の見本にした）
// 動き・季節：夜はライトアップの絵。あじさいは夏だけ咲く。杉は秋も緑
import { buildDot } from './dotscene.js';
export const build = () => buildDot({ base: 'assets/hakonejinja/', ground: { base: 1.02, top: 0.82, hz: 0.48, s: 2, x: 0 }, leaves: true });
