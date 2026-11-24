# タビクエ Webアプリ（v0.1.0）

## PCで動かす
`M:\Claude\旅アプリ` で次を実行し、ブラウザで http://localhost:5180 を開く。
```
python -m http.server 5180 --bind 127.0.0.1 --directory app
```
（JSのモジュールを使っているので、index.html を直接ダブルクリックしても動かない）

## 中身
- `js/places.js` 名所データ（緯度経度・半径・アイテム名は仮）
- `js/card.js` Three.js の描画の共通部分。WebGL は1つだけ使い回す
- `js/scenes/` 名所ごとの層と動き（canva_layers / chukagai_canva の page.html から移したもの）
- `js/arrival.js` 到着演出（組み上がり→光→スタンプ→紙吹雪→帯）
- `js/zukan.js` 図鑑と全画面表示
- `js/store.js` 記録（本番とデバッグを別々に localStorage に保存）
- `js/geo.js` 位置情報と到着の判定
- `js/debug.js` デバッグモード（設定のバージョン表記を7回つづけてタップ）
- `assets/` Canva から写し取った層の絵とパレット

## 名所を増やすとき
1. `assets/<id>/` に層のPNGと data.json を置く
2. `js/scenes/<id>.js` を作る（既存の2つと同じ形）
3. `js/places.js` に1件足し、`js/main.js` で `engine.register` する
