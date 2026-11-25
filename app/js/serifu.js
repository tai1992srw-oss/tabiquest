// キャラのセリフ（2026-11-26）。ホームのふきだしで、あいさつ・後ろの景色の名所・いちばん近い名所のことを話す
//   性格ごとに serifu/<id>.json を持つ。「ふつう」（futsuu）が元で、ほかの性格はそれを話し方だけ書きかえたもの（AI で作って、事実が変わっていないかを機械で確かめた）
//   名所のセリフの中身は、名所の説明（blurb）にあることだけ。事実を足すときは futsuu.json に足し、ほかの性格も作り直す
//   JSON の形：{ greet:{morning,day,evening,night}, common:{nearClose,near,firstCard,zukan,dress,login}, extra:[…], places:{ 名所id:[…] } }
//     セリフは文字列か、{ time, text }／{ season, text }（その時間帯・季節だけ言う）。{name}{km}{n} は差しこみ
import { settings, saveSettings } from './store.js';

export const PERSONAS = [
  { id: 'futsuu', name: 'ふつう', sample: 'みなとみらい、海と観覧車がいっしょに見えるのがいいよね' },
  { id: 'genki', name: 'げんき' },
  { id: 'mukuchi', name: 'むくち' },
  { id: 'ottori', name: 'おっとり' },
  { id: 'ojousama', name: 'おじょうさま' },
  { id: 'tsundere', name: 'ツンデレ' },
  { id: 'monoshiri', name: 'ものしり' },
  { id: 'gal', name: 'ギャル' },
  { id: 'cool', name: 'クール' },
  { id: 'kansai', name: '関西弁' },
  { id: 'hazukashi', name: 'はずかしがり' },
  { id: 'boku', name: 'ボクっ娘' },
];
export const charaPersona = () => (PERSONAS.some(p => p.id === settings.charaPersona) ? settings.charaPersona : 'futsuu');
export function setCharaPersona(id) { if (id && id !== 'futsuu') settings.charaPersona = id; else delete settings.charaPersona; saveSettings(); }

const cache = {};
export function loadSerifu(id = charaPersona()) {
  return cache[id] || (cache[id] = fetch(`serifu/${id}.json`).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .catch(e => { delete cache[id]; if (id !== 'futsuu') return loadSerifu('futsuu'); throw e; }));
}
// いま言えるセリフだけにする（時間帯・季節が合うもの）
export const pick = (list, { time, season } = {}) => (list || []).filter(s => typeof s === 'string' || ((!s.time || s.time === time) && (!s.season || s.season === season))).map(s => (typeof s === 'string' ? s : s.text));
export const fill = (s, v) => s.replace(/\{(\w+)\}/g, (m, k) => (k in v ? v[k] : m));
