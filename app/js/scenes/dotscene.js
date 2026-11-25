// ドット絵の名所の共通の描画（2026-11-25、鎌倉高校前の作りを、名所ごとの設定で動かせる形にしたもの）
// 絵は Codex の元の絵を tools/make_<名所>.py で層に分けたもの。コードでは絵を描き足さない
//   層：空／景色／手前（動く物より前にあるもの）／キャラ
//   差分：昼の絵・夜の絵・雪の絵（どれも同じ位置）と、空（朝・夕暮れ・夜・曇り・冬）を組み合わせる
//   印（景色の G）：1＝海のきらめき 2＝街灯の灯り 3＝窓（夜にまたたく） 5＝観覧車の輪（夜に色が回る。B＝角度） 6＝提灯（夕暮れ・夜に灯る）
import { loadTextures, palTex, setPal, makeLayer, makeChara, makeParticles, charaLods } from '../card.js';
import { recolorChara } from '../characolor.js';
import { TIME, TIME_GRAY, WEATHER, tint, both, mix, kindOf, season, gradeChara, charaPlace, placeChara } from './look.js';
const THREE = window.THREE;

// 海のマス（B＝128）：空の差分を使うとき、空を上下に反転して映す（uRefl＝水面の行。0なら映さない）
const FRAG = `uniform sampler2D tSky,tSkyPal; uniform float uRefl; uniform vec2 uSkyOff;
  void main(){ vec2 px=floor(vUv*uSize); px.y=uSize.y-1.-px.y; if(hidden(px)) discard; vec2 s=px-uOff; vec4 t=smp(s); if(t.a<.5) discard;
  vec3 c=pal(t.r); float fl=floor(t.g*255.+.5), ph=hash(s);
  if(uRefl>.5 && abs(t.b*255.-128.)<2.){ vec2 q=vec2(px.x-uSkyOff.x+floor(sin(px.y*1.7+uF*.3)*2.), 2.*uRefl-px.y);
    vec4 k=texture2D(tSky,clamp((q+.5)/uSize,0.,1.)*vec2(1.,-1.)+vec2(0.,1.)); vec3 r=texture2D(tSkyPal,vec2((floor(k.r*255.+.5)+.5)/256.,.5)).rgb;
    c=r*(.72+.9*(lum(c)-.45)); }
  if(fl>.5 && fl<1.5 && uStretch>.5){ float q=mod(ph*14.+uF,14.); if(q<2.) c=mix(c,uNight>.25&&uNight<.75?vec3(1.,.82,.5):vec3(1.),uNight>.75?.35:.7); else if(q<4.) c*=.9; }
  if(fl>1.5 && fl<2.5 && uNight>.25){ c=mix(c,vec3(1.,.86,.55),uNight>.75?.25:.6); c*=1.+.06*sin(uF*.9+ph*6.); }
  if(fl>2.5 && fl<3.5 && uNight>.75 && fract(ph*7.)<.12 && mod(ph*60.+uF,60.)<3.) c*=.45;
  if(fl>4.5 && fl<5.5 && uNight>.75 && lum(c)>.45){ float h=fract(t.b*3.+uF/32.); vec3 pc=h<.2?vec3(1.,.35,.54):h<.4?vec3(1.,.78,.34):h<.6?vec3(.42,.94,.75):h<.8?vec3(.35,.7,1.):vec3(.75,.48,1.); c=mix(c,pc,.65); }
  if(fl>5.5 && fl<6.5 && uNight>.25){ c=mix(c,vec3(1.,.5,.25),uNight>.75?.15:.35)*(1.+.08*sin(uF*.7+ph*9.)); }
  if(uWet>.5 && s.y>uSize.y*.72 && lum(c)<.62 && mod(ph*26.+uF*.5,26.)<1.) c=mix(c,vec3(.78,.82,.92),.4);
  gl_FragColor=vec4(c,1.); }`;

// 横にずれて動く物（電車・船）。uWet＝左右反転
const SPRITE = `void main(){ vec2 px=floor(vUv*uSize); px.y=uSize.y-1.-px.y; vec2 s=px; if(uWet>.5) s.x=uSize.x-1.-s.x;
  vec4 t=smp(s); if(t.a<.5) discard; gl_FragColor=vec4(pal(t.r),1.); }`;
// カモメ：2コマを横に並べた絵。uOff.x がコマ番号
const GULL = `void main(){ vec2 px=floor(vUv*uSize); px.y=uSize.y-1.-px.y; vec2 s=px; if(uWet>.5) s.x=uSize.x-1.-s.x;
  vec4 t=texture2D(tIdx,(vec2(s.x+uOff.x*uSize.x,s.y)+.5)/vec2(uSize.x*2.,uSize.y)*vec2(1.,-1.)+vec2(0.,1.)); if(t.a<.5) discard; gl_FragColor=vec4(pal(t.r),1.); }`;

// cfg：{ base, ground（キャラの地面：look.js の charaPlace）, gulls（カモメの高さの列。なければ出さない）, boat（船が通るなら true）,
//        steam（湯気を出す場所 [[x,y],...]）, par（層ごとのずれの大きさ [空,景色,キャラ]） }
export async function buildDot(cfg) {
  const base = cfg.base;
  const D = await (await fetch(base + 'data.json')).json();
  const skyNames = [...new Set(Object.values(D.skies || {}))];
  const names = ['sky', 'scene', 'front', 'chara', ...skyNames];
  if (D.pal.main_night) names.push('scene_night', 'front_night');
  if (D.snowScene) names.push('scene_snow', 'front_snow');
  if (D.sprites?.boat) names.push('boat');
  if (D.sprites?.gull) names.push('gulls');
  const tex = await loadTextures(base, names);
  const W = D.W, H = D.H, k = W / 360, P = cfg.par || [3, 9, 14];
  const scene = new THREE.Scene(); scene.userData = { W, H };
  const kinds = D.kinds || D.pal.main.map(kindOf);   // kinds：色番号ごとの種類を名所の側で決めたいとき（芝生など）

  const sky = makeLayer(scene, 0, `void main(){ vec2 px=floor(vUv*uSize); px.y=uSize.y-1.-px.y; if(hidden(px)) discard; vec2 s=px-uOff; vec4 t=smp(s); gl_FragColor=vec4(pal(t.r),1.); }`);
  const scn = makeLayer(scene, 1, FRAG);
  const front = makeLayer(scene, 3, FRAG);
  for (const m of [scn, front]) { Object.assign(m.material.uniforms, { tSky: { value: null }, tSkyPal: { value: null }, uRefl: { value: 0 }, uSkyOff: { value: new THREE.Vector2() } }); m.material.needsUpdate = true; }
  let boat = null, BW = 0, BH = 0, boatWin = [];
  if (D.sprites?.boat) { [BW, BH] = D.sprites.boat; boat = makeLayer(scene, 2, SPRITE, BW, BH); boat.material.uniforms.tIdx.value = tex.boat;
    boatWin = D.pal.boat.map(([r, g, b]) => b > r + 30 && r * .3 + g * .59 + b * .11 > 130); }
  const gulls = D.sprites?.gull && cfg.gulls ? cfg.gulls.map(() => makeLayer(scene, .5, GULL, ...D.sprites.gull)) : [];
  for (const g of gulls) g.material.uniforms.tIdx.value = tex.gulls;
  const [GW] = D.sprites?.gull || [0];
  const ch = makeChara(scene, D.chara, 0x1a2a44, .35, D.charaFrames || 1, D.charaBlink || 0); ch.chara.material.uniforms.tIdx.value = tex.chara;
  ch.setLods(await charaLods(base, D, tex.chara));
  const parts = makeParticles(scene, [Math.round(H * .74), H - 4]);

  function skyOf(st) {
    if (['cloudy', 'rain', 'snow'].includes(st.weather)) return 'overcast';
    if (st.time === 'day') return st.season === 'winter' ? 'winter' : 'day';
    return st.time;
  }

  const self = {
    scene, layers: [sky, scn], ch, drop: 0,
    apply(st) {
      const gray = ['cloudy', 'rain', 'snow'].includes(st.weather);
      const t = (gray ? TIME_GRAY : TIME)[st.time] || TIME.day, w = WEATHER[st.weather] || WEATHER.clear, tw = both(t, w);
      // 景色：雪の日は雪の絵、夜は夜の絵、それ以外は昼の絵（季節の色を差し替える）
      const v = st.weather === 'snow' && D.snowScene ? 'snow' : st.time === 'night' && D.pal.main_night ? 'night' : 'day';
      const pkey = { day: 'main', night: 'main_night', snow: 'main_snow' }[v];
      scn.material.uniforms.tIdx.value = tex[v === 'day' ? 'scene' : 'scene_' + v];
      front.material.uniforms.tIdx.value = tex[v === 'day' ? 'front' : 'front_' + v];
      const g = v === 'night' ? (gray ? both({ mul: [.85, .86, .92], add: [0, 0, 0], desat: .25 }, w) : w) : v === 'snow' ? both(t, WEATHER.cloudy) : tw;
      const sc = c => tint(v === 'day' ? season(c, kinds[D.pal.main.indexOf(c)], st.season) : c, g);
      setPal(scn, palTex(D.pal[pkey], sc)); setPal(front, palTex(D.pal[pkey], sc));
      // 空
      const sn = skyOf(st), sname = D.skies?.[sn];
      sky.material.uniforms.tIdx.value = sname ? tex[sname] : tex.sky;
      const own = sname && sn !== 'overcast';
      setPal(sky, palTex(sname ? D.pal[sname] : D.pal.main, c => tint(c, own ? w : tw)));
      // 海に空を映すのは、昼の絵・雪の絵で空を差し替えたとき（夜の絵は海の明かりがもう描かれている）
      for (const m of [scn, front]) { m.material.uniforms.tSky.value = sky.material.uniforms.tIdx.value; m.material.uniforms.tSkyPal.value = sky.material.uniforms.tPal.value; m.material.uniforms.uRefl.value = sname && v !== 'night' && D.WATER ? D.WATER : 0; }
      const night = st.time === 'night' ? 1 : st.time === 'evening' ? .5 : 0;
      for (const m of [scn, front]) {
        m.material.uniforms.uNight.value = night;
        m.material.uniforms.uStretch.value = st.weather === 'clear' ? 1 : 0;
        m.material.uniforms.uWet.value = st.weather === 'rain' ? 1 : 0;
      }
      if (boat) setPal(boat, palTex(D.pal.boat, c => { const i = D.pal.boat.indexOf(c); return night && boatWin[i] ? mix(c, [255, 222, 150], night > .75 ? .85 : .45) : tint(c, tw); }));
      for (const gl of gulls) setPal(gl, palTex(D.pal.gull, c => tint(c, tw)));
      self.gullN = st.time === 'night' || ['rain', 'snow'].includes(st.weather) ? 0 : st.weather === 'cloudy' || st.season === 'winter' ? 1 : st.season === 'summer' ? 3 : 2;
      self.leaves = st.season === 'autumn' && st.weather !== 'snow' && cfg.leaves;
      self.steam = cfg.steam && st.weather !== 'rain' ? cfg.steam : null;
      setPal(ch.chara, palTex(D.pal.chara, (c, i) => gradeChara(recolorChara(c, i, D), st)));
    },
    frame(par, f, newF, rm, st) {
      const off = v => Math.round(-par * v * k);
      sky.material.uniforms.uOff.value.set(off(P[0]), 0); scn.material.uniforms.uOff.value.set(off(P[1]), 0); front.material.uniforms.uOff.value.set(off(P[1]), 0);
      scn.material.uniforms.uSkyOff.value.set(off(P[0]), 0); front.material.uniforms.uSkyOff.value.set(off(P[0]), 0);
      front.material.uniforms.uReveal.value = scn.material.uniforms.uReveal.value;
      // 船：30秒に1回、ゆっくり横切る（向きは1回ごとに入れかわる）
      if (boat) {
        const cyc = Math.floor(f / 360), ph = f % 360, run = 240, dir = cyc % 2 ? -1 : 1;
        if (!rm && ph < run) {
          const p = ph / run, x = dir > 0 ? -BW / 2 + p * (W + BW) : W + BW / 2 - p * (W + BW);
          boat.visible = true; boat.position.set(Math.round(x) - off(P[1]), H - (D.boatY - BH / 2) + ((f >> 3) & 1), 2); boat.material.uniforms.uWet.value = dir > 0 ? 0 : 1;
        } else boat.visible = false;
      }
      gulls.forEach((g, i) => {
        const per = [420, 560, 700][i % 3], len = [300, 360, 420][i % 3], q = (f + i * 170) % per;
        if (rm || i >= self.gullN || q >= len) { g.visible = false; return; }
        const p = q / len, right = i !== 1, x = right ? -GW + p * (W + GW * 2) : W + GW - p * (W + GW * 2);
        g.visible = true; g.position.set(Math.round(x) - off(P[0]), H - (cfg.gulls[i] + Math.round(Math.sin(f / 9 + i) * 3)), .5);
        g.material.uniforms.uWet.value = right ? 0 : 1;
        g.material.uniforms.uOff.value.set(Math.floor(f / 3 + i) % 8 < 6 ? Math.floor(f / 3 + i) % 2 : 1, 0);
      });
      const cp = charaPlace(st, W, H, cfg.ground), cx = W / 2 + off(P[2]) + cp.dx;
      ch.setPose(self.forcePose ?? st.photo?.pose ?? 0, f, rm);   // 到着の演出では forcePose（喜び）が優先
      placeChara(ch, cx, cp.feet, cp.s, H, self.drop, cp.r);
      ch.chara.material.uniforms.uOff.value.set(0, rm ? 0 : (Math.floor(f / 9) & 1));
      if (newF) {
        scn.material.uniforms.uF.value = front.material.uniforms.uF.value = rm ? 0 : f;
        parts.draw(f, st.weather, { leaves: self.leaves && !rm, steam: !rm && self.steam });
      }
    },
  };
  return self;
}
