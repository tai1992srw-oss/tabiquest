// 城ヶ島（2026-11-26）：城ヶ島の馬の背洞門。絵は Codex（昼・夜・雪の3枚。夜と雪は昼の絵と同じ位置。実物の写真を形の見本にした）
// 動き・季節：波の岩場。草は秋も変えない
import { buildDot } from './dotscene.js';
export const build = () => buildDot({ base: 'assets/jogashima/', ground: { base: 1.02, top: 0.78, hz: 0.46, s: 2, x: 0.2 }, leaves: true });
