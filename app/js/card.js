// カード描画の共通部分（canva_layers / chukagai_canva の page.html から移したもの）
// 絵は Canva の見本を写し取った層だけを使う。ここでは背景を描き足さない。
import { seasonOf } from './places.js';
const THREE = window.THREE;
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
  pal.forEach((c, i) => { const g = grade(c); for (let k = 0; k < 3; k++) d[i * 4 + k] = Math.max(0, Math.min(255, g[k])); d[i * 4 + 3] = 255; });
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
export function makeChara(scene, size, shadowColor, shadowOpacity) {
  const [CW, CH] = size;
  const chara = makeLayer(scene, 4, `void main(){ vec2 px=floor(vUv*uSize); px.y=uSize.y-1.-px.y; vec2 s=px; if(s.y<uSize.y*.62) s.y-=uOff.y; vec4 t=smp(s); if(t.a<.5||s.y<0.||hidden(px)) discard; gl_FragColor=vec4(pal(t.r),1.); }`, CW, CH);
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(1, 20), new THREE.MeshBasicMaterial({ color: shadowColor, transparent: true, opacity: shadowOpacity, depthTest: false }));
  shadow.scale.set(30, 5, 1); shadow.renderOrder = 3; scene.add(shadow);
  return { chara, shadow, CW, CH, shadowOpacity };
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
    this.canvas = document.createElement('canvas'); this.canvas.width = W; this.canvas.height = H; this.canvas.className = 'gl';
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: false, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(1); this.renderer.setSize(W, H, false);
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
    const [w, h] = dims(s.scene); if (this.canvas.width === w && this.canvas.height === h) return;
    this.renderer.setSize(w, h, false); this.cam.right = w; this.cam.top = h; this.cam.updateProjectionMatrix();
  }
  reset(s) { for (const m of [...s.layers, s.ch.chara]) m.material.uniforms.uReveal.value = 1; s.drop = 0; s.ch.shadow.material.opacity = s.ch.shadowOpacity; }
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
    this.renderer.render(s.scene, this.cam);
  }
  // 一覧・図鑑の小さな絵（止まった1コマ）を作る
  async snapshot(id, state) {
    state = drawState(state); const s = await this.get(id);
    const keep = s === this.cur ? [...s.layers, s.ch.chara].map(m => m.material.uniforms.uReveal.value).concat([s.drop, s.ch.shadow.material.opacity]) : null;
    this.fit(s); s.apply(state); this.reset(s); s.frame(0, 0, true, true, state); this.renderer.render(s.scene, this.cam);
    if (keep) { [...s.layers, s.ch.chara].forEach((m, i) => { m.material.uniforms.uReveal.value = keep[i]; }); s.drop = keep.at(-2); s.ch.shadow.material.opacity = keep.at(-1); }
    const url = this.canvas.toDataURL('image/png');
    if (this.cur) { this.fit(this.cur); if (this.cur === s) s.apply(this.state); this.lastF = -1; }
    return url;
  }
}
export const engine = new Engine();
const snaps = new Map();
export function snapshot(id, state) {
  const k = `${id}|${state.time}|${state.weather}|${state.season || ''}`;
  if (!snaps.has(k)) snaps.set(k, engine.snapshot(id, state));
  return snaps.get(k);
}
