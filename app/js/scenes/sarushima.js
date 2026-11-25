// 猿島（2026-11-26）：猿島の要塞跡の切通しとレンガのトンネル。絵は Codex（昼・夜・雪の3枚。夜と雪は昼の絵と同じ位置。実物の写真を形の見本にした）
// 動き・季節：夕暮れにランプが灯る。森は常緑で秋も緑
import { buildDot } from './dotscene.js';
export const build = () => buildDot({ base: 'assets/sarushima/', ground: { base: 1.02, top: 0.8, hz: 0.5, s: 2, x: 0 }, leaves: true });
