// 横浜中華街（2026-11-25 作り直し）：Codex の元の絵を tools/make_chukagai.py で層に分けたもの
// 動き：夕暮れ・夜に灯る提灯、屋台の湯気、秋の落ち葉（両わきの木）
import { buildDot } from './dotscene.js';
export const build = () => buildDot({ base: 'assets/chukagai/', feet: .95, leaves: true, steam: [[14, 236], [214, 236]] });
