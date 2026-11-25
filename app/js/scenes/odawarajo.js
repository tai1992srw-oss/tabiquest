// 小田原城（2026-11-26）：本丸広場から天守を見上げる。絵は Codex（昼・夜・雪の3枚。夜と雪は昼の絵と同じ位置。実物の写真を形の見本にした）
// 動き・季節：桜は春だけ咲く（夏は緑、秋は色づき、冬は枯れ枝の色）、夜はライトアップの絵
import { buildDot } from './dotscene.js';
export const build = () => buildDot({ base: 'assets/odawarajo/', ground: { base: 1.02, top: 0.78, hz: 0.6, s: 2, x: -0.2 }, leaves: true });
