// 大山阿夫利神社（下社）（2026-11-26）：大山阿夫利神社の下社と大山の森。絵は Codex（昼・夜・雪の3枚。夜と雪は昼の絵と同じ位置。実物の写真を形の見本にした）
// 動き・季節：夕暮れに社殿と灯籠が灯る、菊は秋だけ咲く、秋の紅葉と落ち葉
import { buildDot } from './dotscene.js';
export const build = () => buildDot({ base: 'assets/oyama/', ground: { base: 1.02, top: 0.78, hz: 0.58, s: 2, x: -0.22 }, leaves: true });
