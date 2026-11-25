// 長瀞の岩畳（2026-11-26）：岩畳から荒川と対岸の崖（秩父赤壁）を見る。絵は Codex（昼・夜・雪の3枚と舟。夜と雪は昼の絵と同じ位置）
// 動き：川のきらめき、ライン下りの舟（下流へだけ進む。夜・雨・雪の日は出ない）、秋の紅葉と落ち葉。川の青緑は秋も変えない（data.json の kinds）
import { buildDot } from './dotscene.js';
export const build = () => buildDot({ base: 'assets/nagatoro/', ground: { base: 1.02, top: .76, hz: .36, s: 2, x: .2 }, leaves: true, boat: true, boatDir: -1, boatDay: true });
