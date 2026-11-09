#!/usr/bin/env node
// 校准测试：把几首公认的真名曲交给「内心听觉」自检，任何一项判「不及格」都说明规则在冤枉真作曲家，改规则前后都跑一遍。
//   node calibrate.mjs            用 references/calibration/ 里的曲目
// 退出码：有不及格 = 1（可以接进别的检查流程）
import fs from 'node:fs';
import { readMidi, guessKey } from './lib/midiread.mjs';
import { auditScore } from './lib/audit.mjs';

const DIR = new URL('../references/calibration/', import.meta.url);
const SET = [
  ['bach-invention-01.mid', '巴赫 · 二部创意曲 No.1 BWV 772', '巴洛克', 'strict'],
  ['wtk1-prelude1.mid', '巴赫 · 平均律 C 大调前奏曲 BWV 846', '巴洛克', 'strict'],
  ['K545-1.mid', '莫扎特 · K.545 第一乐章', '古典主义', 'strict'],
  ['chopin_nocturne_op9_n2.mid', '肖邦 · 夜曲 Op.9 No.2', '浪漫主义', 'mid'],
];
let bad = 0;
for (const [f, label, era, strict] of SET) {
  const all = readMidi(fs.readFileSync(new URL(f, DIR))), tr = all.filter(t => !t.drum); tr.meta = all.meta;
  const key = guessKey(tr), roles = {}, mix = {}, notes = [];
  tr.forEach((t, i) => { const r = 'v' + (i + 1); roles[r] = { name: t.name || r }; mix[r] = 'piano'; t.notes.forEach(n => notes.push({ p: n.p, t: n.b0, d: Math.max(0.25, n.b1 - n.b0), v: n.v, role: r })); });
  const meter = tr.meta.timeSig ? `${tr.meta.timeSig[0]}/${tr.meta.timeSig[1]}` : '4/4';
  const sym = auditScore({ notes, meter }, { strict, roles, mix, tonicPc: key.pc, melodyRoles: ['v1'], era });
  const fails = sym.items.filter(x => x.level === 'fail'), warns = sym.items.filter(x => x.level === 'warn');
  if (fails.length) bad++;
  console.log(`${fails.length ? '✗' : '✓'} ${label}：${sym.score}/22  ${fails.length ? '不及格 ' + fails.map(x => `${x.name}（${x.value}）`).join('、') : '没有不及格'}${warns.length ? '；警告 ' + warns.map(x => `${x.name}（${x.value}）`).join('、') : ''}`);
}
console.log(bad ? `\n${bad} 首真名曲被判不及格：规则或阈值在冤枉人，先修规则` : '\n校准通过：四首真名曲都没有被判不及格');
process.exit(bad ? 1 : 0);
