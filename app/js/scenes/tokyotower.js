// 東京タワー（2026-11-26）：芝生から見上げる構図。Fable が立体で置いた下絵 → SD が背景を塗りなおし → Fable のタワーを重ねたもの
// 夜はライトアップしたタワーの絵に切りかわる。芝生は秋に赤くしない（data.json の kinds）
import { buildDot } from './dotscene.js';
export const build = () => buildDot({ base: 'assets/tokyotower/', ground: { base: 1.02, top: .80, hz: .765, s: 2.1, x: .27 }, leaves: true });
