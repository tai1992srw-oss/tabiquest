# タビクエ Webアプリ（v0.3.0）

## PCで動かす
`M:\Claude\旅アプリ` で次を実行し、ブラウザで http://localhost:5180 を開く。
```
python -m http.server 5180 --bind 127.0.0.1 --directory app
```
（JSのモジュールを使っているので、index.html を直接ダブルクリックしても動かない）

## 公開
main に送ると GitHub Actions が `app/` を GitHub Pages に公開する（https://tai1992srw-oss.github.io/tabiquest/）。
**中身を変えて公開するときは、`sw.js` の `VERSION` を上げる**（上げないと、端末に保存された古い版が出つづける）。新しいファイルを足したら `sw.js` の `CORE` にも足す。

## 中身
- `js/places.js` 名所データ。`kind: 'dot'` は Canva の見本を写し取ったドット絵、`'photo'` はドット絵ができるまでの仮の写真
- `js/photo_places.js` 仮の名所（写真・作者・ライセンス）。`research/` の調査結果から作った
- `js/card.js` Three.js の描画の共通部分。WebGL は1つだけ使い回す
- `js/scenes/` 名所ごとの層と動き。`photo.js` は写真の名所用（時間帯・天気は色づけだけ）
- `js/store.js` 記録（本番とデバッグを別々に localStorage へ）。カードは到着ごとの1枚（v2）。v0.1 の記録は自動で移す。書き出し・読み込みもここ
- `js/conditions.js` 到着時の時間帯・天気の自動取得（Open-Meteo。座標は約1km単位に丸める）
- `js/geo.js` 位置情報と到着の判定
- `js/arrival.js` 到着演出（組み上がり→光→スタンプ→紙吹雪→帯）
- `js/zukan.js` 図鑑（名所ごとのアルバム）と、カード1枚の全画面表示
- `js/map.js` ドットの地図（`assets/map/` は Natural Earth の県境を1マス約1kmに落としたもの。R＝県番号、G＝県境・海岸）
- `js/goals.js` アチーブメント（記録から自動で数える）
- `js/debug.js` デバッグモード（設定のバージョン表記を7回つづけてタップ）
- `sw.js` オフライン対応（Service Worker）
- `vendor/three.r128.min.js` Three.js（MIT）
- `assets/` Canva から写し取った層の絵とパレット、仮の写真

## 名所を増やすとき
- ドット絵：`assets/<id>/` に層のPNGと data.json を置き、`js/scenes/<id>.js` を作り、`places.js` に足して `main.js` で `engine.register` する
- 仮の写真：`photo_places.js` に1件足し、写真（360×640）を `assets/photos/` に置く。写真は使ってよいライセンスのものだけにし、作者・ライセンス・元のページを書く
