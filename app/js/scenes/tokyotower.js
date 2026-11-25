// 東京タワー（2026-11-26）：芝生から見上げる構図。絵は Codex（昼・夜・雪の3枚。夜と雪は昼の絵と同じ位置）
// 動き：夕暮れにタワーと展望台の窓が灯る、夜はライトアップの絵・遠くのビルの窓のまたたき、空を横切るハト、秋の落ち葉
// 芝生は秋に赤くしない、あじさいは季節で色が変わる（data.json の kinds）
import { buildDot } from './dotscene.js';
export const build = () => buildDot({ base: 'assets/tokyotower/', ground: { base: 1.02, top: .80, hz: .765, s: 2, x: .27 }, leaves: true, gulls: [92, 180, 54] });
