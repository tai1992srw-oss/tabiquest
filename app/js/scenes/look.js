// ドット絵の名所で共通の色づけ（時間帯・天気・季節）。鎌倉高校前で決めたものを切り出した（2026-11-25）
// 時間帯と天気の色づけ：c' = mix(c, 灰色, desat) * mul + add（写真の名所と同じ考え方）
export const TIME = {
  morning: { mul: [1.04, 1.0, .96], add: [10, 8, 4], desat: 0 },
  day: { mul: [1, 1, 1], add: [0, 0, 0], desat: 0 },
  evening: { mul: [1.05, .88, .8], add: [10, 2, 8], desat: .08 },
  night: { mul: [.3, .38, .62], add: [0, 2, 14], desat: .35 },
};
// 曇り・雨・雪の日の時間帯：日が差さないので夕焼けの色にはならない。暗くなるだけ（少し青みの灰色）
export const TIME_GRAY = {
  morning: { mul: [.96, .97, 1.0], add: [4, 5, 8], desat: .05 },
  day: { mul: [1, 1, 1], add: [0, 0, 0], desat: 0 },
  evening: { mul: [.74, .75, .82], add: [2, 2, 8], desat: .15 },
  night: { mul: [.3, .36, .55], add: [0, 2, 12], desat: .35 },
};
export const WEATHER = {
  clear: { mul: [1, 1, 1], add: [0, 0, 0], desat: 0 },
  cloudy: { mul: [.86, .87, .9], add: [6, 7, 10], desat: .5, flat: .15 },
  rain: { mul: [.74, .76, .84], add: [4, 5, 10], desat: .55, flat: .12 },
  snow: { mul: [.94, .96, 1.0], add: [6, 8, 12], desat: .25 },
};
// flat：明るいところと暗いところの差を小さくする（曇りの日は影がぼやけ、全体が平らに見える）
export const tint = ([r, g, b], t) => { const l = r * .3 + g * .59 + b * .11, f = t.flat || 0; const o = [(r + (l - r) * t.desat) * t.mul[0] + t.add[0], (g + (l - g) * t.desat) * t.mul[1] + t.add[1], (b + (l - b) * t.desat) * t.mul[2] + t.add[2]]; return o.map(v => v + (128 - v) * f); };
export const both = (a, b) => ({ mul: a.mul.map((v, i) => v * b.mul[i]), add: a.add.map((v, i) => v + b.add[i]), desat: Math.min(1, a.desat + b.desat), flat: (a.flat || 0) + (b.flat || 0) });
export const mix = (c, d, k) => c.map((v, i) => v + (d[i] - v) * k);

// 色の種類（32色のパレットから、葉・黄緑の葉・あじさいを見分ける）
export function kindOf([r, g, b]) {
  const mx = Math.max(r, g, b) / 255, mn = Math.min(r, g, b) / 255, l = (mx + mn) / 2, d = mx - mn;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1)); let h = 0;
  if (d) { const R = r / 255, G = g / 255, B = b / 255; h = mx === R ? ((G - B) / d) % 6 : mx === G ? (B - R) / d + 2 : (R - G) / d + 4; h = (h * 60 + 360) % 360; }
  if (h >= 70 && h <= 170 && s > .25) return 'leaf';
  if (h >= 45 && h < 70 && s > .3 && s < .65 && l < .55) return 'leafy';
  if (h >= 270 && h <= 330 && s > .4) return 'flower';
  return '';
}
// 季節の色の差し替え（夏が元の絵）
export function season(c, kind, s) {
  if (!kind || s === 'summer') return c;
  const l = (c[0] * .3 + c[1] * .59 + c[2] * .11) / 255;
  if (s === 'spring') return kind === 'flower' ? mix(c, [112, 172, 84], .85) : mix(c, kind === 'leaf' ? [150, 206, 86] : [196, 206, 96], .3);
  if (s === 'autumn') return kind === 'flower' ? mix(c, [140, 104, 78], .8) : kind === 'leafy' ? mix(c, [214, 158, 52], .65) : mix(c, l < .32 ? [122, 50, 36] : [224, 118, 44], .72);
  if (s === 'winter') return kind === 'flower' ? mix(c, [98, 94, 76], .8) : kind === 'leafy' ? mix(c, [122, 120, 88], .5) : mix(c, [44, 80, 62], .45);
  return c;
}

// キャラは背景ほど強く色を変えない
export function gradeChara([r, g, b], st) {
  if (st.time === 'night') { r = r * .62 * .8; g = g * .62 * .9; b = b * .62 * 1.25 + 8; }
  else if (st.time === 'evening' && st.weather === 'clear') { r = r * 1.02 + 6; g *= .9; b *= .86; }
  if (st.weather === 'rain' || st.weather === 'cloudy') { const l = r * .3 + g * .59 + b * .11; r = (r + (l - r) * .3) * .88; g = (g + (l - g) * .3) * .88; b = (b + (l - b) * .3) * .92; }
  return [r, g, b];
}
