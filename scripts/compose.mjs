#!/usr/bin/env node
// 作曲主脚本：作曲卡（JSON）→ 一首曲子的全部产物
//   node compose.mjs <作曲卡.json>
//   node compose.mjs --list            列出经典配方、组合预设、各维度的可选值和乐器
// 两种作曲卡：
//   经典配方   {"style": "nocturne", ...}         styles.cjs 里手写的 18 个固定写法
//   组合配方   {"preset": "court-minuet", "dims": {...}, "ensemble": {...}, "seconds": 50, "cues": [...]}
//             按维度（曲式 / 和声 / 旋律 / 伴奏 / 低音 / 鼓 / 能量 / 编制）拼出来，任何一维都能单独换
//   多版本     {"versions": [{...}, {...}], "motifSeed": 7}  几个版本共用一个主导动机（平行剪辑、同一主题不同场景）
// 产物（写到作曲卡的 out 目录）：
//   音频.m4a  分轨/*.wav  乐谱.mid  乐谱.musicxml  五线谱.html  简谱-<声部>.html
//   计算记录.md  内心听觉自检.md  work.json（作品本体，后期修改用）  piece.json（动态曲谱视频用）  作曲卡-本次.json（这次实际用的卡，含挑中的种子）
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { INSTRUMENTS, parseKey, shiftTo, fitOctave, KEY_INPUT, keyLabel } from './lib/theory.mjs';
import { auditScore, barBeatsOf } from './lib/audit.mjs';
import { ensembleIssues } from './lib/orch.mjs';
import { produce } from './lib/produce.mjs';
import { renderAudio } from './lib/render.mjs';
import { setSoundMode, soundReport, soundfont } from './lib/samples.mjs';
import { composeDims, resolveCard, FORMS, PROCESS, HARMONY, ACCOMP, BASS, DRUMS, SURPRISE } from './lib/engine/index.mjs';
import { PRESETS } from './lib/engine/presets.mjs';
import { FN } from './lib/engine/orchestrate.mjs';

globalThis.window = globalThis;
createRequire(import.meta.url)('./lib/styles.cjs');
const STYLES = globalThis.STYLES;
const ERA = { baroque: '巴洛克', classical: '古典主义', romantic: '浪漫主义', impressionism: '印象派', modern: '20 世纪', chinese: '中国民乐', blues: '布鲁斯', jazz: '爵士' };

if (process.argv[2] === '--list') {
  console.log('## 经典配方（固定写法，"style"）');
  for (const s of STYLES) console.log(`${s.id.padEnd(9)} ${ERA[s.era]} · ${s.name}（${s.who}）  声部：${Object.entries(s.roles).map(([r, x]) => `${r}=${x.name}[默认 ${x.inst}]`).join('，')}`);
  console.log('\n## 组合预设（按维度拼，"preset"；任何一维都能用 "dims" 换掉）');
  for (const p of PRESETS) console.log(`${p.id.padEnd(20)} ${p.era} · ${p.name}  ${p.meter} ♩${p.bpm}  ${Object.entries(p.dims).map(([k, v]) => `${k}=${v}`).join(' ')}  编制：${Object.entries(p.ensemble).map(([f, v]) => `${f}=${[].concat(v).map(x => x.inst || x).join('+')}`).join(' ')}`);
  console.log('\n## 维度可选值');
  console.log('form 曲式：' + Object.entries(FORMS).map(([k, v]) => `${k}（${v.name}）`).join('、'));
  console.log('harmony 和声：' + Object.entries(HARMONY).map(([k, v]) => `${k}（${v.name}）`).join('、'));
  console.log('mstyle 旋律性格：dance 舞曲、lyric 抒情、busy 密、long 长音、march 附点、swing 摇摆');
  console.log('accomp 伴奏音型：' + Object.entries(ACCOMP).map(([k, v]) => `${k}（${v.name}）`).join('、'));
  console.log('bass 低音：' + Object.entries(BASS).map(([k, v]) => `${k}（${v.name}）`).join('、'));
  console.log('drums 鼓：' + Object.entries(DRUMS).map(([k, v]) => `${k}（${v.name}）`).join('、'));
  console.log('process 能量曲线：' + Object.entries(PROCESS).map(([k, v]) => `${k}（${v.name}）`).join('、'));
  console.log('surprise 故意的意外（可多选，写成数组）：' + Object.entries(SURPRISE).map(([k, v]) => `${k}（${v.name}：${v.plain}）`).join('、'));
  console.log('ensemble 功能：' + Object.entries(FN).map(([k, v]) => `${k}（${v.name}）`).join('、'));
  console.log('\n## 乐器：' + Object.entries(INSTRUMENTS).map(([k, v]) => `${k}=${v.name}`).join('，'));
  process.exit(0);
}

const SEED = new WeakMap(); // 没写 seed 时，同一张卡在预检和正式生成里用同一个随机起点
const cardPath = path.resolve(process.argv[2]);
const card0 = JSON.parse(fs.readFileSync(cardPath, 'utf8'));
const outBase = path.resolve(path.dirname(cardPath), card0.out || '.');
const results = [];
if (card0.versions?.length) {
  // 多版本：共用主导动机（motifSeed）、调、速度；每个版本在自己的子目录
  const motifSeed = card0.motifSeed ?? card0.seed ?? Math.floor(Math.random() * 99999) + 1;
  let sharedMotif = card0.motif || null;
  for (const v of card0.versions) {
    const { versions, out, ...shared } = card0;
    // 后面的版本直接用第一个版本的动机（音高轮廓 + 节奏都一样），观众才认得出是同一个主题
    const c = { ...shared, ...v, dims: { ...(shared.dims || {}), ...(v.dims || {}) }, motifSeed, ...(sharedMotif && !v.motif ? { motif: sharedMotif } : {}) };
    if (!v.name) throw new Error('每个版本都要有 name（会用作子目录名）');
    const res = await composeOne(c, path.join(outBase, v.name), { motifSeed }); results.push(res);
    if (!sharedMotif && res.motif) sharedMotif = { degs: res.motif.degs, rhythm: res.motif.rhythm };
  }
  fs.writeFileSync(path.join(outBase, '多版本说明.md'), `# ${card0.title || '多版本'}\n\n几个版本共用同一个主导动机（动机种子 ${motifSeed}；音阶级数 [${(sharedMotif?.degs || []).join(', ')}]，节奏 [${(sharedMotif?.rhythm || []).join(' ')}] 拍），调、速度一致，可以在剪辑里互切或叠在一起。\n\n${results.map(r => `- **${r.name}**：${r.out}（${r.seconds} 秒，${r.key}，${r.desc}）`).join('\n')}\n\n剪辑提示：两个版本拍号不同时，一拍一样长但强拍不总对齐，按两种拍号的最小公倍数拍数为一个周期切，或在切点交叉淡化 0.3 秒左右。\n`);
} else if (card0.ab) {
  // 盲听：同一张卡出两首都过线的（候选 A / B），文件名不透露哪首自检分高；用户听完挑一首，把挑中的写进盲听记录
  const fixed = { ...card0, seed: base0(card0) };
  for (const [i, tag] of [[0, 'A'], [1, 'B']]) results.push(await composeOne({ ...fixed, abPick: i, title: `${card0.title || '作品'} · 候选 ${tag}` }, path.join(outBase, '候选' + tag), {}));
  fs.writeFileSync(path.join(outBase, '盲听.md'), `# 盲听 · ${card0.title || '作品'}\n\n同一张作曲卡写出的两首，都过了「内心听觉」自检（没有不及格项）。先别看计算记录，只听：\n\n- 候选A/音频.m4a\n- 候选B/音频.m4a\n\n听完在下面写一句：选哪首、为什么（哪一处好听或难听）。这些记录攒多了，就是这台程序唯一来自人耳的品味数据。\n\n| 日期 | 选了 | 为什么 |\n|---|---|---|\n|  |  |  |\n`);
} else results.push(await composeOne(card0, outBase, {}));
console.log(JSON.stringify(results.length === 1 ? results[0] : results, null, 1));

function base0(card) { if (card.seed != null) return card.seed; if (!SEED.has(card)) SEED.set(card, Math.floor(Math.random() * 99999) + 1); return SEED.get(card); }
async function composeOne(card, out, { motifSeed }) {
  fs.mkdirSync(out, { recursive: true });
  setSoundMode(card.sound || 'best');
  const dimsMode = !!(card.preset || card.dims || card.ensemble);
  const style = dimsMode ? null : STYLES.find(s => s.id === card.style);
  if (!dimsMode && !style) throw new Error(`没有这个风格：${card.style}。用 --list 查看（经典配方写 "style"，组合预设写 "preset"）`);
  const warnings = [];

  // ---- 声部与乐器 ----
  let roleDefs, probeNotes = null;
  if (dimsMode) {
    const probe = composeDims(card, base0(card), { motifSeed }); roleDefs = probe.roles; probeNotes = probe.notes; // 用真实写出来的音区做预检，比按乐器标称音区准
  } else {
    roleDefs = Object.fromEntries(Object.entries(style.roles).map(([r, x]) => [r, { name: x.name, inst: card.instruments?.[r] || x.inst }]));
    for (const r of Object.keys(card.instruments || {})) if (!style.roles[r]) throw new Error(`风格 ${style.id} 没有声部 ${r}，可用：${Object.keys(style.roles).join(', ')}`);
  }
  const ids = Object.keys(roleDefs);
  const mix = Object.fromEntries(ids.map((r, i) => [r, { inst: roleDefs[r].inst, mute: !!card.mute?.includes(r), pan: ids.length > 1 ? -0.35 + 0.7 * i / (ids.length - 1) : 0 }]));
  for (const m of Object.values(mix)) if (!INSTRUMENTS[m.inst]) throw new Error('不认识的乐器：' + m.inst);
  // 搭配预检：生成前就告诉用户哪两件乐器可能打架
  for (const x of ensembleIssues(Object.fromEntries(ids.filter(r => !mix[r].mute).map(r => [r, mix[r].inst])), probeNotes)) { const w = `乐器搭配${x.level === 'fail' ? '不合适' : '有风险'}：${x.why}`; if (!warnings.includes(w)) warnings.push(w); }
  if (card.sound === 'publish' && !soundfont()) warnings.push('publish 模式要用可公开发布的音色库，但 ~/.cache/compose-skill/soundfonts/ 里没有 .sf2 文件；这一版仍用了本机自用音色，不能公开发布');
  warnings.forEach(w => console.error('⚠ ' + w));

  // ---- 1 · 多写几首，用乐谱层自检打分，留最好的 ----
  function prepare(seed) {
    let piece, key, shift = 0; const fit = {};
    if (dimsMode) { piece = composeDims(card, seed, { motifSeed }); key = parseKey(piece.key); }
    else {
      piece = style.gen(seed); key = parseKey(piece.key);
      if (card.key && KEY_INPUT[card.key] != null) { shift = shiftTo(key.pc, KEY_INPUT[card.key]); key = { ...key, pc: KEY_INPUT[card.key] }; }
      for (const r of ids) { const inst = mix[r].inst; if (INSTRUMENTS[inst].drum) { fit[r] = 0; continue; } fit[r] = fitOctave(piece.notes.filter(n => n.role === r).map(n => n.p + shift), INSTRUMENTS[inst].range).oct; }
      piece.notes = piece.notes.map(n => INSTRUMENTS[mix[n.role].inst].drum ? n : { ...n, p: n.p + shift + fit[n.role] * 12 });
    }
    const live = ids.filter(r => !mix[r].mute);
    const audit = auditScore({ notes: piece.notes.filter(n => !mix[n.role].mute), meter: piece.meter }, { style: dimsMode ? null : style.id, strict: piece.strict, roles: Object.fromEntries(live.map(r => [r, roleDefs[r]])), mix: Object.fromEntries(live.map(r => [r, mix[r].inst])), tonicPc: key.pc, melodyRoles: piece.melodyRoles, scale: piece.scale, era: dimsMode ? piece.meta.era : ERA[style.era] });
    return { seed, piece, key, shift, fit, audit };
  }
  const base = base0(card), tries = Math.max(1, card.tries ?? 8);
  const cands = []; for (let i = 0; i < tries; i++) cands.push(prepare(base + i));
  // 2026-11-06 改：不再按自检分挑最高的（分数只抓错，最高分往往是一次意外都没有的那首，最平淡）。
  // 没有不及格项 = 过线；过线的按种子顺序取第一首。abPick = 1 取第二首过线的（盲听用的候选 B）。全都不过线才退回取分最高的。
  const passed = cands.filter(c => !c.audit.items.some(x => x.level === 'fail'));
  const best = passed[card.abPick || 0] || (card.abPick ? cands.find(c => c !== passed[0]) : null) || passed[0] || cands.slice().sort((a, b) => b.audit.score - a.audit.score)[0], { piece, key } = best;
  const pickNote = passed.length ? `${tries} 首里有 ${passed.length} 首没有不及格项（过线）；过线的不再比分数，按种子顺序取${card.abPick ? `第 ${card.abPick + 1} 首（盲听候选 ${'AB'[card.abPick] || card.abPick + 1}）` : '第一首'}` : `${tries} 首都有不及格项，只好取自检分最高的一首`;

  // ---- 2 · 时间：拍 → 秒 ----
  const speed = !dimsMode && card.bpm ? card.bpm / piece.bpm : 1;
  const sec = b => (piece.time ? piece.time(b) : b * 60 / piece.bpm) / speed;
  let tl = piece.notes.map(n => ({ ...n, s: sec(n.t), e: sec(n.t + n.d) }));
  const barBeats = barBeatsOf(piece.meter), lenNote = [];
  let auditSpan = null;
  if (card.repeat > 1) {
    const B = Math.ceil(Math.max(...tl.map(n => n.t + n.d)) / barBeats - 1e-6) * barBeats, S = sec(B), one = tl.slice();
    for (let k = 1; k < card.repeat; k++) tl.push(...one.map(n => ({ ...n, t: n.t + B * k, s: n.s + S * k, e: n.e + S * k })));
    auditSpan = B; lenNote.push(`整首重复 ${card.repeat} 遍（自检只查第一遍）`);
  }
  if (card.maxSeconds && !dimsMode) {
    const cut = phraseCut(tl, card.maxSeconds, barBeats, key.pc, sec, ids, roleDefs);
    if (cut) { tl = cut.tl; lenNote.push(cut.note); }
  }
  const title = card.title || (dimsMode ? `${piece.meta.name}（种子 ${best.seed}）` : `${style.name}（种子 ${best.seed}）`);
  const composer = dimsMode ? `compose-skill · ${piece.meta.era}${piece.meta.name} · 种子 ${best.seed}` : `compose-skill · ${ERA[style.era]}${style.name}配方 · 种子 ${best.seed}`;

  // 小样模式（发散阶段用）：只渲前 N 秒音频，不出谱
  if (card.sketch) {
    const lim = card.sketchSeconds || 20, cutN = tl.filter(n => n.s < lim).map(n => ({ p: n.p, s: n.s, e: Math.min(n.e, lim + 1.5), v: n.v, role: n.role }));
    const f = path.join(out, (card.name || card.preset || style.id) + '-小样.m4a');
    renderAudio(cutN, Object.fromEntries(ids.map(r => [r, { ...mix[r], vol: card.volume?.[r] ?? 1 }])), f);
    return { sketch: f, seed: best.seed, key: keyLabel(key), instruments: Object.fromEntries(ids.map(r => [r, mix[r].inst])), scoreAudit: best.audit.score, warn: best.audit.items.filter(x => x.level !== 'pass' && x.level !== 'info').map(x => x.name), warnings };
  }

  // ---- 3 · 组装作品，出全部产物 ----
  const work = {
    title, composer, style: dimsMode ? 'dims:' + (piece.meta.preset || 'custom') : style.id, strict: piece.strict, era: dimsMode ? piece.meta.era : ERA[style.era], key, meter: piece.meter, bpm: card.bpm || piece.bpm,
    roles: Object.fromEntries(ids.map(r => [r, { name: roleDefs[r].name, inst: mix[r].inst, mute: mix[r].mute, vol: card.volume?.[r] ?? 1, pan: mix[r].pan }])),
    notes: tl.map(n => ({ p: n.p, t: n.t, d: n.d, v: n.v, role: n.role, s: +n.s.toFixed(4), e: +n.e.toFixed(4) })),
    jianpu: card.jianpu ?? null, auditSpan, melodyRoles: piece.melodyRoles, scale: piece.scale,
  };
  const res = await produce(work, out);

  const recipe = dimsMode ? piece.recipe : style.recipe, steps = piece.steps;
  const lines = [`# 计算记录 · ${title}`, '',
    dimsMode ? `- 组合配方：${piece.meta.era} · ${piece.meta.name}（参考 ${piece.meta.who}）${card.dims ? `；作曲卡改了这些维度：${Object.entries(card.dims).map(([k, v]) => `${k}=${v}`).join('，')}` : ''}` : `- 配方：${ERA[style.era]} · ${style.name}（参考 ${style.who}）`,
    `- 这种风格听起来：${dimsMode ? piece.meta.sound : style.sound}`,
    `- 调：${keyLabel(key)}${best.shift ? `（生成器原本写在别的调上，整体移了 ${best.shift > 0 ? '+' : ''}${best.shift} 个半音，到作曲卡要的调）` : ''}　拍号：${piece.meter}　速度：♩≈${Math.round(work.bpm)}`,
    ...(lenNote.length ? [`- 长度：${lenNote.join('；')}`] : []),
    `- 乐器：${ids.map(r => `${roleDefs[r].name}=${INSTRUMENTS[mix[r].inst].name}${best.fit[r] ? `（整体移 ${best.fit[r] > 0 ? '+' : ''}${best.fit[r]} 个八度以放进音域）` : ''}${mix[r].mute ? '（静音）' : ''}`).join('，')}`,
    ...(warnings.length ? ['', '## ⚠ 生成前的提醒', '', ...warnings.map(w => `- ${w}`)] : []),
    '', '## 配方（规则）', '', ...recipe.map((x, i) => `${i + 1}. ${x}`), '', '## 这一首每一步是怎么算的', '',
    ...(best.shift ? [`（下面是生成器在原调上的记录；最后整体移了 ${best.shift > 0 ? '+' : ''}${best.shift} 个半音到 ${keyLabel(key)}）`, ''] : []),
    ...steps.map(x => `- ${x.replace(/<br>/g, '\n  ').replace(/<\/?b>/g, '**')}`),
    '', `## 写了 ${tries} 首，怎么挑的`, '', pickNote + '。自检分只能说明有没有明显的错，分高不等于好听，最后一关是人耳。', '', '| 种子 | 乐谱自检分 | 过线 | 挑中 |', '|---|---|---|---|', ...cands.map(c => `| ${c.seed} | ${c.audit.score} | ${passed.includes(c) ? '✓' : '✗'} | ${c === best ? '✓' : ''} |`),
    '', `时长约 ${res.seconds} 秒，${work.notes.length} 个音。`, '', '## 音色来源', '', ...soundReport(ids.map(r => mix[r].inst)).map(x => `- ${x}`),
    '', '后期修改（换乐器、静音、音量、速度、移调、导入改过的 MIDI）：见 skill 的 references/editing.md，用 `node edit.mjs <本目录> ...`。'];
  fs.writeFileSync(path.join(out, '计算记录.md'), lines.join('\n') + '\n');
  // 不覆盖用户的作曲卡：把这次实际用的卡（含挑中的种子）另存一份，以后想复现就用它
  fs.writeFileSync(path.join(out, '作曲卡-本次.json'), JSON.stringify({ ...card, seed: best.seed, tries: 1, _note: '这是本次实际用的卡（seed = 挑中的种子，tries = 1 可原样复现）。想重新挑，就改回原作曲卡' }, null, 2));
  const fails = [...res.sym.items, ...res.aud.items].filter(x => x.level === 'fail').map(x => x.name);
  return { name: card.name, out, seed: best.seed, key: keyLabel(key), seconds: res.seconds, notes: work.notes.length, scoreAudit: res.sym.score, fails, warnings, desc: dimsMode ? piece.meta.name : style.name, motif: dimsMode ? piece.meta.motifUsed : null, files: [...res.files, '计算记录.md', '作曲卡-本次.json'] };
}

// 按秒数截短：截在「乐句结尾」——旋律落在主和弦音上的长音、最好是四小节的整数倍——再把最后两小节放慢
function phraseCut(tl, limit, barBeats, tonicPc, sec, ids, roleDefs) {
  const lastT = Math.max(...tl.map(n => n.t));
  const avg = r => { const ps = tl.filter(n => n.role === r).map(n => n.p); return ps.reduce((a, b) => a + b, 0) / (ps.length || 1); };
  const top = ids.filter(r => !INSTRUMENTS[roleDefs[r].inst].drum).sort((a, b) => avg(b) - avg(a))[0];
  const pc = p => ((p % 12) + 12) % 12, cands = [];
  for (let B = barBeats; B <= lastT + 1e-6 && sec(B) <= limit + 1e-6; B += barBeats) {
    const m = tl.filter(n => n.role === top && n.t < B && n.t + n.d >= B - 1e-6).pop() || tl.filter(n => n.role === top && n.t < B).pop();
    let score = 0; if (m) { const iv = pc(m.p - tonicPc); if (iv === 0) score += 3; else if ([3, 4, 7].includes(iv)) score += 2; if (m.d >= 1) score += 1; }
    if ((B / barBeats) % 4 === 0) score += 1;
    cands.push({ B, score });
  }
  if (!cands.length || sec(lastT) <= limit) return null;
  const S = sec(cands[cands.length - 1].B), good = cands.filter(c => sec(c.B) >= S * 0.7).sort((a, b) => b.score - a.score || b.B - a.B)[0];
  const B = good.B, S0 = sec(Math.max(0, B - 2 * barBeats)), S1 = sec(B), slow = x => (x > S0 ? x + 0.3 * (x - S0) ** 2 / (2 * Math.max(0.1, S1 - S0)) : x);
  const kept = tl.filter(n => n.t < B - 1e-6).map(n => { const d = Math.min(n.d, B - n.t), e = Math.min(n.e, S1); return { ...n, d, s: slow(n.s), e: slow(e) }; });
  const endS = slow(S1); kept.forEach(n => { if (n.t + n.d >= B - barBeats - 1e-6) n.e = Math.max(n.e, endS + 0.8); });
  const ok = good.score >= 4;
  return { tl: kept, note: `截到第 ${B / barBeats} 小节（约 ${Math.round(endS)} 秒）：挑的是乐句结尾${ok ? '（旋律落在主和弦音的长音上）' : '（附近没有完美的终止，挑了最接近的一处，结尾可能不完全落回主音）'}，最后两小节渐慢` };
}
