// 「内心听觉」自检：不用耳朵，只检查那些已知会让人听着别扭的东西。
// 乐谱层（生成后立刻能算，用来在多首里挑最好的）+ 音频层（渲染后再查）。
// 每一项给出：数值、是否通过、给普通人看的一句话解释。阈值是经验值，见 references/inner-ear.md。
import fs from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { INSTRUMENTS } from './theory.mjs';
import { ensembleIssues } from './orch.mjs';

export const barBeatsOf = m => m.startsWith('3/4') ? 3 : m.startsWith('12/8') ? 12 : m.startsWith('6/8') ? 6 : m.startsWith('2/4') ? 2 : 4;
const DISS = new Set([1, 2, 6, 10, 11]);
// 三度叠置的和弦（三和弦、七和弦）：同时响的音能排成其中一个，就不算「打架」。
// 2026-11-06 改：原来七和弦里那对隔 2 / 10 个半音的音一律判打架，把巴赫 C 大调前奏曲（35 小节里 19 小节是七和弦）判成 54% 刺耳、不及格。
const TERTIAN = [[0, 4, 7], [0, 3, 7], [0, 3, 6], [0, 4, 8], [0, 4, 7, 10], [0, 4, 7, 11], [0, 3, 7, 10], [0, 3, 6, 10], [0, 3, 6, 9]];
export function isHarsh(ps) {
  if (ps.length >= 3) for (const root of ps) { const rel = [...new Set(ps.map(x => pc(x - root)))]; if (rel.length >= 3 && TERTIAN.some(t => rel.every(x => t.includes(x)))) return false; }
  for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) if (DISS.has(pc(ps[j] - ps[i]))) return true;
  return false;
}
// 时代阈值：从公有领域曲谱库里量出来的（scripts/corpus_stats.mjs → references/corpus-thresholds.json），没有就退回教材默认值
let ERA_LIMITS = {};
try { ERA_LIMITS = JSON.parse(fs.readFileSync(new URL('../../references/corpus-thresholds.json', import.meta.url), 'utf8')).eras || {}; } catch { /* 没量过就用默认值 */ }
export const eraKey = era => (!era ? null : /巴洛克/.test(era) ? '巴洛克' : /古典/.test(era) ? '古典' : /浪漫|民族乐派/.test(era) ? '浪漫' : /印象/.test(era) ? '印象派' : null);
export const eraLimits = era => ERA_LIMITS[eraKey(era)] || null;
const pc = p => ((p % 12) + 12) % 12;
const STRICT = { canon: 'strict', sequence: 'strict', dice: 'strict', period: 'strict', motif: 'mid', nocturne: 'mid', debussy: 'free', satie: 'free', blues: 'free', jazz: 'free', chorale: 'strict', variations: 'mid', rondo: 'strict', waltz: 'mid', lied: 'mid', bolero: 'mid', minimal: 'free', sizhu: 'mid' };

export function auditScore(piece, { style, strict: strictIn, roles, mix, tonicPc, melodyRoles, scale, era }) {
  const strict = strictIn || STRICT[style] || 'mid', EL = strict === 'free' ? null : eraLimits(era);
  const pitched = piece.notes.filter(n => !INSTRUMENTS[mix[n.role]]?.drum);
  const items = [];
  const add = (name, value, level, plain) => items.push({ name, value, level, plain });
  const last = Math.max(...pitched.map(n => n.t + n.d));
  const sounding = t => pitched.filter(n => n.t <= t + 1e-6 && n.t + n.d > t + 1e-6);

  // 1 · 强拍上的刺耳程度
  let beats = 0, harsh = 0;
  for (let t = 0; t < last; t += 1) {
    const ps = [...new Set(sounding(t).map(n => pc(n.p)))]; if (ps.length < 2) continue; beats++;
    if (isHarsh(ps)) harsh++;
  }
  const hr = beats ? harsh / beats : 0, lim = EL ? Math.max({ strict: 0.15, mid: 0.3, free: 1 }[strict], EL.harsh) : { strict: 0.15, mid: 0.3, free: 1 }[strict];
  add('强拍刺耳率', `${(hr * 100).toFixed(0)}%`, strict === 'free' ? 'info' : hr <= lim ? 'pass' : hr <= lim * 1.6 ? 'warn' : 'fail',
    strict === 'free' ? '这种风格本来就大量用带摩擦的和弦（七和弦、全音阶），只记录不判分' : `每个拍点上同时响的音里，有「打架」音程、又排不成三和弦或七和弦的拍子占比。上限 ${Math.round(lim * 100)}%${EL ? `（按${eraKey(era)}时代 ${EL.n} 首真曲子量出来的第 90 百分位）` : '（教材默认值：巴洛克、古典最严，浪漫放宽）'}，超了听着脏`);

  // 2 · 平行五度 / 八度（最高声部 vs 最低声部）
  const roleIds = Object.keys(roles).filter(r => !INSTRUMENTS[mix[r]]?.drum);
  const avg = r => { const ps = pitched.filter(n => n.role === r).map(n => n.p); return ps.reduce((a, b) => a + b, 0) / (ps.length || 1); };
  const sortedRoles = roleIds.slice().sort((a, b) => avg(b) - avg(a));
  // 主旋律：组合配方会告诉我们哪几个声部是主旋律（不然最高的点缀乐器会被误当成旋律）
  const melRoles = (melodyRoles || []).filter(r => roleIds.includes(r));
  const top = melRoles.length ? melRoles.slice().sort((a, b) => avg(b) - avg(a))[0] : sortedRoles[0], bot = sortedRoles[sortedRoles.length - 1];
  let par = 0;
  if (top !== bot) {
    const at = (r, t) => { const s = sounding(t).filter(n => n.role === r); return s.length ? Math.max(...s.map(n => n.p)) : null; };
    let prev = null;
    for (let t = 0; t < last; t += 1) {
      const a = at(top, t), b = at(bot, t); if (a == null || b == null) { prev = null; continue; }
      const iv = pc(a - b);
      if (prev && (iv === 0 || iv === 7) && prev.iv === iv && (prev.a !== a || prev.b !== b) && Math.sign(a - prev.a) === Math.sign(b - prev.b)) par++;
      prev = { a, b, iv };
    }
  }
  add('外声部平行五/八度', par, strict === 'free' ? 'info' : par <= 2 ? 'pass' : par <= 5 ? 'warn' : 'fail', '最高和最低两个声部连着走同样的五度或八度，两条线会听成一条、显得空。巴赫时代的规则明令禁止；印象派、爵士故意用');

  // 3 · 音域：乐器吹/拉得到吗
  for (const r of roleIds) {
    const inst = mix[r], rg = INSTRUMENTS[inst]?.range; if (!rg) continue;
    const ns = pitched.filter(n => n.role === r), out = ns.filter(n => n.p < rg[0] || n.p > rg[1]).length;
    if (out) add(`音域 · ${roles[r].name}（${INSTRUMENTS[inst].name}）`, `${out}/${ns.length} 个音超出`, out / ns.length > 0.05 ? 'fail' : 'warn', `${INSTRUMENTS[inst].name}实际能演奏的范围是 MIDI ${rg[0]}–${rg[1]}，超出的音真人演奏不了`);
  }
  if (!items.some(x => x.name.startsWith('音域'))) add('音域', '全部在乐器范围内', 'pass', '每个声部的音都在对应乐器真实能演奏的范围里');

  // 3b · 乐器搭配：同时响的两件乐器会不会糊成一片（编制三条：一个唱一个托；高中低分层；音色有反差）
  const pairs = ensembleIssues(Object.fromEntries(roleIds.map(r => [r, mix[r]])), pitched);
  if (!pairs.length) add('乐器搭配', roleIds.length > 1 ? '没有发现打架的组合' : '只有一件乐器', 'pass', '同时响的乐器有没有挤在同一音区、音色太像或者都太刺耳。规则见 references/instruments.md 的编制三条');
  else for (const x of pairs) add(`乐器搭配 · ${roles[x.roles[0]].name} + ${roles[x.roles[1]].name}`, `${INSTRUMENTS[x.insts[0]].name} + ${INSTRUMENTS[x.insts[1]].name}`, x.level, x.why);

  // 4 · 旋律好不好唱（取最高声部，每个时刻只取最高音）
  const mel = []; { const by = new Map(); for (const n of pitched.filter(n => melRoles.length ? melRoles.includes(n.role) : n.role === top)) { const k = Math.round(n.t * 4); if (!by.has(k) || by.get(k).p < n.p) by.set(k, n); } [...by.values()].sort((a, b) => a.t - b.t).forEach(n => mel.push(n)); }
  const ivs = mel.slice(1).map((n, i) => n.p - mel[i].p);
  const leaps = ivs.filter(x => Math.abs(x) > 7).length, stepMax = ['penta', 'blues'].includes(scale) ? 3 : 2, steps = ivs.filter(x => Math.abs(x) >= 1 && Math.abs(x) <= stepMax).length, maxLeap = Math.max(0, ...ivs.map(Math.abs));
  const lr = ivs.length ? leaps / ivs.length : 0, sr = ivs.length ? steps / ivs.length : 0;
  // 分解和弦织体（巴赫 C 大调前奏曲那种，最高声部一直在和弦音之间跳）：没有「旋律」可判，旋律三项只记录
  const arpShare = ivs.length ? ivs.filter(x => Math.abs(x) >= 3 && Math.abs(x) <= 9).length / ivs.length : 0, arpTexture = arpShare >= 0.6 && sr < 0.25;
  const leapLim = EL ? EL.leap : 0.15, stepMin = EL ? EL.step : 0.35, spanLo = EL ? Math.min(9, EL.spanLo) : 9, spanHi = EL ? EL.spanHi : 24, src = EL ? `（按${eraKey(era)}时代 ${EL.n} 首真曲子量出来）` : '';
  add('旋律 · 大跳比例', `${(lr * 100).toFixed(0)}%（最大 ${maxLeap} 个半音）`, lr <= leapLim && (EL || maxLeap <= 12) ? 'pass' : lr <= leapLim * 2 ? 'warn' : 'fail', `相邻两个音跳超过五度的比例，上限 ${Math.round(leapLim * 100)}%${src}。跳太多太远会显得乱、不好记`);
  add('旋律 · 级进比例', `${(sr * 100).toFixed(0)}%`, sr >= stepMin ? 'pass' : sr >= stepMin * 0.6 ? 'warn' : 'fail', stepMax === 3 ? '相邻两个音在五声 / 布鲁斯音阶里只差一级（小三度也算一级）的比例。好唱的旋律里这种走法通常占三四成以上' : '相邻两个音只差一两级（像走楼梯）的比例。好唱的旋律里这种走法通常占三四成以上');
  const span = mel.length ? Math.max(...mel.map(n => n.p)) - Math.min(...mel.map(n => n.p)) : 0;
  add('旋律 · 音域跨度', `${span} 个半音`, span >= spanLo && span <= spanHi ? 'pass' : 'warn', `整条旋律从最低到最高的距离，${spanLo}–${spanHi} 个半音${src || '（教材默认：按一个人能唱的旋律定）'}。太窄显得单调，太宽散`);

  // 5 · 重复与变化：有没有「记得住的东西」
  const grams = new Map(); for (let i = 0; i + 3 < ivs.length; i++) { const k = ivs.slice(i, i + 3).join(','); grams.set(k, (grams.get(k) || 0) + 1); }
  const total = Math.max(1, ivs.length - 2), rep = [...grams.values()].filter(v => v > 1).reduce((a, b) => a + b, 0) / total;
  add('重复与变化', `${(rep * 100).toFixed(0)}% 的小片段出现过不止一次`, rep >= 0.15 && rep <= 0.8 ? 'pass' : 'warn', rep < 0.15 ? '几乎没有重复的小片段：耳朵抓不到可以记住的东西，容易听成「随机乱弹」' : rep > 0.8 ? '重复太多：听两遍就腻' : '有重复（让耳朵认出来），也有变化（不至于腻），比例健康');

  // 6 · 节奏
  const durs = new Set(mel.map(n => Math.round(n.d * 4)));
  add('节奏变化', `${durs.size} 种时值`, durs.size >= 2 ? 'pass' : 'warn', '旋律里长短音的种类。只有一种时值会像机器在打点');

  // 7 · 有没有「回家」
  if (strict !== 'free') {
    const endT = Math.max(...pitched.map(n => n.t)); const fin = pitched.filter(n => Math.abs(n.t - endT) < 0.01 || (n.t <= endT && n.t + n.d >= endT + 0.01));
    const ok = fin.some(n => pc(n.p) === tonicPc) && (mel.length ? [0, 4, 3, 7].includes(pc(mel[mel.length - 1].p - tonicPc)) : true);
    add('结尾回到主音', ok ? '是' : '否', ok ? 'pass' : 'warn', '最后一个和弦里有没有主音、旋律是不是停在主和弦的音上。没有的话听着像话没说完');
  } else add('结尾回到主音', '不要求', 'info', '印象派、爵士常故意不回家，留一个飘着的结尾');

  // 8 · 张力曲线：有没有起伏
  const barLen = barBeatsOf(piece.meter), nb = Math.ceil(last / barLen), ten = [];
  for (let b = 0; b < nb; b++) { const ns = pitched.filter(n => n.t >= b * barLen && n.t < (b + 1) * barLen); ten.push(ns.length ? ns.length / barLen * (ns.reduce((a, n) => a + (n.v ?? 0.7), 0) / ns.length) : 0); }
  const mean = ten.reduce((a, b) => a + b, 0) / ten.length, sd = Math.sqrt(ten.reduce((a, b) => a + (b - mean) ** 2, 0) / ten.length), cv = mean ? sd / mean : 0;
  const peak = ten.indexOf(Math.max(...ten)) / Math.max(1, nb - 1);
  add('张力起伏', `起伏系数 ${cv.toFixed(2)}，最高点在全曲 ${(peak * 100).toFixed(0)}% 处`, cv >= 0.15 ? 'pass' : 'warn', '每小节「音多不多、力度大不大」画成一条曲线。太平说明从头到尾一个劲；很多好曲子的高潮在三分之二附近');

  if (arpTexture) items.forEach(x => { if (x.name.startsWith('旋律')) { x.level = 'info'; x.plain = `最高声部 ${Math.round(arpShare * 100)}% 的进行是在和弦音之间跳（分解和弦织体），没有可唱的旋律，这一项只记录。` + x.plain; } });
  // 印象派、极简、爵士这类风格，旋律本来就常用分解和弦和大跳：旋律项最多只给警告
  if (strict === 'free') items.forEach(x => { if (x.name.startsWith('旋律') && x.level === 'fail') x.level = 'warn'; });
  const score = items.reduce((a, x) => a + ({ pass: 2, warn: 0, fail: -4, info: 0 }[x.level]), 0);
  return { items, score, tension: ten };
}

// 音频层：渲染出的声音本身有没有问题（爆音、太闷、太刺、中间断掉）
export function auditAudio(file) {
  const items = [], add = (name, value, level, plain) => items.push({ name, value, level, plain });
  const run = args => { const r = spawnSync('ffmpeg', ['-hide_banner', '-nostats', ...args], { encoding: 'utf8', maxBuffer: 1 << 26 }); return (r.stderr || '') + (r.stdout || ''); };
  const vol = af => { const o = run(['-i', file, '-af', af + 'volumedetect', '-f', 'null', '-']) + ''; const m = o.match(/mean_volume: (-?[\d.]+)/), x = o.match(/max_volume: (-?[\d.]+)/); return { mean: m ? +m[1] : -99, max: x ? +x[1] : -99 }; };
  const all = vol(''), lo = vol('lowpass=f=250,'), mid = vol('highpass=f=250,lowpass=f=4000,'), hi = vol('highpass=f=4000,');
  add('峰值', `${all.max} dBFS`, all.max <= -0.5 ? 'pass' : 'fail', '最响的一瞬间离 0 有多远。贴着 0 就会爆音');
  add('低频 vs 中频', `${(lo.mean - mid.mean).toFixed(1)} dB`, lo.mean - mid.mean < 8 ? 'pass' : 'warn', '低音能量比中音高太多会听着闷、糊');
  add('高频 vs 中频', `${(hi.mean - mid.mean).toFixed(1)} dB`, hi.mean - mid.mean < 0 ? 'pass' : 'warn', '高音能量超过中音会听着刺耳、累');
  // 只算「静下来之后又响起来」的空白；结尾余音散掉后的安静不算
  const log = run(['-i', file, '-af', 'silencedetect=n=-45dB:d=2', '-f', 'null', '-']);
  const starts = [...log.matchAll(/silence_start: ([\d.]+)/g)].map(m => +m[1]), ends = [...log.matchAll(/silence_end: ([\d.]+)/g)].map(m => +m[1]);
  const dur = +execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]).toString();
  const mids = starts.filter((s, i) => s > 0.5 && ends[i] != null && ends[i] < dur - 0.5);
  add('中途断声', mids.length ? `${mids.length} 处超过 2 秒的空白` : '没有', mids.length ? 'warn' : 'pass', '曲子中间超过 2 秒完全没声音，通常是生成出了问题（也可能是故意的休止）');
  return { items };
}

export function auditMarkdown(title, sym, aud) {
  const icon = { pass: '✓', warn: '△', fail: '✗', info: '·' };
  const rows = xs => xs.map(x => `| ${icon[x.level]} | ${x.name} | ${x.value} | ${x.plain} |`).join('\n');
  return `# 内心听觉自检 · ${title}\n\n> 写曲子的 AI 听不见声音。下面这些检查代替耳朵，抓的是「已知会让人听着别扭」的东西；它们能发现错，不能证明好听。最后一关是人的耳朵。\n\n## 乐谱层\n\n| | 检查 | 结果 | 这是在查什么 |\n|---|---|---|---|\n${rows(sym.items)}\n\n乐谱层总分：${sym.score}\n\n${aud ? `## 音频层\n\n| | 检查 | 结果 | 这是在查什么 |\n|---|---|---|---|\n${rows(aud.items)}\n` : ''}`;
}
