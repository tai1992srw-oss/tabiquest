// 江の島（江島神社）（2026-11-26）：片瀬の砂浜から江の島と灯台を見る。絵は Codex（昼・夜・雪の3枚。夜と雪は昼の絵と同じ位置。実物の写真を形の見本にした）
// 動き・季節：夕暮れに灯台と島の明かりが灯る、夜はライトアップの絵
import { buildDot } from './dotscene.js';
export const build = () => buildDot({ base: 'assets/enoshima/', ground: { base: 1.02, top: 0.8, hz: 0.49, s: 2, x: 0.2 }, leaves: true });
