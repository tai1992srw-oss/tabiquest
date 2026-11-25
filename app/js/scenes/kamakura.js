// 鎌倉高校前の踏切：Codex で作った元の絵を tools/make_kamakura.py・make_kamakura_skies.py で層に分けたもの
// 差分の分担（2026-11-25）
//   Codex の絵：昼の景色、空（朝・夕暮れ・夜・曇り・冬の富士山）、雪の日の景色、電車、カモメ
//   コード    ：時間帯・天気の色づけ、季節の色の差し替え（葉・あじさい）、夜の窓と灯台の明かり、
//               海のきらめき、踏切のランプ、電車とカモメの動き、雨・雪・落ち葉の粒、濡れた道の光
// 絵はコードで描き足さない（形が変わるものは Codex の絵を使う）
import { loadTextures, palTex, setPal, makeLayer, makeChara, makeParticles } from '../card.js';
const THREE = window.THREE;

// 時間帯と天気の色づけ：c' = mix(c, 灰色, desat) * mul + add（写真の名所と同じ考え方）
const TIME = {
  morning: { mul: [1.04, 1.0, .96], add: [10, 8, 4], desat: 0 },
  day: { mul: [1, 1, 1], add: [0, 0, 0], desat: 0 },
  evening: { mul: [1.05, .88, .8], add: [10, 2, 8], desat: .08 },
  night: { mul: [.3, .38, .62], add: [0, 2, 14], desat: .35 },
};
// 曇り・雨・雪の日の時間帯：日が差さないので夕焼けの色にはならない。暗くなるだけ（少し青みの灰色）
const TIME_GRAY = {
  morning: { mul: [.96, .97, 1.0], add: [4, 5, 8], desat: .05 },
  day: { mul: [1, 1, 1], add: [0, 0, 0], desat: 0 },
  evening: { mul: [.74, .75, .82], add: [2, 2, 8], desat: .15 },
  night: { mul: [.3, .36, .55], add: [0, 2, 12], desat: .35 },
};
const WEATHER = {
  clear: { mul: [1, 1, 1], add: [0, 0, 0], desat: 0 },
  cloudy: { mul: [.86, .87, .9], add: [6, 7, 10], desat: .5, flat: .15 },
  rain: { mul: [.74, .76, .84], add: [4, 5, 10], desat: .55, flat: .12 },
  snow: { mul: [.94, .96, 1.0], add: [6, 8, 12], desat: .25 },
};
// flat：明るいところと暗いところの差を小さくする（曇りの日は影がぼやけ、全体が平らに見える）
const tint = ([r, g, b], t) => { const l = r * .3 + g * .59 + b * .11, f = t.flat || 0; const o = [(r + (l - r) * t.desat) * t.mul[0] + t.add[0], (g + (l - g) * t.desat) * t.mul[1] + t.add[1], (b + (l - b) * t.desat) * t.mul[2] + t.add[2]]; return o.map(v => v + (128 - v) * f); };
const both = (a, b) => ({ mul: a.mul.map((v, i) => v * b.mul[i]), add: a.add.map((v, i) => v + b.add[i]), desat: Math.min(1, a.desat + b.desat), flat: (a.flat || 0) + (b.flat || 0) });
const mix = (c, d, k) => c.map((v, i) => v + (d[i] - v) * k);

// 色の種類（32色のパレットから、葉・黄緑の葉・あじさいを見分ける）
function kindOf([r, g, b]) {
  const mx = Math.max(r, g, b) / 255, mn = Math.min(r, g, b) / 255, l = (mx + mn) / 2, d = mx - mn;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1)); let h = 0;
  if (d) { const R = r / 255, G = g / 255, B = b / 255; h = mx === R ? ((G - B) / d) % 6 : mx === G ? (B - R) / d + 2 : (R - G) / d + 4; h = (h * 60 + 360) % 360; }
  if (h >= 70 && h <= 170 && s > .25) return 'leaf';
  if (h >= 45 && h < 70 && s > .3 && s < .65 && l < .55) return 'leafy';
  if (h >= 270 && h <= 330 && s > .4) return 'flower';
  return '';
}
// 季節の色の差し替え（夏が元の絵）
function season(c, kind, s) {
  if (!kind || s === 'summer') return c;
  const l = (c[0] * .3 + c[1] * .59 + c[2] * .11) / 255;
  if (s === 'spring') return kind === 'flower' ? mix(c, [112, 172, 84], .85) : mix(c, kind === 'leaf' ? [150, 206, 86] : [196, 206, 96], .3);
  if (s === 'autumn') return kind === 'flower' ? mix(c, [140, 104, 78], .8) : kind === 'leafy' ? mix(c, [214, 158, 52], .65) : mix(c, l < .32 ? [122, 50, 36] : [224, 118, 44], .72);
  if (s === 'winter') return kind === 'flower' ? mix(c, [98, 94, 76], .8) : kind === 'leafy' ? mix(c, [122, 120, 88], .5) : mix(c, [44, 80, 62], .45);
  return c;
}

export async function build() {
  const base = 'assets/kamakura/';
  const D = await (await fetch(base + 'data.json')).json();
  const skyNames = Object.values(D.skies || {});
  const tex = await loadTextures(base, ['sky', 'scene', 'front', 'chara', 'train', 'gulls', ...skyNames, ...(D.snowScene ? ['scene_snow', 'front_snow'] : [])]);
  const W = D.W, H = D.H, k = W / 360;
  const scene = new THREE.Scene(); scene.userData = { W, H };
  const kinds = { main: D.pal.main.map(kindOf), main_snow: (D.pal.main_snow || []).map(() => '') };
  // 電車の窓（水色で明るい色）は、夕暮れ・夜に明かりをつける
  const trainWin = D.pal.train.map(([r, g, b]) => b > r + 30 && r * .3 + g * .59 + b * .11 > 140);

  const sky = makeLayer(scene, 0, `void main(){ vec2 px=floor(vUv*uSize); px.y=uSize.y-1.-px.y; if(hidden(px)) discard; vec2 s=px-uOff; vec4 t=smp(s);
  gl_FragColor=vec4(pal(t.r),1.); }`);
  // 印：1＝海のきらめき 2＝踏切のランプ 3＝家の窓 4＝江の島の灯台
  // uNight：0＝昼 .5＝夕暮れ 1＝夜、uStretch：きらめきの強さ（晴れ1、曇り・雨・雪0）、uWet：濡れた道
  // 海のマス（B＝128）は、空の差分を使うとき、空の絵に描かれた海の色にする（夕焼けや月の映る海）
  const SCENE_FRAG = `uniform sampler2D tSky,tSkyPal; uniform float uSeaSky; uniform vec2 uSkyOff;
  void main(){ vec2 px=floor(vUv*uSize); px.y=uSize.y-1.-px.y; if(hidden(px)) discard; vec2 s=px-uOff; vec4 t=smp(s); if(t.a<.5) discard;
  vec3 c=pal(t.r); float fl=floor(t.g*255.+.5), ph=hash(s), sea=step(abs(t.b*255.-128.),2.);
  if(sea>.5 && uSeaSky>.5){ vec2 q=px-uSkyOff; vec4 k=texture2D(tSky,clamp((q+.5)/uSize,0.,1.)*vec2(1.,-1.)+vec2(0.,1.)); c=texture2D(tSkyPal,vec2((floor(k.r*255.+.5)+.5)/256.,.5)).rgb; }
  if(fl>.5 && fl<1.5 && uStretch>.5){ float q=mod(ph*14.+uF,14.); if(q<2.) c=mix(c,uNight>.25&&uNight<.75?vec3(1.,.82,.5):vec3(1.),uNight>.75?.3:.7); else if(q<4.) c*=.9; }
  if(fl>1.5 && fl<2.5 && sea<.5){ float on=step(.5,uLamp), side=step(.5,t.b), blink=mod(floor(uF/6.),2.);
    if(on>.5 && abs(side-blink)<.5) c=mix(vec3(1.,.16,.08),vec3(1.,.82,.6),step(.62,lum(c))); else c*=.42; }
  if(fl>2.5 && fl<3.5 && uNight>.25){ vec3 w=mix(vec3(1.,.74,.38),vec3(1.,.9,.62),step(.5,fract(ph*5.))); c=mix(c,w,uNight>.75?.92:.5); }
  if(fl>3.5 && fl<4.5 && uNight>.25 && mod(uF,24.)<7.) c=vec3(1.,.95,.72);
  if(uWet>.5 && s.y>${Math.round(H * .7)}. && lum(c)<.62 && mod(ph*26.+uF*.5,26.)<1.) c=mix(c,vec3(.78,.82,.92),.4);
  gl_FragColor=vec4(c,1.); }`;
  const scn = makeLayer(scene, 1, SCENE_FRAG);
  const front = makeLayer(scene, 3, SCENE_FRAG);   // 電車より手前にあるもの（壁・木・警報機の柱）
  for (const m of [scn, front]) { Object.assign(m.material.uniforms, { tSky: { value: null }, tSkyPal: { value: null }, uSeaSky: { value: 0 }, uSkyOff: { value: new THREE.Vector2() } }); m.material.needsUpdate = true; }

  // 電車：線路の上を横切る。uWet を「左右を反転する」印に使う
  const [TW, TH] = D.sprites.train;
  const train = makeLayer(scene, 2, `void main(){ vec2 px=floor(vUv*uSize); px.y=uSize.y-1.-px.y; vec2 s=px; if(uWet>.5) s.x=uSize.x-1.-s.x;
  vec4 t=smp(s); if(t.a<.5) discard; gl_FragColor=vec4(pal(t.r),1.); }`, TW, TH);
  // カモメ：2コマを横に並べた絵。uOff.x がコマ番号、uWet が左右反転
  const [GW, GH] = D.sprites.gull;
  const gulls = [0, 1, 2].map(() => makeLayer(scene, .5, `void main(){ vec2 px=floor(vUv*uSize); px.y=uSize.y-1.-px.y; vec2 s=px; if(uWet>.5) s.x=uSize.x-1.-s.x;
  vec4 t=texture2D(tIdx,(vec2(s.x+uOff.x*uSize.x,s.y)+.5)/vec2(uSize.x*2.,uSize.y)*vec2(1.,-1.)+vec2(0.,1.)); if(t.a<.5) discard; gl_FragColor=vec4(pal(t.r),1.); }`, GW, GH));
  const ch = makeChara(scene, D.chara, 0x1a2a44, .35);
  const parts = makeParticles(scene, [Math.round(H * .72), H - 4]);

  train.material.uniforms.tIdx.value = tex.train; for (const g of gulls) g.material.uniforms.tIdx.value = tex.gulls; ch.chara.material.uniforms.tIdx.value = tex.chara;

  // どの空を使うか：曇り・雨・雪は曇り空、晴れは時間帯の空（冬の昼は富士山の見える空）
  function skyOf(st) {
    if (['cloudy', 'rain', 'snow'].includes(st.weather)) return 'overcast';
    if (st.time === 'day') return st.season === 'winter' ? 'winter' : 'day';
    return st.time;
  }

  const self = {
    scene, layers: [sky, scn], ch, drop: 0,   // 到着演出で順に組み上がる層。手前の層は景色の層に合わせる
    apply(st) {
      const gray = ['cloudy', 'rain', 'snow'].includes(st.weather);
      const t = (gray ? TIME_GRAY : TIME)[st.time] || TIME.day, w = WEATHER[st.weather] || WEATHER.clear, tw = both(t, w);
      // 空
      const sn = skyOf(st), sname = D.skies?.[sn];
      sky.material.uniforms.tIdx.value = sname ? tex[sname] : tex.sky;
      const own = sname && sn !== 'overcast';   // 時間帯の色がもう入っている空は、天気の色だけ
      setPal(sky, palTex(sname ? D.pal[sname] : D.pal.main, c => tint(c, own ? w : tw)));
      for (const m of [scn, front]) { m.material.uniforms.tSky.value = sky.material.uniforms.tIdx.value; m.material.uniforms.tSkyPal.value = sky.material.uniforms.tPal.value; m.material.uniforms.uSeaSky.value = sname ? 1 : 0; }
      // 景色：雪の日は雪の絵。それ以外は季節の色を差し替えてから、時間帯・天気の色づけ
      const snow = st.weather === 'snow' && D.snowScene;
      const pkey = snow ? 'main_snow' : 'main';
      scn.material.uniforms.tIdx.value = snow ? tex.scene_snow : tex.scene;
      front.material.uniforms.tIdx.value = snow ? tex.front_snow : tex.front;
      const sp = palTex(D.pal[pkey], (c, i) => tint(snow ? c : season(c, kinds[pkey][D.pal[pkey].indexOf(c)], st.season), snow ? both(t, WEATHER.cloudy) : tw));
      setPal(scn, sp); setPal(front, palTex(D.pal[pkey], (c) => tint(snow ? c : season(c, kinds[pkey][D.pal[pkey].indexOf(c)], st.season), snow ? both(t, WEATHER.cloudy) : tw)));
      const night = st.time === 'night' ? 1 : st.time === 'evening' ? .5 : 0;
      for (const m of [scn, front]) {
        m.material.uniforms.uNight.value = night;
        m.material.uniforms.uStretch.value = st.weather === 'clear' ? 1 : 0;
        m.material.uniforms.uWet.value = st.weather === 'rain' ? 1 : 0;
      }
      setPal(train, palTex(D.pal.train, (c, ) => { const i = D.pal.train.indexOf(c); return night && trainWin[i] ? mix(c, [255, 222, 150], night > .75 ? .85 : .45) : tint(c, tw); }));
      for (const g of gulls) setPal(g, palTex(D.pal.gull, c => tint(c, tw)));
      // カモメ：夏は3羽、春・秋は2羽、冬と曇りは1羽。夜・雨・雪は出ない
      self.gullN = st.time === 'night' || ['rain', 'snow'].includes(st.weather) ? 0 : st.weather === 'cloudy' || st.season === 'winter' ? 1 : st.season === 'summer' ? 3 : 2;
      self.leaves = st.season === 'autumn' && st.weather !== 'snow';
      setPal(ch.chara, palTex(D.pal.chara, c => {
        let [r, g, b] = c;  // キャラは背景ほど強く色を変えない
        if (st.time === 'night') { r = r * .62 * .8; g = g * .62 * .9; b = b * .62 * 1.25 + 8; }
        else if (st.time === 'evening') { r = r * 1.02 + 6; g *= .9; b *= .86; }
        if (st.weather === 'rain' || st.weather === 'cloudy') { const l = r * .3 + g * .59 + b * .11; r = (r + (l - r) * .3) * .88; g = (g + (l - g) * .3) * .88; b = (b + (l - b) * .3) * .92; }
        return [r, g, b];
      }));
    },
    frame(par, f, newF, rm, st) {
      const off = v => Math.round(-par * v * k);
      sky.material.uniforms.uOff.value.set(off(3), 0); scn.material.uniforms.uOff.value.set(off(9), 0); front.material.uniforms.uOff.value.set(off(9), 0);
      scn.material.uniforms.uSkyOff.value.set(off(3), 0);
      front.material.uniforms.uReveal.value = scn.material.uniforms.uReveal.value;
      // 電車：踏切が鳴りはじめて1秒後から約3.5秒で通り抜ける。向きは1回ごとに入れかわる
      const cyc = Math.floor(f / 240), ph = f % 240 - 12, dir = cyc % 2 ? -1 : 1, run = 42;
      if (!rm && ph >= 0 && ph <= run) {
        const p = ph / run, x = dir > 0 ? -TW / 2 + p * (W + TW) : W + TW / 2 - p * (W + TW);
        train.visible = true; train.position.set(Math.round(x) - off(9), H - (D.RAIL - TH / 2), 2); train.material.uniforms.uWet.value = dir > 0 ? 0 : 1;
      } else train.visible = false;
      // カモメ：それぞれの周期で空を横切る。羽ばたきは2コマ、ときどき羽を止めて滑空
      gulls.forEach((g, i) => {
        const per = [420, 560, 700][i], len = [300, 360, 420][i], q = (f + i * 170) % per;
        if (rm || i >= self.gullN || q >= len) { g.visible = false; return; }
        const p = q / len, right = i !== 1, x = right ? -GW + p * (W + GW * 2) : W + GW - p * (W + GW * 2);
        const y = [62, 96, 40][i] + Math.round(Math.sin(f / 9 + i) * 3);
        g.visible = true; g.position.set(Math.round(x) - off(3), H - y, .5);
        g.material.uniforms.uWet.value = right ? 0 : 1;
        g.material.uniforms.uOff.value.set(Math.floor(f / 3 + i) % 8 < 6 ? Math.floor(f / 3 + i) % 2 : 1, 0);
      });
      const cx = W / 2 + off(14), feet = Math.round(H * .945);
      ch.chara.position.set(cx, H - (feet - ch.CH / 2) + self.drop, 4); ch.shadow.position.set(cx, H - feet + 1, 3);
      ch.chara.material.uniforms.uOff.value.set(0, rm ? 0 : (Math.floor(f / 9) & 1));
      if (newF) {
        scn.material.uniforms.uF.value = front.material.uniforms.uF.value = rm ? 0 : f;
        // 踏切は20秒に1回、5秒だけ鳴る（動きを減らす設定では鳴らさない）
        scn.material.uniforms.uLamp.value = front.material.uniforms.uLamp.value = !rm && f % 240 < 60 ? 1 : 0;
        parts.draw(f, st.weather, { leaves: self.leaves && !rm });
      }
    },
  };
  return self;
}
