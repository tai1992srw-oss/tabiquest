// サンシャイン水族館（2026-11-27）：サンシャイン水族館の屋上の「天空のペンギン」（空を飛ぶように泳ぐ水そう）。絵は Codex（昼・夜・雪の3枚。夜と雪は昼の絵と同じ位置。実物の写真を形の見本にした）
// 動き・季節：夜は水そうが青く光る絵。店先の花（ハイビスカス・あじさい）は夏だけ咲く。ヤシは秋も緑
import { buildDot } from './dotscene.js';
export const build = () => buildDot({ base: 'assets/sunshineaq/', ground: { base: 1.02, top: 0.8, hz: 0.55, s: 2, x: 0.22 }, leaves: true });
