// 大涌谷（2026-11-26）：大涌谷の噴気地帯。絵は Codex（昼・夜・雪の3枚。夜と雪は昼の絵と同じ位置。実物の写真を形の見本にした）
// 動き・季節：噴気の湯気が動く、秋の色づき
import { buildDot } from './dotscene.js';
export const build = () => buildDot({ base: 'assets/owakudani/', ground: { base: 1.02, top: 0.8, hz: 0.4, s: 2, x: 0.2 }, leaves: true, steam: [[76, 92], [180, 137]] });
