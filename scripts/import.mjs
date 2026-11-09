#!/usr/bin/env node
// 导入曲谱：现成的 MIDI（比如 Mutopia 上公有领域的名曲）→ 一首作品（work.json）→ 全部产物
//   node import.mjs <曲谱.mid> <作品目录> [--title 名字] [--composer 作曲家] [--era 时代] [--inst 声部=乐器 ...] [--all 乐器] [--bpm 90] [--max-seconds 180]
// 音符一个不改，只决定「谁来演奏」：默认按 MIDI 里写的乐器（General MIDI 音色号）对到本 skill 的乐器；
// --inst v1=cello 单换一个声部，--all strings 全部声部换成同一件乐器。之后可以照常用 edit.mjs 换乐器、调速度、移调。
// 声部 id 是 v1、v2…，按 MIDI 音轨顺序；声部名用音轨名（没有就叫「第 N 声部」）。
import fs from 'node:fs';
import path from 'node:path';
import { INSTRUMENTS, keyLabel } from './lib/theory.mjs';
import { readMidi, guessKey } from './lib/midiread.mjs';
import { produce } from './lib/produce.mjs';

const args = process.argv.slice(2);
if (args.length < 2) { console.error('用法：node import.mjs <曲谱.mid> <作品目录> [--title ...] [--inst v1=cello] [--all piano]'); process.exit(1); }
const [midiPath, outDir] = args.map(a => path.resolve(a));
const opt = (name, d) => { const i = args.indexOf(name); return i > 0 ? args[i + 1] : d; };
const insts = Object.fromEntries(args.flatMap((a, i) => (a === '--inst' ? [args[i + 1].split('=')] : [])));
const all = opt('--all');
for (const i of [...Object.values(insts), ...(all ? [all] : [])]) if (!INSTRUMENTS[i]) throw new Error('不认识的乐器：' + i);

// General MIDI 音色号 → 本 skill 的乐器
const GM = [[0, 5, 'piano'], [6, 6, 'harpsichord'], [7, 7, 'harpsichord'], [8, 8, 'celesta'], [9, 9, 'glockenspiel'], [10, 10, 'music_box'], [11, 11, 'vibraphone'], [12, 12, 'marimba'], [13, 13, 'xylophone'], [14, 14, 'tubular_bells'],
  [16, 20, 'organ'], [21, 21, 'accordion'], [22, 22, 'harmonica'], [23, 23, 'accordion'], [24, 24, 'guitar'], [25, 25, 'steel_guitar'], [26, 31, 'e_guitar'], [32, 32, 'bass'], [33, 39, 'e_bass'],
  [40, 40, 'violin'], [41, 41, 'viola'], [42, 42, 'cello'], [43, 43, 'contrabass'], [44, 44, 'tremolo'], [45, 45, 'pizzicato'], [46, 46, 'harp'], [47, 47, 'timpani'], [48, 51, 'strings'], [52, 53, 'choir'], [54, 54, 'voice'],
  [56, 56, 'trumpet'], [57, 57, 'trombone'], [58, 58, 'tuba'], [59, 59, 'muted_trumpet'], [60, 60, 'horn'], [61, 63, 'brass'], [64, 67, 'sax'], [68, 68, 'oboe'], [69, 69, 'english_horn'], [70, 70, 'bassoon'], [71, 71, 'clarinet'],
  [72, 72, 'piccolo'], [73, 73, 'flute'], [74, 74, 'recorder'], [75, 75, 'pan_flute'], [77, 77, 'shakuhachi'], [79, 79, 'ocarina'], [104, 104, 'sitar'], [105, 105, 'banjo'], [106, 106, 'shamisen'], [107, 107, 'koto'], [108, 108, 'kalimba']];
const gmInst = prog => (prog == null ? 'piano' : GM.find(([a, b]) => prog >= a && prog <= b)?.[2] || 'piano');

const tracks = readMidi(fs.readFileSync(midiPath)), meta = tracks.meta;
const pitched = tracks.filter(t => !t.drum);
if (!pitched.length) throw new Error('这个 MIDI 里没有带音高的音符');
const bpm = +opt('--bpm', 0) || Math.round(meta.bpm);
const speed = +opt('--bpm', 0) ? (+opt('--bpm')) / meta.bpm : 1;
const [num, den] = meta.timeSig || [4, 4];
const meter = `${num}/${den}`;
// 调号：升降号个数 → 主音（大调 = 五度圈位置；小调 = 关系小调）
const g = guessKey(tracks), key = { pc: g.pc, minor: g.minor };

const roles = {}, notes = [];
const maxS = +opt('--max-seconds', 0);
pitched.forEach((t, i) => {
  const id = 'v' + (i + 1);
  const inst = insts[id] || all || gmInst(t.program);
  // LilyPond 导出的音轨名常是「:treble」「:bass」「upper」这种，换成看得懂的
  const raw = (t.name || '').replace(/^[:\s]+/, '').trim(), nm = /^(treble|upper|right|rh)\b/i.test(raw) ? '高音谱表' : /^(bass|lower|left|lh)\b/i.test(raw) ? '低音谱表' : raw;
  roles[id] = { name: nm.slice(0, 16) || `第 ${i + 1} 声部`, inst, mute: false, vol: 1, pan: pitched.length > 1 ? +(-0.35 + 0.7 * i / (pitched.length - 1)).toFixed(3) : 0 };
  for (const n of t.notes) {
    const s = n.s / speed, e = n.e / speed;
    if (maxS && s >= maxS) continue;
    notes.push({ p: n.p, t: +n.b0.toFixed(4), d: +Math.max(0.0625, n.b1 - n.b0).toFixed(4), v: +Math.max(0.2, n.v).toFixed(3), role: id, s: +s.toFixed(4), e: +(maxS ? Math.min(e, maxS + 2) : e).toFixed(4) });
  }
});
notes.sort((a, b) => a.s - b.s || b.p - a.p);
const title = opt('--title', path.basename(midiPath, '.mid'));
const work = {
  title, composer: opt('--composer', '佚名'), style: 'import', strict: 'free', era: opt('--era', ''), key, meter, bpm,
  roles, notes, jianpu: null, auditSpan: null, melodyRoles: [Object.keys(roles)[0]], scale: null, source: path.basename(midiPath),
};
fs.mkdirSync(outDir, { recursive: true });
const res = await produce(work, outDir);
fs.writeFileSync(path.join(outDir, '计算记录.md'), `# 计算记录 · ${title}\n\n- 这不是作曲：音符全部来自曲谱 ${path.basename(midiPath)}，一个没改。\n- 调号：${keyLabel(key)}（升降号按 MIDI 里的调号，大小调看结尾的低音落在哪个主音上）　拍号：${meter}　开头速度：♩≈${bpm}\n- 演奏：${Object.entries(roles).map(([r, x]) => `${x.name}=${INSTRUMENTS[x.inst].name}`).join('，')}\n${maxS ? `- 只取了前 ${maxS} 秒\n` : ''}\n后期修改（换乐器、静音、音量、速度、移调）：node edit.mjs <本目录> ...\n`);
console.log(JSON.stringify({ out: outDir, title, key: keyLabel(key), meter, bpm, seconds: res.seconds, roles: Object.fromEntries(Object.entries(roles).map(([r, x]) => [r, `${x.name}=${x.inst}`])), notes: notes.length, files: res.files }, null, 1));
