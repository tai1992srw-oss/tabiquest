// 横浜中華街：chukagai_canva/page.html の層と動きを移したもの
import { W, H, loadTextures, palTex, setPal, makeLayer, makeChara, makeParticles } from '../card.js';
const THREE = window.THREE;

export async function build() {
  const base = 'assets/chukagai/';
  const D = await (await fetch(base + 'data.json')).json();
  const tex = await loadTextures(base, ['sky_night', 'sky_evening', 'scene_night', 'chara']);
  const scene = new THREE.Scene();

  // 夕暮れは夜の絵の色番号を差し替えて作った差分（空はみなとみらいの夕暮れを流用）
  function grade(c, layer, st) {
    let [r, g, b] = c; const l = r * .3 + g * .59 + b * .11, eve = st.time === 'evening', warm = r > b + 40 && l > 110;
    if (layer === 'scene' && eve) { const k = warm ? .1 : 1; r = r * (1 + .28 * k) + 46 * k * (1 - l / 255); g = g * (1 + .12 * k) + 20 * k * (1 - l / 255); b = b * (1 + .02 * k) + 30 * k * (1 - l / 255); if (warm && l > 190) { r *= .96; g *= .9; b *= .82; } }
    if (layer === 'chara') { if (eve) { r = r * .95 + 8; g = g * .86; b = b * .9; } else { r = r * .8 + 12; g = g * .68; b = b * .8 + 10; } }
    if (st.weather === 'cloudy') { const k = warm ? .1 : .28; r = (r + (l - r) * k) * .93; g = (g + (l - g) * k) * .93; b = (b + (l - b) * k) * .96; }
    if (st.weather === 'rain') { const k = warm ? .2 : .5; r = (r + (l * .82 - r) * k) * .84; g = (g + (l * .9 - g) * k) * .84; b = (b + (l * 1.05 - b) * k) * .88; }
    if (st.weather === 'snow') { const k = warm ? .12 : .34; r = r + (l * .95 - r) * k + 8; g = g + (l - g) * k + 10; b = b + (l * 1.08 - b) * k + 16; }
    return [r, g, b];
  }

  const sky = makeLayer(scene, 0, `void main(){ vec2 px=floor(vUv*uSize); px.y=uSize.y-1.-px.y; if(hidden(px)) discard; vec2 s=px-uOff; s.y=floor(s.y*uStretch); vec4 t=smp(s); vec3 c=pal(t.r);
  float ph=hash(s); if(uNight>.5 && lum(c)>.45 && mod(ph*40.+uF,40.)<5.) c*=.45;
  gl_FragColor=vec4(c,1.); }`);
  const scn = makeLayer(scene, 1, `void main(){ vec2 px=floor(vUv*uSize); px.y=uSize.y-1.-px.y; if(hidden(px)) discard; vec2 s=px-uOff; vec4 t=smp(s); if(t.a<.5) discard; vec3 c=pal(t.r); float fl=floor(t.g*255.+.5), ph=hash(s);
  if(mod(fl,2.)>.5){ float w=.5+.5*sin(uF*.35+floor(s.x/14.)*1.7+floor(s.y/30.)); c*= .88+.2*w; }
  if(fl>1.5 && fract(ph*7.)<.08 && mod(ph*60.+uF,60.)<3.) c*=.55;
  if(uWet>.5 && s.y>430. && lum(c)>.42 && mod(ph*20.+uF,20.)<2.) c=mix(c,vec3(1.,.9,.8),.55);
  gl_FragColor=vec4(c,1.); }`);
  const ch = makeChara(scene, D.chara, 0x0c0620, .5);
  const parts = makeParticles(scene, [470, 630]);

  scn.material.uniforms.tIdx.value = tex.scene_night; ch.chara.material.uniforms.tIdx.value = tex.chara;
  const self = {
    scene, layers: [sky, scn], ch, drop: 0,
    apply(st) {
      const t = st.time, n = t === 'night' ? 1 : 0;
      sky.material.uniforms.tIdx.value = tex['sky_' + t]; setPal(sky, palTex(D.pal['sky_' + t], c => grade(c, 'sky', st)));
      sky.material.uniforms.uStretch.value = n ? 1 : .66; sky.material.uniforms.uNight.value = n;
      scn.material.uniforms.uWet.value = st.weather === 'rain' ? 1 : 0; setPal(scn, palTex(D.pal.scene_night, c => grade(c, 'scene', st)));
      setPal(ch.chara, palTex(D.pal.chara, c => grade(c, 'chara', st)));
    },
    frame(par, f, newF, rm, st) {
      const off = k => Math.round(-par * k);
      sky.material.uniforms.uOff.value.set(off(2), 0); scn.material.uniforms.uOff.value.set(off(8), 0);
      const cx = W / 2 + off(13), feet = 606;
      ch.chara.position.set(cx, H - (feet - ch.CH / 2) + self.drop, 4); ch.shadow.position.set(cx, H - feet + 1, 3);
      ch.chara.material.uniforms.uOff.value.set(0, rm ? 0 : (Math.floor(f / 9) & 1));
      if (newF) { sky.material.uniforms.uF.value = f; scn.material.uniforms.uF.value = rm ? 0 : f; parts.draw(f, st.weather); }
    },
  };
  return self;
}
