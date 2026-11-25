// 報国寺（竹の寺）（2026-11-26）：報国寺の竹の庭。絵は Codex（昼・夜・雪の3枚。夜と雪は昼の絵と同じ位置。実物の写真を形の見本にした）
// 動き・季節：夕暮れに石灯籠が灯る。竹は秋も緑のまま
import { buildDot } from './dotscene.js';
export const build = () => buildDot({ base: 'assets/hokokuji/', ground: { base: 1.02, top: 0.8, hz: 0.5, s: 2, x: 0.15 }, leaves: true });
