// 渋谷の屋上展望台（2026-11-27）：渋谷駅の上の高層ビルの屋上から、スクランブル交差点を見下ろす。絵は Codex（昼・夜・雪の3枚。夜と雪は昼の絵と同じ位置。実物の写真を形の見本にした）
// 動き・季節：夜は夜景の絵
import { buildDot } from './dotscene.js';
export const build = () => buildDot({ base: 'assets/shibuyasky/', ground: { base: 1.02, top: 0.8, hz: 0.45, s: 2, x: -0.24 }, leaves: true });
