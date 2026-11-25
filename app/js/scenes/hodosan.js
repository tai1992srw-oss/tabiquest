// 宝登山神社（2026-11-26）：森の中の社殿を石段の下から。絵は Codex（昼・夜・雪の3枚。夜と雪は昼の絵と同じ位置）
// 動き：夕暮れに灯籠と社殿の中が灯る、夜は灯りのついた絵、秋の落ち葉。彫刻の緑は秋も変えない（data.json の kinds）
import { buildDot } from './dotscene.js';
export const build = () => buildDot({ base: 'assets/hodosan/', ground: { base: 1.02, top: .82, hz: .6, s: 2, x: .24 }, leaves: true });
