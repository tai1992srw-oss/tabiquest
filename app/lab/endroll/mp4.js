// H.264 の映像1本だけを MP4 に詰める、小さな手書きの箱づめ（ライブラリを使わない）
// WebCodecs の VideoEncoder が出すかたまり（avc 形式）と、avcC（decoderConfig.description）を受け取る
// moov を前に置く（再生がすぐ始まる形）。音を入れるときは trak をもう1本（mp4a）足す
const enc = new TextEncoder();
const u32 = v => [(v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255];
const u16 = v => [(v >>> 8) & 255, v & 255];
const str = s => [...enc.encode(s)];
function box(type, ...parts) {
  const body = parts.flat(Infinity);
  return [...u32(body.length + 8), ...str(type), ...body];
}
const full = (type, ver, flags, ...parts) => box(type, ver, (flags >> 16) & 255, (flags >> 8) & 255, flags & 255, ...parts);
const MATRIX = [0x00010000, 0, 0, 0, 0x00010000, 0, 0, 0, 0x40000000].flatMap(u32);

// chunks: [{ data: Uint8Array, key: bool, ts: µs }]（出てきた順）。fps は一定とする
export function muxMp4({ chunks, avcC, width, height, fps }) {
  const N = chunks.length, TS = fps * 1000, DELTA = 1000, dur = N * DELTA, movDur = Math.round(N / fps * 1000);
  const sizes = chunks.map(c => c.data.byteLength), mdatLen = sizes.reduce((a, b) => a + b, 0);
  const keys = chunks.map((c, i) => (c.key ? i + 1 : 0)).filter(Boolean);
  const ftyp = box('ftyp', str('isom'), u32(512), str('isom'), str('iso2'), str('avc1'), str('mp41'));
  const moovAt = base => box('moov',
    full('mvhd', 0, 0, u32(0), u32(0), u32(1000), u32(movDur), u32(0x00010000), u16(0x0100), new Array(10).fill(0), MATRIX, new Array(24).fill(0), u32(2)),
    box('trak',
      full('tkhd', 0, 3, u32(0), u32(0), u32(1), u32(0), u32(movDur), new Array(8).fill(0), u16(0), u16(0), u16(0), u16(0), MATRIX, u32(width << 16), u32(height << 16)),
      box('mdia',
        full('mdhd', 0, 0, u32(0), u32(0), u32(TS), u32(dur), u16(0x55c4), u16(0)),
        full('hdlr', 0, 0, u32(0), str('vide'), new Array(12).fill(0), str('VideoHandler'), 0),
        box('minf',
          full('vmhd', 0, 1, u16(0), u16(0), u16(0), u16(0)),
          box('dinf', full('dref', 0, 0, u32(1), full('url ', 0, 1))),
          box('stbl',
            full('stsd', 0, 0, u32(1), box('avc1', new Array(6).fill(0), u16(1), u16(0), u16(0), new Array(12).fill(0), u16(width), u16(height),
              u32(0x00480000), u32(0x00480000), u32(0), u16(1), new Array(32).fill(0), u16(0x18), u16(0xffff), box('avcC', [...avcC]))),
            full('stts', 0, 0, u32(1), u32(N), u32(DELTA)),
            full('stss', 0, 0, u32(keys.length), keys.map(u32)),
            full('stsc', 0, 0, u32(1), u32(1), u32(N), u32(1)),
            full('stsz', 0, 0, u32(0), u32(N), sizes.map(u32)),
            full('stco', 0, 0, u32(1), u32(base)))))));
  const moovLen = moovAt(0).length;
  const moov = moovAt(ftyp.length + moovLen + 8);
  const head = new Uint8Array([...ftyp, ...moov, ...u32(mdatLen + 8), ...str('mdat')]);
  return new Blob([head, ...chunks.map(c => c.data)], { type: 'video/mp4' });
}
