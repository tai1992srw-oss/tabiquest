# 名所のまわり（20m の段 near*）に入れる OpenStreetMap のデータを、Overpass API から取ってくる
# 取るもの：ふつうの道路（幹線〜3けた県道くらいまで）・公園・森・水辺（川・池）
# データ：© OpenStreetMap contributors（ODbL）
# 使い方：python fetch_osm.py <保存するフォルダ>   … data/levels.json の near* の範囲ごとに osm_near*.json を保存（あればとばす）
import json, os, sys, time, urllib.request, urllib.parse

HERE = os.path.dirname(os.path.abspath(__file__))
meta = json.load(open(os.path.join(HERE, '..', 'data', 'levels.json'), encoding='utf-8'))
P = meta['proj']
out = sys.argv[1]; os.makedirs(out, exist_ok=True)
Q = '''[out:json][timeout:180];
(
  way["highway"~"^(trunk|trunk_link|primary|primary_link|secondary|secondary_link|tertiary|tertiary_link|unclassified|residential|living_street|pedestrian)$"]({b});
  way["natural"="water"]({b}); relation["natural"="water"]({b});
  way["waterway"~"^(river|canal|riverbank)$"]({b});
  way["leisure"~"^(park|garden)$"]({b}); relation["leisure"~"^(park|garden)$"]({b});
  way["landuse"~"^(forest|grass|recreation_ground)$"]({b}); relation["landuse"="forest"]({b});
  way["natural"="wood"]({b}); relation["natural"="wood"]({b});
);
out geom;'''
for l in meta['levels']:
    if not l['id'].startswith('near'): continue
    fn = os.path.join(out, f"osm_{l['id']}.json")
    if os.path.exists(fn): continue
    w = l['x0'] / P['kx'] + P['lon0']; e = (l['x0'] + l['W'] * l['cell']) / P['kx'] + P['lon0']
    n = P['lat0'] - l['y0'] / P['ky']; s = P['lat0'] - (l['y0'] + l['H'] * l['cell']) / P['ky']
    body = urllib.parse.urlencode({'data': Q.replace('{b}', f'{s:.5f},{w:.5f},{n:.5f},{e:.5f}')}).encode()
    req = urllib.request.Request('https://overpass-api.de/api/interpreter', data=body, headers={'User-Agent': 'dotmap-prototype/0.1'})
    d = urllib.request.urlopen(req, timeout=300).read()
    open(fn, 'wb').write(d)
    print(l['id'], len(d)); time.sleep(3)
