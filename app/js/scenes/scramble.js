// 渋谷スクランブル交差点（2026-11-27）：ハチ公広場から、渋谷スクランブル交差点を地上の高さで見る。絵は Codex（昼・夜・雪の3枚。夜と雪は昼の絵と同じ位置。実物の写真を形の見本にした）
// 動き・季節：夕暮れに窓と画面が灯る、夜はネオンの絵
import { buildDot } from './dotscene.js';
export const build = () => buildDot({ base: 'assets/scramble/', ground: { base: 1.02, top: 0.8, hz: 0.52, s: 2, x: 0.24 }, leaves: true });
