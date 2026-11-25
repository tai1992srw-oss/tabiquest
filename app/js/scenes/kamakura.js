// 鎌倉高校前の踏切（昼）：Codex で作った元の絵を tools/make_kamakura.py で層に分けたもの
// 絵は昼の1枚だけ。朝・夕暮れ・夜と天気は、パレットの色づけだけで表す（形は変えない）
// 動き：海のきらめき、ときどき鳴る踏切のランプ（上下が交互に光る）、ランプが鳴るあいだに通る電車、空を横切るカモメ
// 電車とカモメの絵も Codex で作ったもの（tools/make_kamakura.py でカードの粗さと色にそろえた）。動かすのはコード
import { loadTextures, palTex, setPal, makeLayer, makeChara, makeParticles } from '../card.js';
const THREE = window.THREE;

// 時間帯と天気の色づけ：c' = mix(c, 灰色, desat) * mul + add（写真の名所と同じ考え方）
const TIME = {
  morning: { mul: [1.04, 1.0, .96], add: [10, 8, 4], desat: 0 },
  day: { mul: [1, 1, 1], add: [0, 0, 0], desat: 0 },
  evening: { mul: [1.1, .8, .66], add: [18, 2, 8], desat: .1 },
  night: { mul: [.3, .38, .62], add: [0, 2, 14], desat: .35 },
};
const WEATHER = {
  clear: { mul: [1, 1, 1], add: [0, 0, 0], desat: 0 },
  cloudy: { mul: [.9, .9, .93], add: [0, 0, 0], desat: .35 },
  rain: { mul: [.78, .8, .88], add: [0, 0, 4], desat: .45 },
  snow: { mul: [.96, .98, 1.02], add: [14, 16, 22], desat: .35 },
};

export async function build() {
  const base = 'assets/kamakura/';
  const D = await (await fetch(base + 'data.json')).json();
  const tex = await loadTextures(base, ['sky', 'scene', 'front', 'chara', 'train', 'gulls']);
  const W = D.W, H = D.H, k = W / 360;
  const scene = new THREE.Scene(); scene.userData = { W, H };

  function grade(c, layer, st) {
    const t = TIME[st.time] || TIME.day, w = WEATHER[st.weather] || WEATHER.clear;
    let [r, g, b] = c;
    if (layer === 'chara') { // キャラは背景ほど強く色を変えない
      if (st.time === 'night') { r = r * .62 * .8; g = g * .62 * .9; b = b * .62 * 1.25 + 8; }
      else if (st.time === 'evening') { r = r * 1.02 + 6; g *= .9; b *= .86; }
      if (st.weather === 'rain' || st.weather === 'cloudy') { const l = r * .3 + g * .59 + b * .11; r = (r + (l - r) * .3) * .88; g = (g + (l - g) * .3) * .88; b = (b + (l - b) * .3) * .92; }
      return [r, g, b];
    }
    const l = r * .3 + g * .59 + b * .11, ds = Math.min(1, t.desat + w.desat);
    r = (r + (l - r) * ds) * t.mul[0] * w.mul[0] + t.add[0] + w.add[0];
    g = (g + (l - g) * ds) * t.mul[1] * w.mul[1] + t.add[1] + w.add[1];
    b = (b + (l - b) * ds) * t.mul[2] * w.mul[2] + t.add[2] + w.add[2];
    return [r, g, b];
  }

  const sky = makeLayer(scene, 0, `void main(){ vec2 px=floor(vUv*uSize); px.y=uSize.y-1.-px.y; if(hidden(px)) discard; vec2 s=px-uOff; vec4 t=smp(s);
  gl_FragColor=vec4(pal(t.r),1.); }`);
  const SCENE_FRAG = `void main(){ vec2 px=floor(vUv*uSize); px.y=uSize.y-1.-px.y; if(hidden(px)) discard; vec2 s=px-uOff; vec4 t=smp(s); if(t.a<.5) discard;
  vec3 c=pal(t.r); float fl=floor(t.g*255.+.5), ph=hash(s);
  if(fl>.5 && fl<1.5){ float q=mod(ph*14.+uF,14.); if(q<2.) c=mix(c,vec3(1.),uNight>.5?.3:.75); else if(q<4.) c*=.9; }
  if(fl>1.5 && fl<2.5){ float on=step(.5,uLamp), side=step(.5,t.b), blink=mod(floor(uF/6.),2.);
    if(on>.5 && abs(side-blink)<.5) c=mix(vec3(1.,.16,.08),vec3(1.,.82,.6),step(.62,lum(c))); else c*=.42; }
  gl_FragColor=vec4(c,1.); }`;
  const scn = makeLayer(scene, 1, SCENE_FRAG);
  const front = makeLayer(scene, 3, SCENE_FRAG);   // 電車より手前にあるもの（壁・木・警報機の柱）

  // 電車：線路の上を横切る。uWet を「左右を反転する」印に使う
  const [TW, TH] = D.sprites.train;
  const train = makeLayer(scene, 2, `void main(){ vec2 px=floor(vUv*uSize); px.y=uSize.y-1.-px.y; vec2 s=px; if(uWet>.5) s.x=uSize.x-1.-s.x;
  vec4 t=smp(s); if(t.a<.5) discard; gl_FragColor=vec4(pal(t.r),1.); }`, TW, TH);
  // カモメ：2コマを横に並べた絵。uOff.x がコマ番号、uWet が左右反転
  const [GW, GH] = D.sprites.gull;
  const gulls = [0, 1, 2].map(i => makeLayer(scene, .5, `void main(){ vec2 px=floor(vUv*uSize); px.y=uSize.y-1.-px.y; vec2 s=px; if(uWet>.5) s.x=uSize.x-1.-s.x;
  vec4 t=texture2D(tIdx,(vec2(s.x+uOff.x*uSize.x,s.y)+.5)/vec2(uSize.x*2.,uSize.y)*vec2(1.,-1.)+vec2(0.,1.)); if(t.a<.5) discard; gl_FragColor=vec4(pal(t.r),1.); }`, GW, GH));
  const ch = makeChara(scene, D.chara, 0x1a2a44, .35);
  const parts = makeParticles(scene, [Math.round(H * .72), H - 4]);

  sky.material.uniforms.tIdx.value = tex.sky; scn.material.uniforms.tIdx.value = tex.scene; front.material.uniforms.tIdx.value = tex.front;
  train.material.uniforms.tIdx.value = tex.train; for (const g of gulls) g.material.uniforms.tIdx.value = tex.gulls; ch.chara.material.uniforms.tIdx.value = tex.chara;
  const self = {
    scene, layers: [sky, scn], ch, drop: 0,   // 到着演出で順に組み上がる層。手前の層は景色の層に合わせる
    apply(st) {
      setPal(sky, palTex(D.pal.main, c => grade(c, 'sky', st)));
      setPal(scn, palTex(D.pal.main, c => grade(c, 'scene', st))); setPal(front, palTex(D.pal.main, c => grade(c, 'scene', st)));
      setPal(train, palTex(D.pal.train, c => grade(c, 'scene', st)));
      for (const g of gulls) setPal(g, palTex(D.pal.gull, c => grade(c, 'scene', st)));
      self.gullsOn = st.time !== 'night' && !['rain', 'snow'].includes(st.weather);
      setPal(ch.chara, palTex(D.pal.chara, c => grade(c, 'chara', st)));
      scn.material.uniforms.uNight.value = front.material.uniforms.uNight.value = st.time === 'night' ? 1 : 0;
    },
    frame(par, f, newF, rm, st) {
      const off = v => Math.round(-par * v * k);
      sky.material.uniforms.uOff.value.set(off(3), 0); scn.material.uniforms.uOff.value.set(off(9), 0); front.material.uniforms.uOff.value.set(off(9), 0);
      front.material.uniforms.uReveal.value = scn.material.uniforms.uReveal.value;
      // 電車：踏切が鳴りはじめて1秒後から約3.5秒で通り抜ける。向きは1回ごとに入れかわる
      const cyc = Math.floor(f / 240), ph = f % 240 - 12, dir = cyc % 2 ? -1 : 1, run = 42;
      if (!rm && ph >= 0 && ph <= run) {
        const p = ph / run, x = dir > 0 ? -TW / 2 + p * (W + TW) : W + TW / 2 - p * (W + TW);
        train.visible = true; train.position.set(Math.round(x) - off(9), H - (D.RAIL - TH / 2), 2); train.material.uniforms.uWet.value = dir > 0 ? 0 : 1;
      } else train.visible = false;
      // カモメ：3羽がそれぞれの周期で空を横切る。羽ばたきは2コマ、ときどき羽を止めて滑空
      gulls.forEach((g, i) => {
        const per = [420, 560, 700][i], len = [300, 360, 420][i], q = (f + i * 170) % per;
        if (rm || !self.gullsOn || q >= len) { g.visible = false; return; }
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
        parts.draw(f, st.weather);
      }
    },
  };
  return self;
}
