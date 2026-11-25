// 大さん橋（2026-11-26）：大さん橋の屋上（くじらのせなか）から、みなとみらいを見る。絵は Codex（昼・夜・雪の3枚。夜と雪は昼の絵と同じ位置。実物の写真を形の見本にした）
// 動き・季節：夕暮れにビルの窓が灯る、夜は夜景の絵
import { buildDot } from './dotscene.js';
export const build = () => buildDot({ base: 'assets/osanbashi/', ground: { base: 1.02, top: 0.7, hz: 0.45, s: 2, x: 0.24 }, leaves: true });
