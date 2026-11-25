// みなとみらい：canva_layers/page.html の層と動きを移したもの
import { loadTextures, palTex, setPal, makeLayer, makeChara, makeParticles } from '../card.js';
const THREE = window.THREE;

export async function build() {
  const base = 'assets/minatomirai/';
  const D = await (await fetch(base + 'data.json')).json();
  const tex = await loadTextures(base, ['sky_evening', 'sky_night', 'city_evening', 'city_night', 'fg', 'chara']);
  // 絵の大きさは data.json の W・H（285×507）。前の座標（360×640）で決めた数は k 倍する
  const W = D.W, H = D.H, k = W / 360, n1 = v => (v * k).toFixed(2);
  const HOR = D.HOR, GROUND = Math.round(520 * k);
  const scene = new THREE.Scene(); scene.userData = { W, H };

  function grade(c, layer, st) {
    let [r, g, b] = c; const l = r * .3 + g * .59 + b * .11, night = st.time === 'night', warm = r > b + 40 && l > 120;
    if ((layer === 'fg' || layer === 'chara') && night) { const k = warm && layer === 'fg' ? .95 : layer === 'chara' ? .62 : .5; r = r * k * (warm ? 1 : .8); g = g * k * (warm ? 1 : .9); b = b * k * 1.25 + (warm ? 0 : 8); }
    if (st.weather === 'cloudy') { const k = warm ? .12 : .3; r = (r + (l - r) * k) * .92; g = (g + (l - g) * k) * .92; b = (b + (l - b) * k) * .95; }
    if (st.weather === 'rain') { const k = warm ? .25 : .5; r = (r + (l * .82 - r) * k) * .82; g = (g + (l * .9 - g) * k) * .82; b = (b + (l * 1.05 - b) * k) * .86; }
    if (st.weather === 'snow') { const k = warm ? .15 : .38; r = r + (l * .95 - r) * k + 10; g = g + (l - g) * k + 12; b = b + (l * 1.08 - b) * k + 18; }
    return [r, g, b];
  }

  const sky = makeLayer(scene, 0, `void main(){ vec2 px=floor(vUv*uSize); px.y=uSize.y-1.-px.y; if(hidden(px)) discard; vec2 s=px-uOff; vec4 t=smp(s); vec3 c=pal(t.r);
  float ph=hash(s); if(uNight>.5 && s.y<${n1(300)} && lum(c)>.5 && mod(ph*40.+uF,40.)<5.) c*=.45;
  gl_FragColor=vec4(c,1.); }`);
  const city = makeLayer(scene, 1, `void main(){ vec2 px=floor(vUv*uSize); px.y=uSize.y-1.-px.y; if(hidden(px)) discard; vec2 s=px-uOff;
  if(s.y>${HOR}.+2.){ float d=(s.y-${HOR}.)/${n1(170)}; s.x+=floor((.5+2.*d)*sin(s.y*.5+uF*.52)+.5); }
  vec4 t=smp(s); if(t.a<.5) discard; vec3 c=pal(t.r); float fl=floor(t.g*255.+.5), ph=hash(s);
  if(mod(fl,2.)>.5){ float h=fract(t.b*3.+uF/32.); vec3 pc=h<.2?vec3(1.,.35,.54):h<.4?vec3(1.,.78,.34):h<.6?vec3(.42,.94,.75):h<.8?vec3(.35,.7,1.):vec3(.75,.48,1.); c=mix(c,pc,.7); }
  if(fl>1.5 && fract(ph*7.)<.1 && mod(ph*60.+uF,60.)<3.) c*=.5;
  if(s.y>${HOR}.+2. && lum(c)>.55 && mod(ph*18.+uF,18.)<2.) c=mix(c,vec3(1.,.96,.88),.75);
  gl_FragColor=vec4(c,1.); }`);
  const fg = makeLayer(scene, 2, `void main(){ vec2 px=floor(vUv*uSize); px.y=uSize.y-1.-px.y; if(hidden(px)) discard; vec2 s=px-uOff; vec4 t=smp(s); if(t.a<.5) discard; vec3 c=pal(t.r);
  float k=0.; ${D.lamps.map(l => `k=max(k,1.-length(s-vec2(${l[0].toFixed(1)},${l[1].toFixed(1)}))/${n1(22)});`).join('')}
  if(k*uLamp>bayer(px)) c=mix(c,vec3(1.,.84,.56),.22);
  gl_FragColor=vec4(c,1.); }`);
  const ch = makeChara(scene, D.chara, 0x100a26, .45);
  const parts = makeParticles(scene, [GROUND + 8, H - 4]);

  fg.material.uniforms.tIdx.value = tex.fg; ch.chara.material.uniforms.tIdx.value = tex.chara;
  const self = {
    scene, layers: [sky, city, fg], ch, drop: 0,
    apply(st) {
      const t = st.time, n = t === 'night' ? 1 : 0;
      sky.material.uniforms.tIdx.value = tex['sky_' + t]; setPal(sky, palTex(D.pal['sky_' + t], c => grade(c, 'sky', st)));
      city.material.uniforms.tIdx.value = tex['city_' + t]; setPal(city, palTex(D.pal['city_' + t], c => grade(c, 'city', st)));
      setPal(fg, palTex(D.pal.fg, c => grade(c, 'fg', st)));
      setPal(ch.chara, palTex(D.pal.chara, c => grade(c, 'chara', st)));
      for (const m of [sky, city, fg]) m.material.uniforms.uNight.value = n;
    },
    frame(par, f, newF, rm, st) {
      const off = v => Math.round(-par * v * k);
      sky.material.uniforms.uOff.value.set(off(2), 0); city.material.uniforms.uOff.value.set(off(6), 0); fg.material.uniforms.uOff.value.set(off(14), 0);
      const cx = W / 2 + off(16), feet = Math.round(604 * k);
      ch.chara.position.set(cx, H - (feet - ch.CH / 2) + self.drop, 4); ch.shadow.position.set(cx, H - feet + 1, 3);
      ch.chara.material.uniforms.uOff.value.set(0, rm ? 0 : (Math.floor(f / 9) & 1));
      if (newF) { for (const m of [sky, city, fg]) m.material.uniforms.uF.value = f; fg.material.uniforms.uLamp.value = rm ? 1 : .8 + .2 * Math.sin(f * .9) + .1 * Math.sin(f * 2.3); parts.draw(f, st.weather); }
    },
  };
  return self;
}
