// 建長寺（2026-11-26）：建長寺の三門を正面から。絵は Codex（昼・夜・雪の3枚。夜と雪は昼の絵と同じ位置。実物の写真を形の見本にした）
// 動き・季節：夕暮れに門の下が灯る、秋の紅葉と落ち葉
import { buildDot } from './dotscene.js';
export const build = () => buildDot({ base: 'assets/kenchoji/', ground: { base: 1.02, top: 0.78, hz: 0.65, s: 2, x: 0.24 }, leaves: true });
