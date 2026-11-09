// 乐器「性格档案」+ 搭配检查。
// 档案回答的是：这件乐器能不能把一个音拉长、有没有强弱、亮不亮、灵不灵活、在哪个音区最舒服。
// 配器（engine/orchestrate.mjs）按它把音型改成这件乐器擅长的样子；自检（audit.mjs）按它查搭配。
// 「好搭档」不在这里抄一份，运行时从 references/instruments.md 的表格里读，保证只有一个真源。
import fs from 'node:fs';
import { INSTRUMENTS } from './theory.mjs';

// attack：怎么发声（bow 拉 / blow 吹 / pluck 拨 / strike 敲 / key 键盘 / voice 唱 / synth 电子）
// sustain：能不能把音一直拉住；decay：不能拉住的乐器，一个音大约多久衰减完（秒）
// dyn：能不能做强弱；bright：0 暗 – 1 亮；agile：0 笨重 – 1 灵活；tess：最舒服的音区（MIDI）
const P = (attack, sustain, decay, dyn, bright, agile, tess) => ({ attack, sustain, decay, dyn, bright, agile, tess });
export const PROFILE = {
  piano: P('key', false, 4, true, 0.55, 1, [36, 96]), harpsichord: P('pluck', false, 1.5, false, 0.75, 1, [41, 84]), organ: P('key', true, 0, false, 0.5, 0.8, [36, 84]),
  celesta: P('strike', false, 1.5, true, 0.85, 0.9, [72, 100]), epiano: P('key', false, 3, true, 0.4, 0.9, [40, 88]), accordion: P('blow', true, 0, true, 0.6, 0.8, [53, 84]),
  music_box: P('strike', false, 1, false, 0.95, 0.6, [72, 96]),
  strings: P('bow', true, 0, true, 0.5, 0.6, [36, 91]), violin: P('bow', true, 0, true, 0.7, 1, [60, 93]), viola: P('bow', true, 0, true, 0.5, 0.9, [52, 81]),
  cello: P('bow', true, 0, true, 0.4, 0.8, [40, 72]), contrabass: P('bow', true, 0, true, 0.25, 0.4, [31, 55]), tremolo: P('bow', true, 0, true, 0.55, 0.3, [40, 88]),
  pizzicato: P('pluck', false, 0.6, true, 0.5, 0.8, [36, 84]),
  harp: P('pluck', false, 3, true, 0.55, 0.9, [36, 96]), guitar: P('pluck', false, 2.5, true, 0.5, 0.9, [40, 79]), steel_guitar: P('pluck', false, 2.5, true, 0.65, 0.9, [40, 79]),
  banjo: P('pluck', false, 1, true, 0.75, 1, [50, 79]), bass: P('pluck', false, 1.5, true, 0.3, 0.7, [28, 55]),
  flute: P('blow', true, 0, true, 0.7, 1, [62, 93]), piccolo: P('blow', true, 0, true, 0.95, 1, [76, 103]), recorder: P('blow', true, 0, false, 0.6, 0.9, [65, 91]),
  oboe: P('blow', true, 0, true, 0.65, 0.8, [60, 86]), english_horn: P('blow', true, 0, true, 0.5, 0.7, [55, 79]), clarinet: P('blow', true, 0, true, 0.5, 1, [52, 88]),
  bassoon: P('blow', true, 0, true, 0.35, 0.6, [36, 69]), sax: P('blow', true, 0, true, 0.6, 0.9, [52, 79]), pan_flute: P('blow', true, 0, true, 0.6, 0.6, [62, 91]),
  ocarina: P('blow', true, 0, true, 0.6, 0.7, [64, 88]), harmonica: P('blow', true, 0, true, 0.65, 0.7, [62, 91]),
  horn: P('blow', true, 0, true, 0.45, 0.5, [41, 72]), trumpet: P('blow', true, 0, true, 0.85, 0.8, [58, 79]), muted_trumpet: P('blow', true, 0, true, 0.7, 0.8, [58, 79]),
  trombone: P('blow', true, 0, true, 0.6, 0.5, [41, 67]), tuba: P('blow', true, 0, true, 0.3, 0.3, [29, 53]),
  timpani: P('strike', false, 2, true, 0.3, 0.4, [38, 55]), marimba: P('strike', false, 0.8, true, 0.5, 1, [48, 91]), vibraphone: P('strike', false, 3, true, 0.6, 0.9, [55, 86]),
  xylophone: P('strike', false, 0.4, true, 0.9, 1, [65, 103]), glockenspiel: P('strike', false, 2, true, 1, 0.9, [79, 105]), tubular_bells: P('strike', false, 4, true, 0.7, 0.2, [60, 77]),
  drums: P('strike', false, 0.5, true, 0.6, 1, [0, 127]),
  choir: P('voice', true, 0, true, 0.45, 0.4, [48, 79]), voice: P('voice', true, 0, true, 0.5, 0.6, [55, 79]),
  dizi: P('blow', true, 0, true, 0.8, 1, [69, 93]), erhu: P('bow', true, 0, true, 0.65, 0.9, [62, 88]), guzheng: P('pluck', false, 2.5, true, 0.6, 0.9, [43, 86]),
  pipa: P('pluck', false, 1.2, true, 0.7, 1, [50, 84]), koto: P('pluck', false, 2, true, 0.6, 0.8, [52, 88]), shamisen: P('pluck', false, 1, true, 0.7, 0.9, [52, 84]),
  shakuhachi: P('blow', true, 0, true, 0.45, 0.6, [57, 86]), sitar: P('pluck', false, 2.5, true, 0.7, 0.8, [50, 81]), kalimba: P('strike', false, 1.2, true, 0.75, 0.8, [62, 91]),
  synth_pad: P('synth', true, 0, true, 0.4, 0.3, [43, 84]), synth_lead: P('synth', true, 0, true, 0.8, 1, [57, 91]), synth_bass: P('synth', true, 0, true, 0.35, 0.8, [28, 55]),
  e_guitar: P('pluck', false, 2, true, 0.6, 0.9, [40, 79]), e_bass: P('pluck', false, 1.5, true, 0.35, 0.8, [28, 55]), brass: P('blow', true, 0, true, 0.75, 0.6, [46, 79]),
};
// 一次只能发一个音的乐器（独奏管乐、独奏弦乐、人声独唱……）：派去铺和弦时只留一个声部
const POLY = new Set(['piano', 'harpsichord', 'organ', 'celesta', 'epiano', 'accordion', 'music_box', 'strings', 'tremolo', 'pizzicato', 'harp', 'guitar', 'steel_guitar', 'banjo', 'marimba', 'vibraphone', 'xylophone', 'glockenspiel', 'tubular_bells', 'choir', 'guzheng', 'koto', 'kalimba', 'sitar', 'synth_pad', 'e_guitar', 'brass', 'drums']);
export const isPoly = inst => POLY.has(inst);
export const profile = inst => PROFILE[inst] || P('key', false, 2, true, 0.5, 0.8, INSTRUMENTS[inst]?.range || [36, 96]);

// ---- 从 references/instruments.md 读「好搭档」 ----
let PARTNERS = null;
export function partners() {
  if (PARTNERS) return PARTNERS;
  PARTNERS = {};
  const md = fs.readFileSync(new URL('../../references/instruments.md', import.meta.url), 'utf8');
  const nameToId = {}; let head = null; const rows = [];
  for (const line of md.split('\n')) {
    if (!line.startsWith('|')) { head = null; continue; }
    const cells = line.split('|').slice(1, -1).map(s => s.trim());
    if (cells[0] === 'id') { head = cells; continue; }
    if (!head || cells[0].startsWith('---')) continue;
    const id = cells[0]; if (!INSTRUMENTS[id]) continue;
    nameToId[cells[1].replace(/（.*?）/g, '')] = id; nameToId[cells[1]] = id;
    rows.push({ id, list: cells[head.indexOf('好搭档')] || '' });
  }
  const FAMILY = { 弦乐: ['strings', 'violin', 'viola', 'cello', 'contrabass'], 木管: ['flute', 'oboe', 'clarinet', 'bassoon'], 乐队: Object.keys(INSTRUMENTS), 几乎所有: Object.keys(INSTRUMENTS) };
  for (const { id, list } of rows) {
    const set = new Set();
    for (const raw of list.split(/[、，,]/).map(s => s.trim()).filter(Boolean)) {
      const n = raw.replace(/（.*?）/g, '');
      if (nameToId[n]) set.add(nameToId[n]); else if (FAMILY[n]) FAMILY[n].forEach(x => set.add(x));
    }
    PARTNERS[id] = set;
  }
  return PARTNERS;
}
export const arePartners = (a, b) => { const P = partners(); return !!(P[a]?.has(b) || P[b]?.has(a)); };

// ---- 搭配检查 ----
// 两件乐器同时响的时候，会不会「糊成一片」或「互相打架」。
// 规则来自 instruments.md 的编制三条：一个唱一个托；高中低分层不挤；音色要有反差。
const median = xs => { const s = xs.slice().sort((a, b) => a - b); return s.length ? s[s.length >> 1] : 0; };
export function pairIssue(a, b, { medA, medB } = {}) {
  const A = profile(a), B = profile(b);
  const ma = medA ?? (A.tess[0] + A.tess[1]) / 2, mb = medB ?? (B.tess[0] + B.tess[1]) / 2;
  const close = Math.abs(ma - mb) <= 7, same = A.attack === B.attack;
  const bothBrightStruck = ['strike', 'pluck'].includes(A.attack) && ['strike', 'pluck'].includes(B.attack) && A.bright >= 0.7 && B.bright >= 0.7;
  if (a === b) return null;
  if (bothBrightStruck && Math.abs(ma - mb) <= 12) return { level: 'fail', why: `${INSTRUMENTS[a].name}和${INSTRUMENTS[b].name}都是又亮又脆、一敲就散的声音，音区又离得不到一个八度，两层会糊成一片、听着扎耳朵` };
  // 拉的、吹的、唱的同类乐器本来就常一起合奏（弦乐组、木管组），只管敲的、拨的、键盘、电子
  if (same && close && !arePartners(a, b) && !['bow', 'voice', 'blow'].includes(A.attack)) return { level: 'warn', why: `${INSTRUMENTS[a].name}和${INSTRUMENTS[b].name}发声方式一样、音区也挨着，音色没有反差，两条线不容易分清` };
  if (bothBrightStruck) return { level: 'warn', why: `${INSTRUMENTS[a].name}和${INSTRUMENTS[b].name}都很亮很脆，同时响会偏刺耳；最好一高一低拉开，或者换一件拉的 / 吹的` };
  return null;
}
// roles：{role: inst}；notes：用来算每个声部实际的音区中位数，以及谁和谁同时响
export function ensembleIssues(roles, notes = null) {
  const ids = Object.keys(roles).filter(r => !INSTRUMENTS[roles[r]]?.drum);
  const med = {}, span = {};
  for (const r of ids) {
    const ps = notes ? notes.filter(n => n.role === r).map(n => n.p) : [];
    med[r] = ps.length ? median(ps) : undefined;
    const ts = notes ? notes.filter(n => n.role === r) : [];
    span[r] = ts.length ? [Math.min(...ts.map(n => n.t)), Math.max(...ts.map(n => n.t + n.d))] : [0, 1];
  }
  const out = [];
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
    const a = ids[i], b = ids[j];
    if (span[a][1] <= span[b][0] || span[b][1] <= span[a][0]) continue; // 从不同时响
    const is = pairIssue(roles[a], roles[b], { medA: med[a], medB: med[b] });
    if (is) out.push({ roles: [a, b], insts: [roles[a], roles[b]], ...is });
  }
  return out;
}
// 给提问用：某件乐器最合适的几个搭档（好搭档 ∩ 没有搭配问题）
export function suggestPartners(inst, n = 4) {
  const P = partners()[inst] || new Set();
  return [...P].filter(x => x !== inst && !pairIssue(inst, x)).slice(0, n);
}
