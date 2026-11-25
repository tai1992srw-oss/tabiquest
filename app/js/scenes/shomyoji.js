// 称名寺（金沢文庫）（2026-11-26）：阿字ヶ池にかかる赤い反橋と金堂。絵は Codex（昼・夜・雪の3枚。夜と雪は昼の絵と同じ位置。実物の写真を形の見本にした）
// 動き・季節：花しょうぶは夏だけ咲く、秋の紅葉と落ち葉
import { buildDot } from './dotscene.js';
export const build = () => buildDot({ base: 'assets/shomyoji/', ground: { base: 1.02, top: 0.82, hz: 0.45, s: 2, x: 0.2 }, leaves: true });
