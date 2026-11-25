// 羊山公園（2026-11-26）：芝桜の丘と武甲山。絵は Codex（昼・夜・雪の3枚。夜と雪は昼の絵と同じ位置）
// 芝桜は春だけ咲く：夏は葉の緑、秋はくすんだ緑、冬は茶色がかった緑（data.json の kinds の bloom。look.js の season）。動き：秋の落ち葉
import { buildDot } from './dotscene.js';
export const build = () => buildDot({ base: 'assets/hitsujiyama/', ground: { base: 1.02, top: .8, hz: .34, s: 2, x: .1 }, leaves: true });
