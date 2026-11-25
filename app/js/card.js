// カード描画の共通部分（canva_layers / chukagai_canva の page.html から移したもの）
// 絵は Canva の見本を写し取った層だけを使う。ここでは背景を描き足さない。
import { seasonOf } from './places.js';
const THREE = window.THREE;
// RS：カードを描く細かさ（背景の1ドット＝RS×RS の画面のマス）。キャラは背景の RS 倍の細かさのドット絵（2026-11-25）
export const RS = 2;
export const W = 360, H = 640;   // 写真の名所の大きさ。ドット絵の名所は data.json の W・H（scene.userData に入れる）
const dims = scene => [scene.userData.W || W, scene.userData.H || H];
export const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export const near = t => { t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; return t; };
const loader = new THREE.TextureLoader();
export async function loadTextures(base, names) {
  const out = {};
  await Promise.all(names.map(async n => { out[n] = near(await loader.loadAsync(base + n + '.png')); }));
  return out;
}

// パレット：色番号→色。時間帯や天気は grade を通して書き換える
export function palTex(pal, grade) {
  const d = new Uint8Array(256 * 4);
  pal.forEach((c, i) => { const g = grade(c, i); for (let k = 0; k < 3; k++) d[i * 4 + k] = Math.max(0, Math.min(255, g[k])); d[i * 4 + 3] = 255; });
  const t = new THREE.DataTexture(d, 256, 1, THREE.RGBAFormat); t.magFilter = t.minFilter = THREE.NearestFilter; t.needsUpdate = true; return t;
}
export function setPal(mesh, tex) { const u = mesh.material.uniforms.tPal; if (u.value) u.value.dispose(); u.value = tex; }

const VERT = 'varying vec2 vUv; void main(){vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}';
// uReveal は到着演出の「組み上がり」用。網点の順に層が現れる（1で全部見える）
const COMMON = `uniform sampler2D tIdx,tPal; uniform vec2 uOff,uSize; uniform float uF,uNight,uStretch,uWet,uLamp,uReveal; varying vec2 vUv;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float lum(vec3 c){return dot(c,vec3(.3,.59,.11));}
vec4 smp(vec2 s){return texture2D(tIdx,clamp((s+.5)/uSize,0.,1.)*vec2(1.,-1.)+vec2(0.,1.));}
vec3 pal(float r){return texture2D(tPal,vec2((floor(r*255.+.5)+.5)/256.,.5)).rgb;}
float bayer(vec2 p){vec2 q=mod(p,4.);float x=q.x,y=q.y;float v=y<1.?(x<1.?0.:x<2.?8.:x<3.?2.:10.):y<2.?(x<1.?12.:x<2.?4.:x<3.?14.:6.):y<3.?(x<1.?3.:x<2.?11.:x<3.?1.:9.):(x<1.?15.:x<2.?7.:x<3.?13.:5.);return (v+.5)/16.;}
bool hidden(vec2 px){return bayer(px)>=uReveal;}
`;

export function makeLayer(scene, z, frag, w, h) {
  if (w === undefined) [w, h] = dims(scene);
  const m = new THREE.ShaderMaterial({ transparent: true, depthTest: false, vertexShader: VERT, fragmentShader: COMMON + frag,
    uniforms: { tIdx: { value: null }, tPal: { value: null }, uOff: { value: new THREE.Vector2() }, uSize: { value: new THREE.Vector2(w, h) },
      uF: { value: 0 }, uNight: { value: 0 }, uStretch: { value: 1 }, uWet: { value: 0 }, uLamp: { value: 1 }, uReveal: { value: 1 } } });
  const [SW, SH] = dims(scene);
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); mesh.position.set(SW / 2, SH / 2, z); mesh.renderOrder = z; scene.add(mesh); return mesh;
}

// キャラ（背景と別の層。あとで着せ替えのパーツ層にする）
// frames：絵にコマ（ポーズ）が横に何枚並んでいるか。setPose(i, f, rm) で i 番目のポーズにする（0＝立ち、1＝ばんざい…）
// blink：まばたきのコマが、ポーズのコマから何番うしろにあるか（0＝まばたきなし）。f（12コマ/秒）で、ときどき目を閉じる
// poseIds：コマごとのポーズ番号（保存ずみのカードの photo.pose は前の13ポーズの番号。なくなった番号は立ち＝0コマ目にする）
export function makeChara(scene, size, shadowColor, shadowOpacity, frames = 1, blink = 0, poseIds = null) {
  const [CW, CH] = size;
  // 光の当て方（uMode：0＝無光、1＝半逆光、2＝逆光、3＝順光。uRim＝強さ、uRimDir＝光の来る向き、uRimCol＝光の色）
  //   半逆光：光の来る側のふちを光の色に、体は少し陰に。逆光：体を陰にして、ぐるりのふちから光がもれる。順光：光の側を明るく、反対側のふちを少し陰に
  //   uLightOnly＝1 のときは「光の分だけ」を描く（グロー用。Engine.present がこれをぼかして重ねる）
  const chara = makeLayer(scene, 4, `uniform float uPose,uFrames,uRim,uMode,uLightOnly; uniform vec2 uRimDir; uniform vec3 uRimCol;
    float al(vec2 q){ q=floor(q+.5); if(q.x<0.||q.y<0.||q.x>=uSize.x||q.y>=uSize.y) return 0.; return step(.5,texture2D(tIdx,(vec2(q.x+uPose*uSize.x,q.y)+.5)/vec2(uSize.x*uFrames,uSize.y)*vec2(1.,-1.)+vec2(0.,1.)).a); }
    void main(){ vec2 px=floor(vUv*uSize); px.y=uSize.y-1.-px.y; vec2 s=px; if(s.y<uSize.y*.62) s.y-=uOff.y;
    vec4 t=texture2D(tIdx,(vec2(s.x+uPose*uSize.x,s.y)+.5)/vec2(uSize.x*uFrames,uSize.y)*vec2(1.,-1.)+vec2(0.,1.)); if(t.a<.5||s.y<0.||hidden(px)) discard; vec3 c=pal(t.r), L=vec3(0.);
    if(uMode>.5){ float w=ceil(uSize.y/120.), e=0., soft=0.;
      if(uMode<1.5||uMode>2.5){ for(int i=1;i<=4;i++){ float d=float(i); if(d<=w) e=max(e,1.-al(s+uRimDir*d)); } soft=1.-al(s+uRimDir*(w*2.5)); }
      else { for(int i=0;i<5;i++){ float a=3.1416+float(i)*.7854; vec2 d=vec2(cos(a),sin(a)); float wt=i==0||i==4?.75:1.; e=max(e,(1.-al(s+d*w))*wt); soft=max(soft,(1.-al(s+d*(w*2.)))*wt); } }   // 逆光：上と横のふちだけ（下向きのふち＝あごの下・わきの下は光らせない）
      // 光は「塗る」のではなく、元の色に当てる：明るさは元の色に光の色を掛けて足し（色みと模様が残る）、ごく弱くスクリーンで重ねる
      float k=0., sc=0., shade=1.;
      if(uMode<1.5){ k=e*.95+soft*.26; sc=e*.16; shade=.86; }
      else if(uMode<2.5){ k=e*.6+soft*.1; sc=e*.1; shade=.7; }
      else { float far=1.-al(s-uRimDir*(w*2.)); k=.07+soft*.3; sc=soft*.06; shade=1.-.12*far*(1.-soft); }
      k*=uRim; sc*=uRim; vec3 base=c*mix(vec3(1.),mix(vec3(shade),vec3(shade,shade*1.01,shade*1.1),step(shade,.99)),uRim);
      vec3 lit=base+c*uRimCol*k; c=1.-(1.-lit)*(1.-uRimCol*sc); c=min(c,vec3(1.));
      L=((c-base)*.8+uRimCol*sc*.6)*(uMode>1.5&&uMode<2.5?.6:1.); }
    gl_FragColor=vec4(uLightOnly>.5?L:c,1.); }`, CW, CH);
  Object.assign(chara.material.uniforms, { uPose: { value: 0 }, uFrames: { value: frames }, uRim: { value: 0 }, uMode: { value: 0 }, uLightOnly: { value: 0 }, uRimDir: { value: new THREE.Vector2(-.8, -.6) }, uRimCol: { value: new THREE.Vector3(1, .98, .92) } }); chara.material.needsUpdate = true;
  const poses = blink ? blink : frames;
  const blinkNow = f => { const q = f % 52; return q < 2 || (f % 156 >= 104 && q >= 5 && q < 7); };   // 約4秒に1回、ときどき2回つづけて
  const setPose = (i, f = 0, rm = true) => {
    if (poseIds) i = Math.max(0, poseIds.indexOf(i));
    i = Math.min(poses - 1, Math.max(0, i));
    if (blink && !rm && blinkNow(f)) i += blink;
    chara.material.uniforms.uPose.value = Math.min(frames - 1, i);
  };
  const shadow = makeShadow(scene, chara, size, shadowColor, shadowOpacity);
  // 細かさの段階：大きさ s に合わせて、いちばん合う絵に切り替える（小さいとき用・ふだん用・寄り用）
  //   lods：[{ s：その絵がちょうどよい大きさ, tex, size：[1コマの幅, 高さ] }]。ふだん用は s＝1
  let lods = [], cur = null;
  const setLods = l => { lods = l.slice().sort((a, b) => a.s - b.s); cur = null; };
  const pickLod = s => {
    if (!lods.length) return; let best = lods[0];
    for (const l of lods) if (Math.abs(Math.log(l.s / s)) < Math.abs(Math.log(best.s / s))) best = l;
    if (best === cur) return; cur = best;
    chara.material.uniforms.tIdx.value = best.tex; chara.material.uniforms.uSize.value.set(best.size[0], best.size[1]);
  };
  return { chara, shadow, CW, CH, shadowOpacity, setPose, frames, setLods, pickLod };
}
// 影：キャラの形（いまのポーズ・大きさ・角度）を、光の向きに合わせて地面へ落とす。背景と同じ粗さのドットで描く
//   地面の点 p から、光をさかのぼって「キャラのどの点の影か」を求め、そこがキャラなら影にする（1マスの中を何か所か見て、細い所が抜けないように）
//   uK：足もとから高さ 1 のぶん影がどれだけずれるか（x＝横、y＝奥。小さいほど影が短い）。uFoot：足もとの点。uC・uS・uR：キャラのまん中・大きさ・角度
//   uFade：影にする高さ（キャラの背の何割まで。上ほど薄い）。placeChara（scenes/look.js）が毎コマ値を入れる。material.opacity は登場の動き（arrival.js）が変えるので、描く前に写す
function makeShadow(scene, chara, size, color, opacity) {
  const [SW, SH] = dims(scene), cu = chara.material.uniforms;
  const u = { tIdx: cu.tIdx, uSize: cu.uSize, uPose: cu.uPose, uFrames: cu.uFrames, uScene: { value: new THREE.Vector2(SW, SH) },
    uCS: { value: new THREE.Vector2(size[0], size[1]) }, uC: { value: new THREE.Vector2() }, uFoot: { value: new THREE.Vector2() }, uK: { value: new THREE.Vector2(.3, .2) },
    uS: { value: 1 }, uR: { value: 0 }, uFade: { value: 1 }, uMul: { value: 1 }, uOp: { value: opacity }, uCol: { value: new THREE.Color(color) } };
  const m = new THREE.ShaderMaterial({ transparent: true, depthTest: false, uniforms: u, vertexShader: VERT, fragmentShader: `
    uniform sampler2D tIdx; uniform vec2 uSize,uScene,uCS,uC,uFoot,uK; uniform float uPose,uFrames,uS,uR,uFade,uMul,uOp; uniform vec3 uCol; varying vec2 vUv;
    float body(vec2 w){ vec2 l=w-uC; float c=cos(uR),s=sin(uR); l=vec2(c*l.x+s*l.y,-s*l.x+c*l.y)/uS;
      vec2 t=floor(vec2(l.x/uCS.x+.5,.5-l.y/uCS.y)*uSize); if(t.x<0.||t.y<0.||t.x>=uSize.x||t.y>=uSize.y) return 0.;
      return step(.5,texture2D(tIdx,(vec2(t.x+uPose*uSize.x,t.y)+.5)/vec2(uSize.x*uFrames,uSize.y)*vec2(1.,-1.)+vec2(0.,1.)).a); }
    void main(){ vec2 p=floor(vUv*uScene); float a=0.,h0=1e9;
      float top=uCS.y*uS*uFade; for(int i=0;i<6;i++){ vec2 q=p+vec2((float(i/2)+.5)/3.,(mod(float(i),2.)+.5)/2.); float h=(q.y-uFoot.y)/uK.y; if(h<-.5||h>top) continue;
        float b=body(vec2(q.x-h*uK.x,uFoot.y+max(h,0.))); if(b>0.){ a=1.; h0=min(h0,max(h,0.)); } }
      if(a<.5) discard; float f=clamp(h0/top,0.,1.); gl_FragColor=vec4(uCol,min(.85,uOp*uMul)*(1.-floor(f*3.)*.2)); }` });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(SW, SH), m); mesh.position.set(SW / 2, SH / 2, 3); mesh.renderOrder = 3; scene.add(mesh);
  m.opacity = opacity; mesh.onBeforeRender = () => { u.uOp.value = m.opacity; };
  return mesh;
}
// キャラの細かさの段階を読む（data.json の charaLods）。ふだん用（chara.png）も入れて返す
export async function charaLods(base, D, baseTex) {
  const ls = D.charaLods || [], tex = ls.length ? await loadTextures(base, ls.map(l => l.file)) : {};
  return [{ s: 1, tex: baseTex, size: D.charaTex || D.chara }, ...ls.map(l => ({ s: l.s, tex: tex[l.file], size: l.size }))];
}

// 雨・雪の粒（コードで動かすもの）。splash は雨のはね返りを出す高さの範囲
export function makeParticles(scene, splash) {
  const [W, H] = dims(scene);
  const pc = document.createElement('canvas'); pc.width = W; pc.height = H; const pctx = pc.getContext('2d'), pTex = near(new THREE.CanvasTexture(pc));
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshBasicMaterial({ map: pTex, transparent: true, depthTest: false })); mesh.position.set(W / 2, H / 2, 5); mesh.renderOrder = 5; scene.add(mesh);
  let seed = 9; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647; const P = Array.from({ length: 320 }, (_, i) => [rnd() * W, rnd() * H, rnd(), i]);
  function draw(f, w, o = {}) {
    pctx.clearRect(0, 0, W, H);
    if (w === 'snow') for (const [x0, y0, q, i] of P) { const big = i < 30, mid = i < 140, sp = big ? 2.2 : mid ? 1.3 : .7, y = Math.floor((y0 + f * sp) % H), x = Math.floor(((x0 + Math.sin(f / 14 + q * 20) * (big ? 6 : 3) + f * .2) % W + W) % W);
      pctx.fillStyle = mid ? '#fff' : 'rgba(215,225,248,.8)'; pctx.fillRect(x, y, big ? 2 : 1, big ? 2 : 1); if (big) { pctx.fillStyle = 'rgba(228,236,252,.8)'; pctx.fillRect(x - 1, y, 1, 1); pctx.fillRect(x + 2, y + 1, 1, 1); } }
    else if (w === 'rain') { for (const [x0, y0, q, i] of P) { if (i > 220) break; const nearD = i < 70, len = nearD ? 13 : 7, y = Math.floor((y0 + f * (nearD ? 26 : 18)) % (H + 30)) - 15, x = Math.floor(((x0 - f * (nearD ? 6 : 4)) % W + W) % W);
        pctx.fillStyle = nearD ? 'rgba(206,218,246,.72)' : 'rgba(206,218,246,.4)'; for (let k = 0; k < len; k++) pctx.fillRect(x + Math.floor(k / 3.5), y - k, 1, 1); }
      for (let i = 0; i < 34; i++) { const ph = (f + i * 5) % 14, x = Math.floor(P[240 + i][0]), y = splash[0] + Math.floor(P[240 + i][1] / H * (splash[1] - splash[0])); if (ph < 3) { pctx.fillStyle = 'rgba(224,232,250,.75)'; pctx.fillRect(x, y - 1 - ph, 1, 1); pctx.fillRect(x - 1 - ph, y, 1, 1); pctx.fillRect(x + 1 + ph, y, 1, 1); } } }
    // 落ち葉（秋の名所）：木のある左上から、ゆれながら右下へ落ちる小さな葉
    if (o.leaves) for (let i = 0; i < 18; i++) {
      const [x0, y0, q] = P[i + 100], sp = .5 + q * .6, y = Math.floor((y0 * .9 + f * sp) % (H + 20)) - 10, x = Math.floor(((x0 * .55 + f * .25 * sp + Math.sin(f / 10 + q * 30) * 5) % W + W) % W);
      pctx.fillStyle = ['#E07A2E', '#C9452B', '#E8B23A'][i % 3]; const flip = ((f >> 2) + i) & 1;
      pctx.fillRect(x, y, flip ? 2 : 1, flip ? 1 : 2); if (i % 2) pctx.fillRect(x + 1, y + 1, 1, 1);
    }
    // 湯気（屋台の蒸し器など）：決まった場所から、ゆれながら上がって消える白い粒
    if (o.steam) for (const [sx, sy] of o.steam) for (let i = 0; i < 7; i++) {
      const age = (f * .6 + i * 4.3) % 30, x = Math.round(sx + Math.sin(age / 4 + i) * 2 + (i % 3) - 1), y = Math.round(sy - age);
      pctx.fillStyle = `rgba(240,240,236,${(.55 * (1 - age / 30)).toFixed(2)})`; pctx.fillRect(x, y, age > 12 ? 2 : 1, age > 12 ? 2 : 1);
    }
    pTex.needsUpdate = true;
  }
  return { mesh, draw };
}

// 描くときの状態：天気「不明」は晴れで描く
// 季節がないとき（まだ行っていない名所の小さな絵など）は、その日の季節で描く
const drawState = st => ({ ...st, weather: ['rain', 'snow', 'cloudy'].includes(st.weather) ? st.weather : 'clear', season: st.season || seasonOf(st.at ? new Date(st.at) : new Date()) });

// ---- 描画エンジン（WebGL は1つだけ使い、表示する場所へキャンバスを移す） ----
class Engine {
  constructor() {
    this.canvas = document.createElement('canvas'); this.canvas.width = W * RS; this.canvas.height = H * RS; this.canvas.className = 'gl';
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: false, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(1); this.renderer.setSize(W * RS, H * RS, false);
    this.cam = new THREE.OrthographicCamera(0, W, H, 0, -10, 10);
    this.builders = {}; this.built = {}; this.cur = null; this.state = null; this.target = null; this.par = 0; this.lastF = -1; this.running = false;
    this.onPointer = e => { const r = this.canvas.getBoundingClientRect(); this.target = (e.clientX - r.left) / r.width * 2 - 1; };
    this.onLeave = () => { this.target = null; };
    this.canvas.addEventListener('pointermove', this.onPointer); this.canvas.addEventListener('pointerleave', this.onLeave);
    this.loop = this.loop.bind(this);
  }
  register(id, builder) { this.builders[id] = builder; }
  // 組み上がりの途中の状態を元に戻す
  // 名所ごとの絵の大きさにキャンバスとカメラを合わせる
  fit(s) {
    const [w, h] = dims(s.scene); if (this.canvas.width === w * RS && this.canvas.height === h * RS) return;
    this.renderer.setSize(w * RS, h * RS, false); this.cam.right = w; this.cam.top = h; this.cam.updateProjectionMatrix();
  }
  reset(s) { for (const m of [...s.layers, s.ch.chara]) m.material.uniforms.uReveal.value = 1; s.drop = 0; s.ch.shadow.material.opacity = s.ch.shadowOpacity; s.forcePose = null; }
  get(id) { return this.built[id] || (this.built[id] = this.builders[id]()); }
  // container の中に動くカードを出す
  async show(container, id, state) {
    const s = await this.get(id);
    this.cur = s; this.fit(s); this.state = drawState(state); s.apply(this.state); this.reset(s); this.lastF = -1; this.par = 0; this.target = null;
    container.prepend(this.canvas);
    if (!this.running) { this.running = true; requestAnimationFrame(this.loop); }
    return s;
  }
  setState(state) { this.state = drawState(state); if (this.cur) { this.cur.apply(this.state); this.lastF = -1; } }
  stop() { this.running = false; this.canvas.remove(); this.cur = null; }
  loop(ms) {
    if (!this.running) return; requestAnimationFrame(this.loop);
    const s = this.cur; if (!s) return;
    const t = ms / 1000, f = Math.floor(t * 12), rm = reduceMotion();
    const tg = this.target ?? (rm ? 0 : Math.sin(t * .32) * .7); this.par += (tg - this.par) * .07;
    s.frame(this.par, f, f !== this.lastF, rm, this.state); this.lastF = f;
    this.present(s, this.state);
  }
  // 描く。撮影で光（半逆光・逆光・順光）とグローを選んだカードは、キャラに当たる光だけをぼかして重ね、ふわっと光らせる（1＝弱い、2＝強い）
  //   カードの絵 → キャラの「光の分だけ」を別に描く → 横・たてにぼかす（半分の大きさ）→ 元の絵に重ねる
  present(s, state) {
    const g = state?.photo?.glow | 0, R = this.renderer, cu = s.ch.chara.material.uniforms;
    if (!g || !(state?.photo?.rim | 0)) { R.setRenderTarget(null); R.render(s.scene, this.cam); return; }
    const W = this.canvas.width, H = this.canvas.height;
    if (!this.fx || this.fx.w !== W || this.fx.h !== H) {
      this.fx?.rt.forEach(t => t.dispose());
      const mk = (w, h, f) => new THREE.WebGLRenderTarget(w, h, { minFilter: f, magFilter: f, depthBuffer: false });
      const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2)), sc = new THREE.Scene(); sc.add(quad);
      const mat = frag => new THREE.ShaderMaterial({ depthTest: false, vertexShader: 'varying vec2 vUv; void main(){vUv=uv; gl_Position=vec4(position.xy,0.,1.);}',
        uniforms: { tA: { value: null }, tB: { value: null }, uPx: { value: new THREE.Vector2() }, uStr: { value: 1 } }, fragmentShader: 'uniform sampler2D tA,tB; uniform vec2 uPx; uniform float uStr; varying vec2 vUv;' + frag });
      this.fx = { w: W, h: H, rt: [mk(W, H, THREE.NearestFilter), mk(W, H, THREE.LinearFilter), mk(W >> 1, H >> 1, THREE.LinearFilter), mk(W >> 1, H >> 1, THREE.LinearFilter)], sc, quad, cam: new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1),
        blur: mat('void main(){ vec3 a=vec3(0.); float n=0.; for(int i=-8;i<=8;i++){ float w=exp(-float(i*i)/24.); a+=texture2D(tA,vUv+uPx*float(i)).rgb*w; n+=w; } gl_FragColor=vec4(a/n,1.); }'),
        mix: mat('void main(){ vec3 c=texture2D(tA,vUv).rgb, g=texture2D(tB,vUv).rgb*uStr; gl_FragColor=vec4(1.-(1.-c)*(1.-min(g,vec3(1.))),1.); }') };
    }
    const F = this.fx, pass = (m, a, b, out) => { m.uniforms.tA.value = a; m.uniforms.tB.value = b; F.quad.material = m; R.setRenderTarget(out); R.render(F.sc, F.cam); };
    R.setRenderTarget(F.rt[0]); R.render(s.scene, this.cam);
    s.ch.chara.layers.enable(1); this.cam.layers.set(1); cu.uLightOnly.value = 1; R.setRenderTarget(F.rt[1]); R.render(s.scene, this.cam); cu.uLightOnly.value = 0; this.cam.layers.set(0);
    F.blur.uniforms.uPx.value.set(2.6 / W, 0); pass(F.blur, F.rt[1].texture, null, F.rt[2]);
    F.blur.uniforms.uPx.value.set(0, 2.6 / H); pass(F.blur, F.rt[2].texture, null, F.rt[3]);
    F.mix.uniforms.uStr.value = g > 1 ? 1.9 : 1.1; pass(F.mix, F.rt[0].texture, F.rt[3].texture, null);
  }
  // 一覧・図鑑の小さな絵（止まった1コマ）を作る
  async snapshot(id, state) {
    state = drawState(state); const s = await this.get(id);
    const keep = s === this.cur ? [...s.layers, s.ch.chara].map(m => m.material.uniforms.uReveal.value).concat([s.drop, s.ch.shadow.material.opacity]) : null;
    this.fit(s); s.apply(state); this.reset(s); s.frame(0, 0, true, true, state); this.present(s, state);
    if (keep) { [...s.layers, s.ch.chara].forEach((m, i) => { m.material.uniforms.uReveal.value = keep[i]; }); s.drop = keep.at(-2); s.ch.shadow.material.opacity = keep.at(-1); }
    const url = this.canvas.toDataURL('image/png');
    if (this.cur) { this.fit(this.cur); if (this.cur === s) s.apply(this.state); this.lastF = -1; }
    return url;
  }
}
export const engine = new Engine();
const snaps = new Map();
export const clearSnaps = () => snaps.clear();   // キャラの色を変えたときなど、一覧の小さな絵を描き直す
export function snapshot(id, state) {
  const k = `${id}|${state.time}|${state.weather}|${state.season || ''}|${JSON.stringify(state.photo || null)}`;
  if (!snaps.has(k)) snaps.set(k, engine.snapshot(id, state));
  return snaps.get(k);
}
