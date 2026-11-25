// 長谷寺（鎌倉）（2026-11-26）：石段の上の観音堂と、両わきのあじさい。絵は Codex（昼・夜・雪の3枚。夜と雪は昼の絵と同じ位置。実物の写真を形の見本にした）
// 動き・季節：あじさいは夏だけ咲く（春はつぼみ、秋冬は枯れ色）、夕暮れに堂の中が灯る
import { buildDot } from './dotscene.js';
export const build = () => buildDot({ base: 'assets/hasedera/', ground: { base: 1.02, top: 0.8, hz: 0.6, s: 2, x: 0 }, leaves: true });
