#!/usr/bin/env node
// 后期修改：不重新作曲，只改已经生成的作品，然后重出全部产物（音频、分轨、五线谱、简谱、MIDI、自检）。
//   node edit.mjs <作品目录> [修改...]
// 修改（可以一次写多个）：
//   --inst 声部=乐器        换乐器，例：--inst melody=erhu（自动挪八度放进新乐器音域；不想挪加 --keep-octave）
//   --mute 声部 / --unmute 声部
//   --vol 声部=0.6          某个声部的音量（1 = 原样）
//   --octave 声部=+1        某个声部整体高/低八度
//   --bpm 90                改速度（谱面不变，只改快慢）
//   --key D                 整首移到别的调
//   --title "新名字"
//   --from-midi 文件.mid    导入在 GarageBand / MuseScore 里改过的 MIDI（按音轨名对回声部）
//   --list                  列出声部、乐器和历史版本
//   --restore 2             回到第 2 版
// 每次修改前，旧版本的 work.json 和音频会存进「版本记录/v<n>/」，并追加一行到「修改记录.md」。
import fs from 'node:fs';
import path from 'node:path';
import { INSTRUMENTS, fitOctave, shiftTo, KEY_INPUT, keyLabel } from './lib/theory.mjs';
import { readMidi } from './lib/midiread.mjs';
import { produce } from './lib/produce.mjs';

const dir = path.resolve(process.argv[2] || '.');
const wf = path.join(dir, 'work.json');
if (!fs.existsSync(wf)) throw new Error('这个目录里没有 work.json，先用 compose.mjs 生成作品');
let work = JSON.parse(fs.readFileSync(wf, 'utf8'));
const args = process.argv.slice(3), log = [];
const vdir = path.join(dir, '版本记录');
const versions = () => (fs.existsSync(vdir) ? fs.readdirSync(vdir).filter(f => /^v\d+$/.test(f)).map(f => +f.slice(1)).sort((a, b) => a - b) : []);

if (args[0] === '--list' || !args.length) {
  console.log(`《${work.title}》 ${keyLabel(work.key)} ${work.meter} ♩≈${Math.round(work.bpm)}`);
  for (const [r, x] of Object.entries(work.roles)) console.log(`  ${r.padEnd(10)} ${x.name.padEnd(8)} ${INSTRUMENTS[x.inst].name}${x.mute ? '（静音）' : ''}${x.vol !== 1 ? ` 音量 ${x.vol}` : ''}`);
  console.log('历史版本：' + (versions().map(v => 'v' + v).join(' ') || '无'));
  process.exit(0);
}

const take = (i, f) => { const v = args[i + 1]; if (v == null) throw new Error(`${f} 后面要跟值`); return v; };
const role = r => { if (!work.roles[r]) throw new Error(`没有声部「${r}」，可用：${Object.keys(work.roles).join(', ')}`); return r; };
const keepOct = args.includes('--keep-octave');
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--keep-octave') continue;
  if (a === '--restore') {
    const v = take(i++, a), src = path.join(vdir, 'v' + v, 'work.json');
    if (!fs.existsSync(src)) throw new Error('没有这个版本：v' + v);
    work = JSON.parse(fs.readFileSync(src, 'utf8')); log.push(`回到 v${v}`); continue;
  }
  if (a === '--inst') {
    const [r, inst] = take(i++, a).split('='); role(r); if (!INSTRUMENTS[inst]) throw new Error('不认识的乐器：' + inst);
    const old = work.roles[r].inst; work.roles[r].inst = inst;
    let note = '';
    if (!keepOct && !INSTRUMENTS[inst].drum) { const ps = work.notes.filter(n => n.role === r).map(n => n.p), f = fitOctave(ps, INSTRUMENTS[inst].range); if (f.oct) { work.notes.forEach(n => { if (n.role === r) n.p += f.oct * 12; }); note = `（整体移 ${f.oct > 0 ? '+' : ''}${f.oct} 个八度放进音域）`; } }
    log.push(`${work.roles[r].name}：${INSTRUMENTS[old].name} → ${INSTRUMENTS[inst].name}${note}`); continue;
  }
  if (a === '--mute' || a === '--unmute') { const r = role(take(i++, a)); work.roles[r].mute = a === '--mute'; log.push(`${work.roles[r].name}${a === '--mute' ? '静音' : '取消静音'}`); continue; }
  if (a === '--vol') { const [r, v] = take(i++, a).split('='); role(r); work.roles[r].vol = +v; log.push(`${work.roles[r].name}音量 → ${v}`); continue; }
  if (a === '--octave') { const [r, v] = take(i++, a).split('='); role(r); work.notes.forEach(n => { if (n.role === r) n.p += 12 * +v; }); log.push(`${work.roles[r].name}整体 ${+v > 0 ? '+' : ''}${v} 个八度`); continue; }
  if (a === '--bpm') { const b = +take(i++, a), k = work.bpm / b; work.notes.forEach(n => { n.s = +(n.s * k).toFixed(4); n.e = +(n.e * k).toFixed(4); }); log.push(`速度 ♩${Math.round(work.bpm)} → ♩${b}`); work.bpm = b; continue; }
  if (a === '--key') {
    const kname = take(i++, a); if (KEY_INPUT[kname] == null) throw new Error('调名写成 C、D、Eb、F# 这种');
    const d = shiftTo(work.key.pc, KEY_INPUT[kname]); work.notes.forEach(n => { if (!INSTRUMENTS[work.roles[n.role].inst].drum) n.p += d; });
    const from = keyLabel(work.key); work.key = { ...work.key, pc: KEY_INPUT[kname] }; log.push(`移调 ${from} → ${keyLabel(work.key)}（${d > 0 ? '+' : ''}${d} 个半音）`); continue;
  }
  if (a === '--title') { work.title = take(i++, a); log.push(`改名「${work.title}」`); continue; }
  if (a === '--from-midi') {
    const f = path.resolve(take(i++, a)), tracks = readMidi(fs.readFileSync(f));
    const roles = Object.entries(work.roles), used = new Set(), notes = [];
    tracks.forEach((tr, k) => {
      const hit = roles.find(([r, x]) => !used.has(r) && (tr.name === x.name || tr.name.includes(x.name) || tr.name === r)) || roles.filter(([r]) => !used.has(r))[0];
      if (!hit) return; used.add(hit[0]);
      const spb = 60 / work.bpm;
      tr.notes.forEach(n => notes.push({ p: n.p, s: +n.s.toFixed(4), e: +n.e.toFixed(4), v: +n.v.toFixed(3), role: hit[0], t: Math.round(n.s / spb * 4) / 4, d: Math.max(0.25, Math.round((n.e - n.s) / spb * 4) / 4) }));
    });
    work.notes = notes; log.push(`导入 MIDI：${path.basename(f)}（${tracks.length} 条音轨，${notes.length} 个音；谱面按 ♩≈${Math.round(work.bpm)} 重新对齐到十六分音符）`); continue;
  }
  throw new Error('看不懂的修改：' + a);
}

// 先把当前版本存档，再出新版本
const vs = versions(), next = (vs[vs.length - 1] || 0) + 1, keep = path.join(vdir, 'v' + next);
fs.mkdirSync(keep, { recursive: true });
fs.copyFileSync(wf, path.join(keep, 'work.json'));
if (fs.existsSync(path.join(dir, '音频.m4a'))) fs.copyFileSync(path.join(dir, '音频.m4a'), path.join(keep, '音频.m4a'));
if (fs.existsSync(path.join(dir, '动态曲谱.mp4'))) fs.rmSync(path.join(dir, '动态曲谱.mp4'));
const res = await produce(work, dir);
fs.appendFileSync(path.join(dir, '修改记录.md'), (fs.existsSync(path.join(dir, '修改记录.md')) ? '' : `# 修改记录 · ${work.title}\n\n`) + `- ${new Date().toLocaleString('zh-CN')}：${log.join('；')}（改之前的版本存为 版本记录/v${next}）\n`);
console.log(JSON.stringify({ dir, changes: log, savedPrevious: 'v' + next, seconds: res.seconds, scoreAudit: res.sym.score, fails: [...res.sym.items, ...res.aud.items].filter(x => x.level === 'fail').map(x => x.name), files: res.files, note: '动态曲谱视频需要重新跑 score_video.py' }, null, 1));
