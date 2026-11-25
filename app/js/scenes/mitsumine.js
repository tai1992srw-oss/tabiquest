// 三峯神社（2026-11-26）：三ツ鳥居とオオカミの像を正面から。絵は Codex（昼・夜・雪の3枚。夜と雪は昼の絵と同じ位置）
// 動き：秋の落ち葉。杉は秋も緑のまま、鳥居の奥の花の木は春だけ咲く（data.json の kinds）
import { buildDot } from './dotscene.js';
export const build = () => buildDot({ base: 'assets/mitsumine/', ground: { base: 1.02, top: .77, hz: .58, s: 2, x: .24 }, leaves: true });
