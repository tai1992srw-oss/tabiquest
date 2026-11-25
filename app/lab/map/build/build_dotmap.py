# ドットの地図の試作（案A）のデータを作る
# 地形データを決まった大きさのマスに落とすだけ（手で描き足さない）
#   日本全体：app/assets/map/map_jp.png（Natural Earth の県境を 1マス約1km に落としたもの）を 2km・8km にもまとめる
#   神奈川・東京のまわり：国土数値情報 行政区域（N03, 2024年1月1日, CC BY 4.0）を 1km・250m・100m・50m のマスに落とす
#   名所のまわり（名所から ±2.5km）だけ、さらに 20m のマス
#   線路：国土数値情報 鉄道（N02, 2023年, CC BY 4.0）を 250m より細かい段に
#   高速道路：国土数値情報 高速道路時系列（N06, 2024年, CC BY 4.0）を 2km より細かい段に（日本全体にも）
#   名所のまわりの 20m の段だけ：OpenStreetMap（© OpenStreetMap contributors, ODbL）の道路・公園と森・水辺（fetch_osm.py で取る）
# 出力（app/lab/map/data/）：<level>.png … R*256+G＝番号（0＝海）
#                              B の下2ビット＝0:なし 1:市区町村の境 2:県境 3:海岸、4のビット＝線路、8のビット＝高速道路
#                              （20m の段だけ）16＝太い道 32＝公園・森 64＝水辺 128＝細い道
#                            levels.json … 各段の位置・大きさ・番号の表
# 使い方：python build_dotmap.py <N03 の geojson を入れたフォルダ> <N02 を展開したフォルダ> <N06 を展開したフォルダ> [osm_near*.json のフォルダ]
# 本番用：環境変数 DOTMAP_PROD=1 で、線路・高速道路を入れず（N02・N06 は - でよい）、名所は app/js/places.js・photo_places.js から、
#         出力は app/assets/map/dot/ にする
import json, sys, glob, os, collections
import numpy as np
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.normpath(os.path.join(HERE, '..', '..', '..'))
PROD = os.environ.get('DOTMAP_PROD') == '1'
OUT = os.path.join(APP, 'assets', 'map', 'dot') if PROD else os.path.join(HERE, '..', 'data')
os.makedirs(OUT, exist_ok=True)
for old in glob.glob(os.path.join(OUT, '*.png')): os.remove(old)

# 投影：今の地図（map.js）と同じ。km 単位の平面 X=(経度-122.5)*kx, Y=(45.8-緯度)*111
LON0, LAT0, KX, KY = 122.5, 45.8, 89.80088637561917, 111.0
def proj(lng, lat): return ((lng - LON0) * KX, (LAT0 - lat) * KY)

def flags(idv, pref):
    """idv: 番号の2次元配列。右か下のマスと番号が違えば境（1マスの線になる）。海と接する陸は海岸"""
    H, W = idv.shape
    f = np.zeros((H, W), np.uint8)
    land = idv > 0
    for dy, dx in ((0, 1), (1, 0), (0, -1), (-1, 0)):
        nb = np.zeros_like(idv); npf = np.zeros_like(pref)
        ys = slice(max(dy, 0), H + min(dy, 0)); yd = slice(max(-dy, 0), H + min(-dy, 0))
        xs = slice(max(dx, 0), W + min(dx, 0)); xd = slice(max(-dx, 0), W + min(-dx, 0))
        nb[yd, xd] = idv[ys, xs]; npf[yd, xd] = pref[ys, xs]
        if (dy, dx) in ((0, 1), (1, 0)):
            diff = land & (nb > 0) & (nb != idv)
            f[diff & (npf == pref) & (f == 0)] = 1
            f[diff & (npf != pref)] = 2
        f[land & (nb == 0)] = 3
    return f

def save(name, idv, fl):
    H, W = idv.shape
    rgb = np.zeros((H, W, 3), np.uint8)
    rgb[..., 0] = idv >> 8; rgb[..., 1] = idv & 255; rgb[..., 2] = fl
    p = os.path.join(OUT, name + '.png')
    Image.fromarray(rgb, 'RGB').save(p, optimize=True)
    return os.path.getsize(p)

def lines_in(fn, bbox, keep=lambda p: True):
    out = []
    for f in json.load(open(fn, encoding='utf-8'))['features']:
        if not f['geometry'] or not keep(f['properties']): continue
        g = f['geometry']; ls = g['coordinates'] if g['type'] == 'MultiLineString' else [g['coordinates']]
        for l in ls:
            if any(bbox[0] <= x <= bbox[2] and bbox[1] <= y <= bbox[3] for x, y in l): out.append(l)
    return out

def burn(fl, lines, x0, y0, cell, bit):
    """線をマスに落として、B のビットを立てる"""
    H, W = fl.shape
    m = Image.new('L', (W, H), 0); md = ImageDraw.Draw(m)
    w = 2 if cell <= 0.02 else 1
    for ln in lines:
        pts = [((X - x0) / cell - 0.5, (Y - y0) / cell - 0.5) for X, Y in (proj(*c) for c in ln)]
        md.line(pts, fill=1, width=w)
    fl[np.array(m) > 0] |= bit

n03dir, n02dir, n06dir = sys.argv[1], sys.argv[2], sys.argv[3]
HW = [] if PROD else lines_in(glob.glob(os.path.join(n06dir, '**', 'UTF-8', '*HighwaySection.geojson'), recursive=True)[0],
              (122, 20, 150, 46), keep=lambda p: str(p.get('N06_003')) == '9999')   # いま使われている区間だけ
levels = []

# ---- 日本全体（Natural Earth 由来の 1km から）----
jp = np.array(Image.open(os.path.join(APP, 'assets', 'map', 'map_jp.png')).convert('RGB'))[..., 0].astype(np.int32)
jpmeta = json.load(open(os.path.join(APP, 'assets', 'map', 'map_jp.json'), encoding='utf-8'))
prefs = {int(k): v['name'] for k, v in jpmeta['prefs'].items()}

def downsample(a, n, need):
    H, W = a.shape; h, w = -(-H // n), -(-W // n)
    pad = np.zeros((h * n, w * n), a.dtype); pad[:H, :W] = a
    blk = pad.reshape(h, n, w, n).transpose(0, 2, 1, 3).reshape(h, w, n * n)
    out = np.zeros((h, w), a.dtype)
    for y in range(h):
        for x in range(w):
            v = blk[y, x]; v = v[v > 0]
            if len(v) >= need: out[y, x] = collections.Counter(v.tolist()).most_common(1)[0][0]
    return out

for name, n, need in (('jp8', 8, 20), ('jp2', 2, 2), ('jp1', 1, 1)):
    a = jp if n == 1 else downsample(jp, n, need)
    fl = flags(a, a)
    if n <= 2 and HW: burn(fl, HW, 0.0, 0.0, float(n), 8)
    size = save(name, a, fl)
    levels.append(dict(id=name, cell=float(n), x0=0.0, y0=0.0, W=int(a.shape[1]), H=int(a.shape[0]),
                       kind='pref', bytes=size, src='ne'))
    print(name, a.shape, size)

# ---- 神奈川・東京のまわり（国土数値情報 行政区域）----
BBOX = (138.90, 35.12, 140.02, 35.92)  # 西・南・東・北（伊豆・小笠原の島は入れない）
gx0, gy0 = proj(BBOX[0], BBOX[3]); gx1, gy1 = proj(BBOX[2], BBOX[1])
feats = []
for fn in sorted(glob.glob(os.path.join(n03dir, '**', '*.geojson'), recursive=True)):
    d = json.load(open(fn, encoding='utf-8'))
    for f in d['features']:
        g = f['geometry']
        if not g: continue
        polys = g['coordinates'] if g['type'] == 'MultiPolygon' else [g['coordinates']]
        for poly in polys:
            xs = [c[0] for c in poly[0]]; ys = [c[1] for c in poly[0]]
            if max(xs) < BBOX[0] or min(xs) > BBOX[2] or max(ys) < BBOX[1] or min(ys) > BBOX[3]: continue
            feats.append((f['properties'], poly, (max(xs) - min(xs)) * (max(ys) - min(ys))))
feats.sort(key=lambda t: -t[2])  # 大きい形から塗る（飛び地・中の島があとで上に乗る）
RAIL = [] if PROD else lines_in(glob.glob(os.path.join(n02dir, '**', 'UTF-8', '*RailroadSection.geojson'), recursive=True)[0], BBOX)

munis, mid = [], {}
codeOf = lambda p: p.get('N03_007') or ('x' + (p.get('N03_001') or ''))
for p, _, _ in feats:
    code = codeOf(p)
    if code in mid: continue
    mid[code] = len(munis) + 1
    name = ''.join(x for x in (p.get('N03_003') if not p.get('N03_004') else None, p.get('N03_004'), p.get('N03_005')) if x) or '所属未定地'
    munis.append(dict(code=code, pref=p.get('N03_001'), name=name))
prefIdx = {n: c for c, n in prefs.items()}
mpref = np.array([0] + [prefIdx.get(m['pref'], 0) for m in munis], np.int32)

MAJOR = {'trunk', 'trunk_link', 'primary', 'primary_link', 'secondary', 'secondary_link'}
def stitch(ways):
    """リレーションの外側の線をつないで輪にする"""
    segs = [w[:] for w in ways if len(w) > 1]; rings = []
    while segs:
        r = segs.pop()
        while r[0] != r[-1]:
            for i, sg in enumerate(segs):
                if sg[0] == r[-1]: r += sg[1:]
                elif sg[-1] == r[-1]: r += sg[::-1][1:]
                elif sg[-1] == r[0]: r = sg[:-1] + r
                elif sg[0] == r[0]: r = sg[::-1][:-1] + r
                else: continue
                segs.pop(i); break
            else: break
        if len(r) > 3 and r[0] == r[-1]: rings.append(r)
    return rings

def burn_osm(fl, fn, x0, y0, cell):
    d = json.load(open(fn, encoding='utf-8'))
    H, W = fl.shape
    masks = {b: Image.new('L', (W, H), 0) for b in (16, 32, 64, 128)}
    drs = {b: ImageDraw.Draw(m) for b, m in masks.items()}
    pix = lambda pts: [((X - x0) / cell - 0.5, (Y - y0) / cell - 0.5) for X, Y in (proj(*c) for c in pts)]
    area = lambda t: 64 if t.get('natural') == 'water' or t.get('waterway') == 'riverbank' else 32
    for e in d['elements']:
        t = e.get('tags', {})
        if e['type'] == 'way':
            pts = [(g['lon'], g['lat']) for g in e.get('geometry', [])]
            if len(pts) < 2: continue
            if 'highway' in t:
                drs[16 if t['highway'] in MAJOR else 128].line(pix(pts), fill=1, width=2 if t['highway'] in MAJOR else 1)
            elif t.get('waterway') in ('river', 'canal'):
                drs[64].line(pix(pts), fill=1, width=2)
            elif pts[0] == pts[-1] and len(pts) > 3:
                drs[area(t)].polygon(pix(pts), fill=1)
        elif e['type'] == 'relation':
            outer = [[(g['lon'], g['lat']) for g in m.get('geometry', [])] for m in e.get('members', []) if m.get('role') == 'outer' and m.get('geometry')]
            for ring in stitch(outer): drs[area(t)].polygon(pix(ring), fill=1)
    for b, m in masks.items(): fl[np.array(m) > 0] |= b

def raster(name, x0, y0, W, H, cell):
    im = Image.new('I', (W, H), 0); dr = ImageDraw.Draw(im)
    pix = lambda ring: [((X - x0) / cell - 0.5, (Y - y0) / cell - 0.5) for X, Y in (proj(*c) for c in ring)]
    for p, poly, _ in feats:
        dr.polygon(pix(poly[0]), fill=mid[codeOf(p)])
        for hole in poly[1:]: dr.polygon(pix(hole), fill=0)
    a = np.array(im, np.int32)
    fl = flags(a, mpref[a])
    if cell <= 0.25 and RAIL: burn(fl, RAIL, x0, y0, cell, 4)
    if HW: burn(fl, HW, x0, y0, cell, 8)
    osm = os.path.join(sys.argv[4], f'osm_{name}.json') if len(sys.argv) > 4 else ''
    if osm and os.path.exists(osm): burn_osm(fl, osm, x0, y0, cell)
    size = save(name, a, fl)
    levels.append(dict(id=name, cell=cell, x0=x0, y0=y0, W=W, H=H, kind='muni', bytes=size, src='n03'))
    print(name, a.shape, size)

for name, cell in (('kt1000', 1.0), ('kt250', 0.25), ('kt100', 0.1), ('kt50', 0.05)):
    raster(name, gx0, gy0, int(round((gx1 - gx0) / cell)), int(round((gy1 - gy0) / cell)), cell)

# ---- 名所のまわりだけ 20m（±2.5km の四角。重なるものはまとめる）----
if PROD:   # 本番の名所：ドット絵の名所（places.js の DOT）と写真の名所（photo_places.js）
    import re
    js = open(os.path.join(APP, 'js', 'places.js'), encoding='utf-8').read()
    places = [dict(lat=float(a), lng=float(b)) for a, b in re.findall(r'lat: ([0-9.]+), lng: ([0-9.]+)', js)]
    src = open(os.path.join(APP, 'js', 'photo_places.js'), encoding='utf-8').read()
    places += json.loads(src[src.index('['):src.rindex(']') + 1])
else:
    src = open(os.path.join(HERE, '..', 'places_lab.js'), encoding='utf-8').read()
    places = json.loads(src[src.index('['):src.rindex(']') + 1])
R, CELL = 2.5, 0.02
boxes = []
for p in places:
    if p.get('kind') == 'sapa': continue
    X, Y = proj(p['lng'], p['lat']); boxes.append([X - R, Y - R, X + R, Y + R])
merged = True
while merged:
    merged = False
    for i in range(len(boxes)):
        for j in range(i + 1, len(boxes)):
            a, b = boxes[i], boxes[j]
            if a[0] < b[2] and b[0] < a[2] and a[1] < b[3] and b[1] < a[3]:
                boxes[i] = [min(a[0], b[0]), min(a[1], b[1]), max(a[2], b[2]), max(a[3], b[3])]; del boxes[j]; merged = True; break
        if merged: break
for i, (x0, y0, x1, y1) in enumerate(boxes):
    raster(f'near{i}', x0, y0, int(round((x1 - x0) / CELL)), int(round((y1 - y0) / CELL)), CELL)

json.dump(dict(proj=dict(lon0=LON0, lat0=LAT0, kx=KX, ky=KY), levels=levels, prefs=prefs, munis=munis,
               sources=dict(ne='Natural Earth（Admin 1, パブリックドメイン）',
                            n03='国土数値情報（行政区域データ N03, 2024年1月1日）国土交通省, CC BY 4.0 を加工して作成',
                            **({} if PROD else dict(n02='国土数値情報（鉄道データ N02, 2023年）国土交通省, CC BY 4.0 を加工して作成',
                                                    n06='国土数値情報（高速道路時系列データ N06, 2024年）国土交通省, CC BY 4.0 を加工して作成')),
                            osm='© OpenStreetMap contributors（ODbL）。名所のまわりの 20m の段の道路・公園・森・水辺')),
          open(os.path.join(OUT, 'levels.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
