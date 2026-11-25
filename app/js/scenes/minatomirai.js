// みなとみらい（2026-11-25 作り直し）：Codex の元の絵を tools/make_minatomirai.py で層に分けたもの
// 動き：海のきらめき、夜の観覧車の明かり・窓のまたたき、街灯の灯り、ときどき横切る船、カモメ
import { buildDot } from './dotscene.js';
export const build = () => buildDot({ base: 'assets/minatomirai/', ground: { base: .885, top: .83, hz: .543 }, gulls: [70, 112, 46], boat: true });
