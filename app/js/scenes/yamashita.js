// 山下公園（2026-11-26）：山下公園の遊歩道から氷川丸を見る。絵は Codex（昼・夜・雪の3枚。夜と雪は昼の絵と同じ位置。実物の写真を形の見本にした）
// 動き・季節：夕暮れに船の窓が灯る、夜は電飾の絵、秋の落ち葉
import { buildDot } from './dotscene.js';
export const build = () => buildDot({ base: 'assets/yamashita/', ground: { base: 1.02, top: 0.8, hz: 0.5, s: 2, x: 0.24 }, leaves: true });
