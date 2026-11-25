import { RS } from '../card.js';
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
  if (kind === 'grass') return s === 'autumn' ? mix(c, [186, 178, 84], .38) : s === 'winter' ? mix(c, [150, 148, 96], .5) : mix(c, [150, 206, 86], .2);   // 芝生：秋は少し黄色く、冬は枯れ色（赤くはしない）
  const l = (c[0] * .3 + c[1] * .59 + c[2] * .11) / 255;
  if (s === 'spring') return kind === 'flower' ? mix(c, [112, 172, 84], .85) : mix(c, kind === 'leaf' ? [150, 206, 86] : [196, 206, 96], .3);
  if (s === 'autumn') return kind === 'flower' ? mix(c, [140, 104, 78], .8) : kind === 'leafy' ? mix(c, [214, 158, 52], .65) : mix(c, l < .32 ? [122, 50, 36] : [224, 118, 44], .72);
  if (s === 'winter') return kind === 'flower' ? mix(c, [98, 94, 76], .8) : kind === 'leafy' ? mix(c, [122, 120, 88], .5) : mix(c, [44, 80, 62], .45);
  return c;
}

// キャラの色：ふだんは明るいまま（夜でも暗くしない）。撮影で「景色になじませる」を選ぶと、時間帯と天気に合わせて暗くする
export function gradeChara([r, g, b], st) {
  const blend = st.photo?.light === 'blend';
  if (!blend) {   // 明るいまま。夜と夕暮れは、ほんの少しだけ光の色を足す
    if (st.time === 'night') { r *= .96; g *= .97; b = b * 1.02 + 4; }
    else if (st.time === 'evening' && st.weather === 'clear') { r = r * 1.02 + 4; g *= .97; b *= .95; }
    return [r, g, b];
  }
  if (st.time === 'night') { r = r * .62 * .8; g = g * .62 * .9; b = b * .62 * 1.25 + 8; }
  else if (st.time === 'evening' && st.weather === 'clear') { r = r * 1.02 + 6; g *= .9; b *= .86; }
  if (st.weather === 'rain' || st.weather === 'cloudy') { const l = r * .3 + g * .59 + b * .11; r = (r + (l - r) * .3) * .88; g = (g + (l - g) * .3) * .88; b = (b + (l - b) * .3) * .92; }
  return [r, g, b];
}
// キャラの置き場所（撮影で選べる）
//   ground：名所ごとの地面の決まり { base：ふだんの足もとの高さ（絵の高さに対する割合）, top：いちばん奥に立てる足もと, hz：遠近の消える高さ（目の高さ・水平線） }
//   st.photo：{ x：横のずれ（絵の幅に対する割合）, y：上下のずれ（絵の高さに対する割合。上が正）, s：大きさ, r：角度（ラジアン。左回りが正） }
//   返す値：dx（横のずれ）、feet（足もとの行）、s（大きさ）、r（角度）
//   奥へ動かしても大きさは変えない。上は地面の奥（ground.top）まで、下はカードの外へはみ出してよい（2026-11-25 くりたの希望）
export function charaPlace(st, W, H, ground) {
  const g = { base: .885, top: .75, ...ground };
  const f = Math.max(g.top, Math.min(2.4, g.base - (st.photo?.y || 0)));
  const s = Math.max(.4, Math.min(6, st.photo?.s || 1));
  return { dx: Math.round((st.photo?.x || 0) * W), feet: Math.round(H * f), s, r: st.photo?.r || 0 };
}
// 影の向き：晴れの日は太陽の向きに、体の形の影を地面へ落とす（朝は左奥、昼は短く右奥、夕方は右へ長く）
//   曇り・雨・雪・夜は光がやわらかいので、足もとに短い影だけ。k：足もとから高さ1のぶんのずれ [横, 奥]、fade：影にする高さ（キャラの背の何割まで。上ほど薄い）、op：濃さの倍率
export function shadowLight(st) {
  if (['cloudy', 'rain', 'snow'].includes(st?.weather) || st?.time === 'night') return { k: [.05, .14], fade: .3, op: 1.7 };
  return { morning: { k: [-.85, .2], fade: 1, op: 1.5 }, evening: { k: [1.1, .16], fade: 1, op: 1.4 } }[st?.time] || { k: [.3, .18], fade: 1, op: 1.6 };
}
// キャラを置く（大きさ s のときは足もとをそろえる。角度 r はキャラのまん中を軸に回す）。影はキャラの形を光の向きへ落とす
//   左はしと足もとを画面のマス（背景の 1/RS）にそろえて、ドットがにじまないようにする
export function placeChara(ch, cx, feet, s, H, drop, r = 0, st) {
  const w = ch.CW * s, h = ch.CH * s; ch.pickLod?.(s);
  const left = Math.round((cx - w / 2) * RS) / RS, bottom = Math.round((H - feet + drop) * RS) / RS;
  ch.chara.scale.set(s, s, 1); ch.chara.rotation.z = r;
  ch.chara.position.set(left + w / 2, bottom + h / 2, 4);
  const L = shadowLight(st), u = ch.shadow.material.uniforms;
  u.uC.value.set(left + w / 2, bottom + h / 2); u.uFoot.value.set(cx, Math.round(H - feet)); u.uS.value = s; u.uR.value = r;
  u.uK.value.set(L.k[0], L.k[1]); u.uFade.value = L.fade; u.uMul.value = L.op;
  ch.shadow.visible = feet < H;
}
