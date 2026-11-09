// 维度引擎：作曲卡（预设 + 改动的维度 + 编制 + 时长 / 切点）→ 一首曲子。
// 顺序：曲式规划 → 每段的调和和弦 → 动机长成旋律 → 各声部音型 → 配器（分层、交接、惯用法、音区）→ 结尾和速度
import { INSTRUMENTS, KEY_INPUT } from '../theory.mjs';
import { ensembleIssues, profile } from '../orch.mjs';
import { subRNG, pick, pcOf, NAMES, SCALES, barBeats, roman, nm } from './core.mjs';
import { HARMONY, progression } from './harmony.mjs';
import { FORMS, PROCESS, planForm } from './form.mjs';
import { makeMotif, sectionMelody, bluesMelody } from './melody.mjs';
import { ACCOMP, BASS, DRUMS, counterLine, colorLine, glissLine, hitsLine, drumLine } from './texture.mjs';
import { FN, expandEnsemble, idiomPattern, activeRoles, fitRegister, applyIdiom, separate, applyOctaveHints } from './orchestrate.mjs';
import { PRESET } from './presets.mjs';

const MODE_NAME = { major: '大调', minor: '小调', dorian: '多利亚调式', lydian: '利底亚调式', mixolydian: '混合利底亚调式', penta: '五声（宫调）', blues: '布鲁斯音阶', harmonic: '和声小调' };
const harmMode = m => (['minor', 'dorian', 'harmonic'].includes(m) ? 'minor' : 'major');

// 把作曲卡和预设合成一份完整的「维度表」
export function resolveCard(card) {
  const pre = card.preset ? PRESET[card.preset] : null;
  if (card.preset && !pre) throw new Error(`没有这个组合预设：${card.preset}。用 --list 查看`);
  const base = pre || {};
  const dims = { ...(base.dims || {}), ...(card.dims || {}) };
  const ensemble = card.ensemble ? { ...card.ensemble } : JSON.parse(JSON.stringify(base.ensemble || { melody: ['piano'], accomp: ['piano'] }));
  return {
    pre, dims, ensemble, meter: card.meter || base.meter || '4/4', bpm: card.bpm || base.bpm || 100, mode: card.mode || base.mode || 'major',
    groove: card.groove || base.groove || 'straight', strict: card.strict || base.strict || 'mid',
    name: pre ? pre.name : '自定义组合', era: pre ? pre.era : '组合', who: pre ? pre.who : '—', sound: pre ? pre.sound : '按作曲卡里的维度拼出来的组合',
  };
}

export function composeDims(card, seed, { motifSeed } = {}) {
  const C = resolveCard(card), { dims: D, meter, bpm, mode } = C, B = barBeats(meter), steps = [];
  const rForm = subRNG(seed, 'harmony'), rMel = subRNG(seed, 'melody');
  const mSeed = motifSeed ?? card.motifSeed ?? seed;
  const tonic = card.key != null && KEY_INPUT[card.key] != null ? KEY_INPUT[card.key] : C.pre?.key != null ? KEY_INPUT[C.pre.key] : pick(subRNG(seed, 'key'), [0, 2, 5, 7, 9, 10]);

  // 1 · 编制（作曲卡的 instruments 可以按声部名换乐器，比如 {"melody1": "erhu"}）
  const roles = expandEnsemble(C.ensemble);
  for (const [rid, inst] of Object.entries(card.instruments || {})) { const r = roles.find(x => x.id === rid); if (!r) throw new Error(`没有声部 ${rid}，可用：${roles.map(x => x.id).join(', ')}`); if (!INSTRUMENTS[inst]) throw new Error('不认识的乐器：' + inst); r.inst = inst; }
  const staticIssues = ensembleIssues(Object.fromEntries(roles.map(r => [r.id, r.inst])));

  // 2 · 曲式规划
  const plan = planForm({ form: D.form, seconds: card.seconds ?? card.maxSeconds ?? 45, bpm, meter, cues: card.cues, process: D.process, unit: D.form === 'blues' ? 12 : 4 });
  const secTonal = sec => {
    if (sec.modeShift === 'relative') return harmMode(mode) === 'major' ? { tonic: pcOf(tonic + 9), mode: 'minor' } : { tonic: pcOf(tonic + 3), mode: 'major' };
    if (sec.modeShift === 'parallel') return { tonic, mode: harmMode(mode) === 'major' ? 'minor' : 'major' };
    if (harmMode(mode) === 'minor' && sec.key === 7) return { tonic: pcOf(tonic + 3), mode: 'major' };
    return { tonic: pcOf(tonic + sec.key), mode };
  };
  steps.push(`曲式：<b>${plan.form.name}</b>（${plan.form.plain}）。能量曲线：${plan.process.name}（${plan.process.plain}）`);

  // 3 · 和声
  const chords = [], harmCache = {};
  // 故意的意外（dims.surprise，可写一个或几个）：规则之外，在听众已经有预期的地方偏一下
  //   deceptive 假终止：倒数第二个「落地」处，该回主和弦时拐到六级和弦，听众以为结束了，曲子还要往前走
  //   suspension 挂留：最后一个落地的音，先停在上方邻音上晚一拍，再落下来
  //   picardy 皮卡迪三度：小调曲子的最后一个和弦换成大三和弦，暗了一路，最后一下亮起来
  const surprise = [].concat(D.surprise || []);
  let decIdx = -1;
  if (surprise.includes('deceptive') && plan.secs.length > 1) { for (let i = plan.secs.length - 2; i >= 0; i--) if (plan.secs[i].cad === 'full') { decIdx = i; break; } if (decIdx < 0) decIdx = plan.secs.length - 2; }
  plan.secs.forEach((sec, i) => {
    const tn = secTonal(sec); sec.tonic = tn.tonic; sec.mode = tn.mode;
    let cad = sec.cad; if (i === plan.secs.length - 1) cad = 'full';
    // 同一段素材（A 和 A'）再出现：和声也沿用前面的，不然旋律对齐到不同的和弦上就变样、认不出「回来了」
    const mb = sec.mat.replace(/'/g, ''), hc = harmCache[mb], opts = { beatsPerBar: B, mode: harmMode(tn.mode), rate: D.harmonyRate ?? 1, strict: C.strict };
    let prog;
    if (hc && hc.key === sec.key && hc.bars <= sec.bars && sec.bars - hc.bars !== 1) {
      prog = hc.prog.map(c => ({ ...c })); const rest = sec.bars - hc.bars;
      if (rest > 0) prog.push(...progression(rForm, D.harmony, { ...opts, bars: rest, cad }).map(c => ({ ...c, t: c.t + hc.bars * B })));
      else if (cad === 'full' && prog.length >= 2) { prog[prog.length - 1] = { ...prog[prog.length - 1], deg: 0, q: harmMode(tn.mode) === 'minor' ? 'm' : 'M' }; prog[prog.length - 2] = { ...prog[prog.length - 2], deg: 7, q: '7' }; }
    } else prog = progression(rForm, D.harmony, { ...opts, bars: sec.bars, cad });
    if (!hc) harmCache[mb] = { prog: prog.map(c => ({ ...c })), bars: sec.bars, key: sec.key };
    // 最后一段的结尾：史诗、浪漫交响从小调走到大调（皮卡迪三度）
    if (i === plan.secs.length - 1 && D.harmony !== 'epic' && D.harmony !== 'blues' && D.harmony !== 'penta' && harmMode(tn.mode) === 'minor' && C.pre?.id === 'romantic-symphonic') prog[prog.length - 1].q = 'M';
    if (i === decIdx && prog.length >= 2) {
      const minorish = harmMode(tn.mode) === 'minor';
      prog[prog.length - 2] = { ...prog[prog.length - 2], deg: 7, q: '7' };
      prog[prog.length - 1] = { ...prog[prog.length - 1], deg: minorish ? 8 : 9, q: minorish ? 'M' : 'm' };
      sec.surpriseNote = `假终止：${sec.label} 结尾该落回主和弦，拐到了${minorish ? ' VI' : ' vi'} 和弦`;
    }
    if (i === plan.secs.length - 1 && surprise.includes('picardy') && harmMode(tn.mode) === 'minor') { prog[prog.length - 1] = { ...prog[prog.length - 1], q: 'M' }; sec.surpriseNote = '皮卡迪三度：小调的最后一个和弦换成大三和弦'; }
    prog.forEach(c => chords.push({ ...c, t: c.t + sec.startBar * B, tonic: tn.tonic }));
    sec.prog = prog;
  });
  const chordAt = t => { let c = chords[0]; for (const x of chords) { if (x.t <= t + 1e-6) c = x; else break; } return c; };
  const tonicAt = t => chordAt(t).tonic;
  steps.push(`和声：<b>${HARMONY[D.harmony]?.name || D.harmony}</b>（${HARMONY[D.harmony]?.plain || ''}）`);
  plan.secs.forEach(sec => steps.push(`　${sec.label}${sec.cue ? `（画面：${sec.cue}）` : ''}：${sec.bars} 小节，${NAMES[sec.tonic]} ${MODE_NAME[sec.mode] || sec.mode}，能量 ${sec.energy.toFixed(2)}，和弦 ${sec.prog.map(roman).join(' ')}`));

  // 4 · 动机 → 旋律
  const motif = makeMotif(subRNG(mSeed, 'motif-degs'), subRNG(mSeed, 'motif-rhythm' + meter), { meter, mstyle: D.mstyle || 'dance', given: card.motif });
  steps.push(`动机（主导动机，整首旋律都从它长出来）：音阶级数 [${motif.degs.join(', ')}]，节奏 [${motif.rhythm.join(' ')}] 拍${card.motifSeed != null || motifSeed != null ? `（动机种子 ${mSeed}，同一个动机种子的几个版本共用它）` : ''}`);
  const cache = {}, melody = {};
  plan.secs.forEach((sec, i) => {
    if (sec.mat === 'I') { melody[i] = []; return; }
    const ctx = { r: rMel, motif, meter, mstyle: D.mstyle || 'dance', tonic: sec.tonic, mode: sec.mode === 'major' && mode !== 'minor' ? (SCALES[mode] ? mode : 'major') : sec.mode, startBeat: sec.startBar * B, center: FN.melody.center, chordAt, energy: sec.energy, strict: C.strict };
    if (ctx.mode === 'minor' || ctx.mode === 'harmonic') ctx.mode = 'minor';
    melody[i] = D.harmony === 'blues' ? bluesMelody({ ...ctx, mode: 'blues' }, sec) : sectionMelody(ctx, sec, cache);
  });

  // 4b · 挂留：最后一个落地的旋律音先停在上方邻音上，晚一拍才落下（只动最后一段，前面的同一段旋律不受影响）
  if (surprise.includes('suspension')) {
    const li = plan.secs.length - 1, ms = melody[li] || [], fin = ms.reduce((a, n) => (!a || n.t > a.t ? n : a), null);
    if (fin && fin.d >= 1) {
      const sc = (SCALES[plan.secs[li].mode] || SCALES.major).map(x => pcOf(x + plan.secs[li].tonic));
      let up = fin.p + 1; while (!sc.includes(pcOf(up)) && up < fin.p + 3) up++;
      const hold = Math.min(1, fin.d / 2);
      ms.push({ ...fin, p: up, d: hold }); fin.t += hold; fin.d -= hold; ms.sort((a, b) => a.t - b.t);
      plan.secs[li].surpriseNote = (plan.secs[li].surpriseNote ? plan.secs[li].surpriseNote + '；' : '') + '挂留：最后一个落地的音先停在上方邻音上，晚一拍才落下';
    }
  }
  const sNotes = plan.secs.filter(x => x.surpriseNote).map(x => x.surpriseNote);
  if (surprise.length) steps.push(`故意的意外（${surprise.join('、')}）：${sNotes.length ? sNotes.join('；') : '这一首的结构里没有合适的位置，没有生效'}`);

  // 5 · 每段谁上场、各声部的音
  const parts = Object.fromEntries(roles.map(r => [r.id, []])), orchNotes = [], layerLog = [];
  const cell = pick(subRNG(seed, 'cell'), [[0, 1, 2, 1, 0, 1, 2, 3], [0, 2, 1, 2, 0, 2, 3, 2], [2, 1, 0, 1, 2, 3, 2, 1]]), phaseCell = pick(subRNG(seed, 'phase'), [[0, 2, 1, 2, 3, 2, 1, 2, 0, 1, 2, 1], [0, 1, 2, 0, 1, 2, 3, 2, 1, 3, 2, 1]]);
  const patternFor = {}, entry = {}; // entry = 每个声部第一次进来的小节（相位从这里开始算）
  plan.secs.forEach((sec, i) => {
    const on = activeRoles(roles, sec, i, plan.secs.length, D.form), start = sec.startBar * B, end = start + sec.bars * B, next = plan.secs[i + 1];
    layerLog.push(`　${sec.label}：${roles.filter(r => on.has(r.id)).map(r => `${INSTRUMENTS[r.inst].name}（${FN[r.fn].name}）`).join('、') || '—'}`);
    const hasBass = roles.some(r => r.fn === 'bass' && on.has(r.id));
    const secChords = chords.filter(c => c.t >= start - 1e-6 && c.t < end - 1e-6);
    for (const r of roles) {
      if (!on.has(r.id)) continue;
      const ctx = { B, meter, chords: secChords, chordAt, tonicAt, start, end, energy: sec.energy, center: FN[r.fn].center, hasBass, melody: melody[i] || [], secIndex: i, cell, phaseCell, mode: sec.mode, motif, entryBar: (entry[r.id] ??= sec.startBar), scalePcs: (SCALES[sec.mode] || SCALES.major).map(x => pcOf(x + sec.tonic)), globalBar: b => sec.startBar + Math.floor((b - start + 1e-6) / B), rising: !!next && next.energy > sec.energy + 0.05, fill: !!next && next.energy > sec.energy + 0.1, barStart: t => start + Math.floor((t - start + 1e-6) / B) * B };
      const out = [];
      if (r.fn === 'melody') { if (sec.energy >= (D.melodyFrom ?? 0)) out.push(...(melody[i] || []).map(n => ({ ...n, v: 0.8 }))); }
      else if (r.fn === 'accomp' || r.fn === 'pad') { const want = r.pattern || (r.fn === 'pad' ? 'pad' : D.accomp || 'block'); const pat = idiomPattern(r, want, orchNotes); patternFor[r.id] = pat; (ACCOMP[pat] || ACCOMP.block).fn(ctx, out); }
      else if (r.fn === 'bass') { const pat = idiomPattern(r, r.pattern || D.bass || 'root', orchNotes); patternFor[r.id] = pat; (BASS[pat] || BASS.root).fn(ctx, out); }
      else if (r.fn === 'counter') counterLine(ctx, out);
      else if (r.fn === 'color') colorLine(ctx, out);
      else if (r.fn === 'gliss') { if (next) glissLine(ctx, out); }
      else if (r.fn === 'hits') hitsLine(ctx, out);
      else if (r.fn === 'drums') drumLine(ctx, out, r.pattern || D.drums || 'rock');
      else if (r.fn === 'hetero') ACCOMP.heterophony.fn(ctx, out);
      else if (r.fn === 'tremolo') ACCOMP['tremolo-pluck'].fn(ctx, out);
      parts[r.id].push(...out.filter(n => n.t < end - 1e-6).map(n => ({ ...n, d: Math.min(n.d, end + (i === plan.secs.length - 1 ? B : 0.5) - n.t) })));
    }
  });
  steps.push(`配器（每段谁上场；能量越高进来的乐器越多，对比段换一件乐器唱主旋律）：<br>${layerLog.join('<br>')}`);

  // 记谱整齐：2.85、2.94 拍这种「差一点点满」的长音补满到半拍网格（声音上有自然的余音，谱面上不出现碎连线）
  for (const r of roles) for (const n of parts[r.id]) { const q = Math.round(n.d * 2) / 2; if (n.d >= 0.9 && q >= 1 && Math.abs(q - n.d) <= 0.2) n.d = q; }

  // 6 · 音区、惯用法、力度
  const totalBeats = plan.totalBars * B, energyAt = t => { const s = plan.secs.find(x => t >= x.startBar * B - 1e-6 && t < (x.startBar + x.bars) * B - 1e-6) || plan.secs[plan.secs.length - 1]; return s.energy; };
  const regLog = []; // 第二件旋律乐器音域够高就放高八度（melodyHigh），叠奏时不和主奏同度
  for (const r of roles) { if (INSTRUMENTS[r.inst].drum) continue; const o = fitRegister(parts[r.id], r.inst, 0, r.fn === 'melody' && r.idx > 0 && profile(r.inst).tess[1] >= 90 ? 'melodyHigh' : r.fn); if (o) regLog.push(`${r.name}（${INSTRUMENTS[r.inst].name}）整体 ${o > 0 ? '+' : ''}${o} 个八度进到它最舒服的音区`); }
  orchNotes.push(...regLog, ...applyOctaveHints(parts, roles), ...separate(parts, roles));
  for (const r of roles) parts[r.id] = INSTRUMENTS[r.inst].drum ? parts[r.id].map(n => ({ ...n, v: Math.min(1, (n.v ?? 0.7) * (0.6 + 0.5 * energyAt(n.t))) })) : applyIdiom(r, parts[r.id], { bpm, energyAt, B });
  const rolled = roles.filter(r => parts[r.id].some(n => n.roll)).map(r => INSTRUMENTS[r.inst].name);
  if (rolled.length) orchNotes.push(`${rolled.join('、')}拉不住长音，长音改成滚奏（快速重复敲同一个音）`);
  if (orchNotes.length) steps.push(`按乐器性格改的地方：<br>　${orchNotes.join('<br>　')}`);
  if (staticIssues.length) steps.push(`⚠ 编制里有搭配风险：<br>　${staticIssues.map(x => x.why).join('<br>　')}`);

  // 7 · 结尾：最后一个和弦所有在场的声部一起拉长；最后两小节渐慢
  const lastT = Math.max(...Object.values(parts).flat().map(n => n.t));
  for (const r of roles) { const ns = parts[r.id]; if (!ns.length || INSTRUMENTS[r.inst].drum) continue; const fin = ns.filter(n => Math.abs(n.t - Math.max(...ns.map(x => x.t))) < 1e-6); if (fin[0] && fin[0].t >= lastT - B) fin.forEach(n => { n.d = Math.max(n.d, totalBeats - n.t + B * 0.5); }); }

  // 8 · 速度：摇摆 / 自由伸缩 / 结尾渐慢
  const spb = 60 / bpm, rs = Math.max(0, totalBeats - 2 * B), span = totalBeats + B - rs;
  const swing = b => { const f = Math.floor(b), x = b - f; return f + (x < 0.5 ? x / 0.5 * (2 / 3) : 2 / 3 + (x - 0.5) / 0.5 * (1 / 3)); };
  const phraseLen = 4 * B;
  const base = C.groove === 'swing' ? swing : C.groove === 'rubato' ? (b => b + 0.06 * phraseLen / (2 * Math.PI) * Math.sin(2 * Math.PI * b / phraseLen)) : (b => b);
  const time = b => (base(b) + (b > rs ? 0.4 * (b - rs) ** 2 / (2 * span) : 0)) * spb;
  steps.push(`速度：♩≈${bpm}${C.groove === 'swing' ? '，摇摆（八分音符前长后短，2:1）' : C.groove === 'rubato' ? '，自由伸缩（每个乐句中间稍快、句尾稍慢）' : ''}；最后两小节渐慢，最后一个和弦拉长`);

  const notes = roles.flatMap(r => parts[r.id].map(n => ({ p: n.p, t: +n.t.toFixed(4), d: +Math.max(0.05, n.d).toFixed(4), v: +Math.min(1, n.v ?? 0.7).toFixed(3), role: r.id })));
  const keyName = `${NAMES[tonic]} ${harmMode(mode) === 'minor' ? '小调' : '大调'}`;
  const recipe = [
    `曲式 · ${plan.form.name}：${plan.form.plain}`, `和声 · ${HARMONY[D.harmony]?.name}：${HARMONY[D.harmony]?.plain}`,
    `旋律 · 从一个动机长出来：陈述 → 应答（重复或模进）→ 发展（截一半往上推）→ 终止；前句悬着、后句落地`,
    ...roles.filter(r => patternFor[r.id]).map(r => { const P = ACCOMP[patternFor[r.id]] || BASS[patternFor[r.id]]; return `${r.name} · ${INSTRUMENTS[r.inst].name}：${P?.name}（${P?.plain}）`; }),
    ...(D.drums && roles.some(r => r.fn === 'drums') ? [`鼓 · ${DRUMS[D.drums]?.name}：${DRUMS[D.drums]?.plain}`] : []),
    `能量 · ${plan.process.name}：${plan.process.plain}`,
    ...(surprise.length ? [`意外 · ${surprise.map(k => SURPRISE[k]?.name || k).join(' + ')}：${surprise.map(k => SURPRISE[k]?.plain).filter(Boolean).join('；')}`] : []),
  ];
  return {
    bpm, meter, key: keyName, notes, steps, time, recipe, strict: C.strict, melodyRoles: roles.filter(r => r.fn === 'melody').map(r => r.id), scale: mode,
    roles: Object.fromEntries(roles.map(r => [r.id, { name: r.name, inst: r.inst }])),
    meta: { motifUsed: motif, preset: C.pre?.id, name: C.name, era: C.era, who: C.who, sound: C.sound, dims: D, motif, sections: plan.secs.map(s => ({ label: s.label, bars: s.bars, startBar: s.startBar, energy: +s.energy.toFixed(2), cue: s.cue })), issues: staticIssues, totalBars: plan.totalBars, debugNm: nm },
  };
}
export const SURPRISE = {
  deceptive: { name: '假终止', plain: '倒数第二个落地处，该回主和弦时拐到六级和弦，听众以为结束了，曲子还要往前走' },
  suspension: { name: '挂留', plain: '最后一个落地的音先停在上方邻音上，晚一拍才落下' },
  picardy: { name: '皮卡迪三度', plain: '小调曲子的最后一个和弦换成大三和弦，暗了一路，最后亮起来' },
};
export { FORMS, PROCESS, HARMONY, ACCOMP, BASS, DRUMS };
