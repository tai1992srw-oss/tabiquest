// 仮の名所：写真を背景にして、キャラを重ねる（ドット絵ができるまでのつなぎ）
// 写真の形は変えず、時間帯・天気は色づけだけで表す。背景を描き足さない
import { gradeChara, charaPlace, placeChara } from './look.js';
import { near, palTex, setPal, makeLayer, makeChara, makeParticles, charaLods } from '../card.js';
import { recolorChara } from '../characolor.js';
const THREE = window.THREE;

let charaData = null;
async function chara() {
  if (!charaData) charaData = (async () => {
    const D = await (await fetch('assets/minatomirai/data.json')).json();
    const t = near(await new THREE.TextureLoader().loadAsync('assets/minatomirai/chara.png'));
    return { D, size: D.chara, pal: D.pal.chara, tex: t, frames: D.charaFrames || 1, blink: D.charaBlink || 0, lods: await charaLods('assets/minatomirai/', D, t) };
  })();
  return charaData;
}

// 時間帯と天気の色づけ：c' = mix(c, 灰色, desat) * mul + add
const TIME = {
  morning: { mul: [1.04, 1.0, .96], add: [.04, .03, .02], desat: 0 },
  day: { mul: [1, 1, 1], add: [0, 0, 0], desat: 0 },
  evening: { mul: [1.08, .8, .66], add: [.07, .01, .03], desat: .1 },
  night: { mul: [.34, .4, .62], add: [0, .01, .06], desat: .35 },
};
const WEATHER = {
  clear: { mul: [1, 1, 1], add: [0, 0, 0], desat: 0 },
  cloudy: { mul: [.9, .9, .93], add: [0, 0, 0], desat: .35 },
  rain: { mul: [.78, .8, .88], add: [0, 0, .02], desat: .45 },
  snow: { mul: [.96, .98, 1.02], add: [.06, .07, .09], desat: .35 },
};

// ドット絵の名所（みなとみらいなど）と同じ 229×407 マスで描く。キャラの大きさをそろえるため
const W = 229, H = 407, k = W / 360;

export async function build(place) {
  const scene = new THREE.Scene(); scene.userData = { W, H };
  const ph = await new THREE.TextureLoader().loadAsync(place.photo.src);
  ph.magFilter = THREE.NearestFilter; ph.minFilter = THREE.LinearFilter; ph.generateMipmaps = false;
  const C = await chara();

  const photo = makeLayer(scene, 0, `uniform sampler2D tPhoto; uniform vec3 uMul,uAdd; uniform float uDesat;
  void main(){ vec2 px=floor(vUv*uSize); px.y=uSize.y-1.-px.y; if(hidden(px)) discard;
    vec2 s=(px-uOff+vec2(5.,8.)+.5)/(uSize+vec2(10.,16.));
    vec3 c=texture2D(tPhoto,vec2(s.x,1.-s.y)).rgb; float l=lum(c);
    c=mix(c,vec3(l),uDesat)*uMul+uAdd; gl_FragColor=vec4(c,1.); }`);
  Object.assign(photo.material.uniforms, { tPhoto: { value: ph }, uMul: { value: new THREE.Vector3(1, 1, 1) }, uAdd: { value: new THREE.Vector3() }, uDesat: { value: 0 } });
  photo.material.needsUpdate = true;

  const ch = makeChara(scene, C.size, 0x100a26, .45, C.frames, C.blink);
  ch.chara.material.uniforms.tIdx.value = C.tex; ch.setLods(C.lods);
  const parts = makeParticles(scene, [Math.round(560 * k), H - 4]);

  const self = {
    scene, layers: [photo], ch, drop: 0,
    apply(st) {
      const t = TIME[st.time] || TIME.day, w = WEATHER[st.weather] || WEATHER.clear, u = photo.material.uniforms;
      u.uMul.value.set(t.mul[0] * w.mul[0], t.mul[1] * w.mul[1], t.mul[2] * w.mul[2]);
      u.uAdd.value.set(t.add[0] + w.add[0], t.add[1] + w.add[1], t.add[2] + w.add[2]);
      u.uDesat.value = Math.min(1, t.desat + w.desat);
      const night = st.time === 'night', eve = st.time === 'evening';
      setPal(ch.chara, palTex(C.pal, (c, i) => gradeChara(recolorChara(c, i, C.D), st)));
    },
    frame(par, f, newF, rm, st) {
      const off = v => Math.round(-par * v * k);
      photo.material.uniforms.uOff.value.set(off(5), 0);
      const cp = charaPlace(st, W, H, { base: .885, top: .76, hz: .56 }), cx = W / 2 + off(12) + cp.dx;
      ch.setPose(self.forcePose ?? st.photo?.pose ?? 0, f, rm);   // 到着の演出では forcePose（喜び）が優先
      placeChara(ch, cx, cp.feet, cp.s, H, self.drop, cp.r, st);
      ch.chara.material.uniforms.uOff.value.set(0, rm ? 0 : (Math.floor(f / 9) & 1));
      if (newF) parts.draw(f, st.weather);
    },
  };
  return self;
}
