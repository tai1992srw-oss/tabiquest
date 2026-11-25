// Pixel Refiner の処理を別スレッドで動かす（数秒かかるので、画面を止めないため）
import { processImage } from './vendor/pixel-refiner.js';

self.onmessage = e => {
  const { id, w, h, data, opt } = e.data;
  try {
    const r = processImage({ width: w, height: h, data }, opt);
    const out = r.result;
    self.postMessage({ id, ok: true, w: out.width, h: out.height, data: out.data, cellW: r.grid.cellW, cellH: r.grid.cellH }, [out.data.buffer]);
  } catch (err) {
    self.postMessage({ id, ok: false, err: String(err && err.message || err) });
  }
};
