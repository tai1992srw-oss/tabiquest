// 鎌倉大仏（高徳院）（2026-11-26）：高徳院の大仏を正面から見上げる。絵は Codex（昼・夜・雪の3枚。夜と雪は昼の絵と同じ位置。実物の写真を形の見本にした）
// 動き・季節：夜はライトアップの絵、秋の落ち葉
import { buildDot } from './dotscene.js';
export const build = () => buildDot({ base: 'assets/daibutsu/', ground: { base: 1.02, top: 0.78, hz: 0.62, s: 2, x: 0.26 }, leaves: true });
