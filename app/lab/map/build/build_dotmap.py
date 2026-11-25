# ドットの地図の試作（案A）のデータを作る
# 地形データを決まった大きさのマスに落とすだけ（手で描き足さない）
#   日本全体：app/assets/map/map_jp.png（Natural Earth の県境を 1マス約1km に落としたもの）を 2km・8km にまとめる
#   神奈川・東京のまわり：国土数値情報 行政区域（N03, 2024年1月1日, CC BY 4.0）を 1km・250m・100m・50m のマスに落とす
#   250m より細かい段には、国土数値情報 鉄道（N02, 2023年, CC BY 4.0）の線路と駅も落とす
# 出力（app/lab/map/data/）：<level>.png … R*256+G＝番号（0＝海）、B＝1:市区町村の境 2:県境 3:海岸 4:線路 5:駅
#                            levels.json … 各段の位置・大きさ・番号の表
# 使い方：python build_dotmap.py <N03 の geojson を入れたフォルダ> [N02 を展開したフォルダ]
import json, sys, glob, os, collections
import numpy as np
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.normpath(os.path.join(HERE, '..', '..', '..'))
OUT = os.path.join(HERE, '..', 'data')
os.makedirs(OUT, exist_ok=True)

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
    size = save(name, a, flags(a, a))
    levels.append(dict(id=name, cell=float(n), x0=0.0, y0=0.0, W=int(a.shape[1]), H=int(a.shape[0]),
                       kind='pref', bytes=size, src='ne'))
    print(name, a.shape, size)

# ---- 神奈川・東京のまわり（国土数値情報 行政区域）----
BBOX = (138.90, 35.12, 140.02, 35.92)  # 西・南・東・北（伊豆・小笠原の島は入れない）
gx0, gy0 = proj(BBOX[0], BBOX[3]); gx1, gy1 = proj(BBOX[2], BBOX[1])
feats = []
for fn in sorted(glob.glob(os.path.join(sys.argv[1], '**', '*.geojson'), recursive=True)):
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

# 鉄道（国土数値情報 N02, 2023年, CC BY 4.0）。第2引数があれば使う
RAIL, STATION = [], []
def lines_in(fn):
    out = []
    for f in json.load(open(fn, encoding='utf-8'))['features']:
        g = f['geometry']; ls = g['coordinates'] if g['type'] == 'MultiLineString' else [g['coordinates']]
        for l in ls:
            if any(BBOX[0] <= x <= BBOX[2] and BBOX[1] <= y <= BBOX[3] for x, y in l): out.append(l)
    return out
if len(sys.argv) > 2:
    RAIL = lines_in(glob.glob(os.path.join(sys.argv[2], '**', 'UTF-8', '*RailroadSection.geojson'), recursive=True)[0])
    STATION = lines_in(glob.glob(os.path.join(sys.argv[2], '**', 'UTF-8', '*Station.geojson'), recursive=True)[0])

munis, mid = [], {}
for p, _, _ in feats:
    code = p.get('N03_007') or ('x' + (p.get('N03_001') or ''))
    if code in mid: continue
    mid[code] = len(munis) + 1
    name = ''.join(x for x in (p.get('N03_003') if not p.get('N03_004') else None, p.get('N03_004'), p.get('N03_005')) if x) or '所属未定地'
    munis.append(dict(code=code, pref=p.get('N03_001'), name=name))
prefIdx = {n: c for c, n in prefs.items()}
mpref = np.array([0] + [prefIdx.get(m['pref'], 0) for m in munis], np.int32)

for name, cell in (('kt1000', 1.0), ('kt250', 0.25), ('kt100', 0.1), ('kt50', 0.05)):
    W = int(round((gx1 - gx0) / cell)); H = int(round((gy1 - gy0) / cell))
    im = Image.new('I', (W, H), 0); dr = ImageDraw.Draw(im)
    def pix(ring):
        out = []
        for lng, lat in ring:
            X, Y = proj(lng, lat); out.append(((X - gx0) / cell - 0.5, (Y - gy0) / cell - 0.5))
        return out
    for p, poly, _ in feats:
        code = p.get('N03_007') or ('x' + (p.get('N03_001') or ''))
        dr.polygon(pix(poly[0]), fill=mid[code])
        for hole in poly[1:]: dr.polygon(pix(hole), fill=0)
    a = np.array(im, np.int32)
    fl = flags(a, mpref[a])
    if cell <= 0.25 and RAIL:   # 鉄道（線）と駅（4=線路 5=駅）。細かい段だけ
        for kind, lines in (('rail', RAIL), ('st', STATION)):
            m = Image.new('L', (W, H), 0); md = ImageDraw.Draw(m)
            for ln in lines: md.line(pix(ln), fill=1, width=1 if kind == 'rail' else (3 if cell <= 0.05 else 2))
            fl[np.array(m) > 0] = 4 if kind == 'rail' else 5
    size = save(name, a, fl)
    levels.append(dict(id=name, cell=cell, x0=gx0, y0=gy0, W=W, H=H, kind='muni', bytes=size, src='n03'))
    print(name, a.shape, size, len(munis))

json.dump(dict(proj=dict(lon0=LON0, lat0=LAT0, kx=KX, ky=KY), levels=levels, prefs=prefs, munis=munis,
               sources=dict(ne='Natural Earth（Admin 1, パブリックドメイン）',
                            n03='国土数値情報（行政区域データ N03, 2024年1月1日）国土交通省, CC BY 4.0 を加工して作成',
                            n02='国土数値情報（鉄道データ N02, 2023年）国土交通省, CC BY 4.0 を加工して作成')),
          open(os.path.join(OUT, 'levels.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
