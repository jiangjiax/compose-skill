#!/usr/bin/env node
// 从公有领域曲谱库量出「真实作曲家」的统计，给「内心听觉」自检当时代阈值。
//   node corpus_stats.mjs <MIDI 目录> <曲库目录 scores.json>
//   MIDI 目录：每首一个子目录（Mutopia 路径 作曲家__作品__文件名），里面是 .mid；scores.json 用来查每首属于哪个时代
// 一首曲子一个目录，量一次（不是一个文件量一次）。量的东西和 lib/audit.mjs 用的是同一套算法：
//   强拍刺耳率（排不成三和弦 / 七和弦、又有「打架」音程的整拍占比）、最高声部的大跳比例（>7 个半音）、级进比例（1–2 个半音）、音域跨度
// 写出 references/corpus-thresholds.json：刺耳率上限取第 75 百分位（真曲子整拍上常带经过音，第 90 百分位会宽到 50% 以上，挡不住生成的脏和声）；
//   大跳、跨度上限取第 90 百分位，级进、跨度下限取第 10 百分位
// 「第 90 百分位」的意思：这个时代 90% 的真曲子都在这条线以内；所以按它判，真名曲几乎不会被冤枉，明显出格的仍然会报
import fs from 'node:fs';
import path from 'node:path';
import { readMidi } from './lib/midiread.mjs';
import { isHarsh } from './lib/audit.mjs';

const [midiDir, catalog] = process.argv.slice(2);
if (!midiDir || !catalog) { console.error('用法：node corpus_stats.mjs <MIDI 目录> <scores.json>'); process.exit(1); }
const cat = JSON.parse(fs.readFileSync(catalog, 'utf8'));
const eraOf = {}; for (const p of cat.pieces) eraOf[p.ftp.split('/ftp/')[1].split('/').slice(0, 3).join('__')] = p.era;
const pc = p => ((p % 12) + 12) % 12;

// 一首曲子一个目录：有 score.mid 就用它；没有就把目录里的分谱（一件乐器一个文件）合成总谱再量，免得单声部分谱把刺耳率拉低
function measure(files) {
  const all = files.flatMap(f => readMidi(fs.readFileSync(f))).filter(t => !t.drum && t.notes.length >= 8);
  if (!all.length) return null;
  const notes = all.flatMap((t, i) => t.notes.map(n => ({ p: n.p, t: n.b0, d: Math.max(0.25, n.b1 - n.b0), tr: i })));
  const last = Math.max(...notes.map(n => n.t + n.d));
  let beats = 0, harsh = 0;
  for (let t = 0; t < last; t += 1) {
    const ps = [...new Set(notes.filter(n => n.t <= t + 1e-6 && n.t + n.d > t + 1e-6).map(n => pc(n.p)))];
    if (ps.length < 2) continue; beats++; if (isHarsh(ps)) harsh++;
  }
  const avg = i => { const ps = notes.filter(n => n.tr === i).map(n => n.p); return ps.reduce((a, b) => a + b, 0) / ps.length; };
  const top = all.map((_, i) => i).sort((a, b) => avg(b) - avg(a))[0];
  const by = new Map(); for (const n of notes.filter(n => n.tr === top)) { const k = Math.round(n.t * 4); if (!by.has(k) || by.get(k).p < n.p) by.set(k, n); }
  const mel = [...by.values()].sort((a, b) => a.t - b.t); if (mel.length < 16) return null;
  const iv = mel.slice(1).map((n, i) => n.p - mel[i].p);
  return { harsh: beats ? harsh / beats : 0, leap: iv.filter(x => Math.abs(x) > 7).length / iv.length, step: iv.filter(x => Math.abs(x) >= 1 && Math.abs(x) <= 2).length / iv.length, span: Math.max(...mel.map(n => n.p)) - Math.min(...mel.map(n => n.p)) };
}

const by = {};
for (const d of fs.readdirSync(midiDir)) {
  const era = eraOf[d]; if (!era) continue;
  const dir = path.join(midiDir, d); if (!fs.statSync(dir).isDirectory()) continue;
  const mids = fs.readdirSync(dir).filter(f => f.endsWith('.mid')); if (!mids.length) continue;
  const files = (mids.includes('score.mid') ? ['score.mid'] : mids).map(f => path.join(dir, f));
  let m; try { m = measure(files); } catch { continue; }
  if (m) (by[era] ||= []).push(m);
}
const q = (a, p) => { const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * (s.length - 1)))]; };
const eras = {};
for (const [era, xs] of Object.entries(by)) {
  if (xs.length < 15) continue; // 样本太少不出阈值
  const col = k => xs.map(x => x[k]);
  eras[era] = { n: xs.length, harsh: +q(col('harsh'), 0.75).toFixed(3), harshP90: +q(col('harsh'), 0.9).toFixed(3), leap: +q(col('leap'), 0.9).toFixed(3), step: +q(col('step'), 0.1).toFixed(3), spanLo: q(col('span'), 0.1), spanHi: q(col('span'), 0.9),
    median: { harsh: +q(col('harsh'), 0.5).toFixed(3), leap: +q(col('leap'), 0.5).toFixed(3), step: +q(col('step'), 0.5).toFixed(3), span: q(col('span'), 0.5) } };
}
const out = new URL('../references/corpus-thresholds.json', import.meta.url);
fs.writeFileSync(out, JSON.stringify({ _说明: '由 scripts/corpus_stats.mjs 从公有领域曲谱库量出来；刺耳率上限取第 75 百分位，大跳 / 跨度上限取第 90 百分位，级进 / 跨度下限取第 10 百分位；median 是中位数，给人看的', source: path.basename(path.dirname(catalog)), measured: new Date().toISOString().slice(0, 10), eras }, null, 1));
console.log('| 时代 | 首数 | 刺耳率上限 | 大跳上限 | 级进下限 | 跨度 | 中位数（刺耳 / 大跳 / 级进 / 跨度） |\n|---|---|---|---|---|---|---|');
for (const [e, x] of Object.entries(eras)) console.log(`| ${e} | ${x.n} | ${(x.harsh * 100).toFixed(0)}% | ${(x.leap * 100).toFixed(1)}% | ${(x.step * 100).toFixed(0)}% | ${x.spanLo}–${x.spanHi} | ${(x.median.harsh * 100).toFixed(0)}% / ${(x.median.leap * 100).toFixed(1)}% / ${(x.median.step * 100).toFixed(0)}% / ${x.median.span} |`);
console.log('写入', out.pathname);
