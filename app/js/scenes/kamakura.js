// 鎌倉高校前の踏切：Codex で作った元の絵を tools/make_kamakura.py・make_kamakura_skies.py で層に分けたもの
// 差分の分担（2026-11-25）
//   Codex の絵：昼の景色、空（朝・夕暮れ・夜・曇り・冬の富士山）、雪の日の景色、電車、カモメ
//   コード    ：時間帯・天気の色づけ、季節の色の差し替え（葉・あじさい）、夜の窓と灯台の明かり、
//               海のきらめき、踏切のランプ、電車とカモメの動き、雨・雪・落ち葉の粒、濡れた道の光
// 絵はコードで描き足さない（形が変わるものは Codex の絵を使う）
import { loadTextures, palTex, setPal, makeLayer, makeChara, makeParticles } from '../card.js';
import { TIME, TIME_GRAY, WEATHER, tint, both, mix, kindOf, season, gradeChara, charaPlace, placeChara } from './look.js';
const THREE = window.THREE;

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
  const ch = makeChara(scene, D.chara, 0x1a2a44, .35, D.charaFrames || 1);
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
      setPal(ch.chara, palTex(D.pal.chara, c => gradeChara(c, st)));
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
      // 地面：踏切の手前まで奥に行ける。目の高さは海の水平線
      const cp = charaPlace(st, W, H, { base: .885, top: .70, hz: D.HOR / H }), cx = W / 2 + off(14) + cp.dx;
      ch.setPose(self.forcePose ?? st.photo?.pose ?? 0);   // 到着の演出では forcePose（喜び）が優先
      placeChara(ch, cx, cp.feet, cp.s, H, self.drop);
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
