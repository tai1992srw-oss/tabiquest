// 横浜赤レンガ倉庫（2026-11-26）：赤レンガ倉庫を広場からななめに見る。絵は Codex（昼・夜・雪の3枚。夜と雪は昼の絵と同じ位置。実物の写真を形の見本にした）
// 動き・季節：夕暮れに窓が灯る、夜はライトアップの絵
import { buildDot } from './dotscene.js';
export const build = () => buildDot({ base: 'assets/akarenga/', ground: { base: 1.02, top: 0.72, hz: 0.62, s: 2, x: 0.24 }, leaves: true });
