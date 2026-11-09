// 配器维度：谁在什么时候演奏、演奏哪条线，以及「这件乐器该怎么演奏」。
//   1. 分层：每段按能量决定哪些乐器进来（能量低只剩一两件，高潮全体）。
//   2. 交接：对比段的主旋律换一件乐器唱；高潮时几件乐器八度叠在一起唱同一句。
//   3. 惯用法：按乐器档案（orch.mjs）改音型——拉不长音的乐器不铺长音、没有强弱的乐器靠加厚表现「更响」、
//      管乐和人声在句尾留换气、笨重的乐器不跑快音、每件乐器挪到自己最舒服的音区。
import { INSTRUMENTS } from '../theory.mjs';
import { profile, isPoly } from '../orch.mjs';

export const FN = {
  melody: { name: '主旋律', center: 74, vel: 0.78 }, counter: { name: '副旋律', center: 64, vel: 0.6 }, accomp: { name: '伴奏', center: 60, vel: 0.55 },
  bass: { name: '低音', center: 40, vel: 0.68 }, pad: { name: '铺底', center: 60, vel: 0.42 }, color: { name: '点缀', center: 84, vel: 0.5 },
  gliss: { name: '刮奏', center: 72, vel: 0.5 }, hits: { name: '定音鼓点', center: 45, vel: 0.7 }, drums: { name: '鼓', center: 40, vel: 0.62 },
  hetero: { name: '支声', center: 74, vel: 0.6 }, tremolo: { name: '轮指', center: 74, vel: 0.55 },
};
// 每种功能在多大能量时进来（同一功能的第 2、3 件乐器门槛更高）
const ENTER = { melody: [0, 0.75, 0.9], counter: [0.55, 0.8], accomp: [0, 0.5, 0.8], bass: [0.22, 0.7], pad: [0.45, 0.72, 0.88], color: [0.5, 0.85], gliss: [0.45], hits: [0.6], drums: [0.3], hetero: [0.3], tremolo: [0.45] };

// 展开编制：{melody:['violin','flute'], accomp:'harpsichord'} → 声部列表
export function expandEnsemble(ens) {
  const roles = [];
  for (const [fn, v] of Object.entries(ens || {})) {
    if (!FN[fn]) throw new Error(`不认识的功能「${fn}」，可用：${Object.keys(FN).join('、')}`);
    const list = (Array.isArray(v) ? v : [v]).filter(Boolean);
    list.forEach((x, i) => {
      const inst = typeof x === 'string' ? x : x.inst, pattern = typeof x === 'object' ? x.pattern : undefined, octave = typeof x === 'object' ? x.octave : undefined;
      if (!INSTRUMENTS[inst]) throw new Error('不认识的乐器：' + inst);
      roles.push({ id: list.length > 1 ? `${fn}${i + 1}` : fn, fn, idx: i, inst, pattern, octave, name: `${FN[fn].name}${list.length > 1 ? i + 1 : ''}` });
    });
  }
  return roles;
}

// 按乐器性格挑音型：不能拉长音的乐器去铺底，就改成分解和弦 / 稀疏点缀；笨重的乐器不走行走低音
export function idiomPattern(role, wanted, notes) {
  const P = profile(role.inst);
  if (role.fn === 'pad' || wanted === 'pad') {
    if (!P.sustain) { const alt = P.attack === 'strike' || P.bright >= 0.8 ? 'arp-sparse' : 'arp-up'; notes.push(`${INSTRUMENTS[role.inst].name}拉不住长音，铺底改成「${alt === 'arp-up' ? '上行琶音' : '稀疏点缀'}」`); return alt; }
    return 'pad';
  }
  if (role.fn === 'bass' && ['walking', 'octaves', 'walking8'].includes(wanted) && P.agile < 0.5) { notes.push(`${INSTRUMENTS[role.inst].name}比较笨重，低音从「${wanted}」改成根音-五音`); return 'root5'; }
  if (role.fn === 'accomp' && wanted === 'pulse' && !P.sustain && P.decay < 0.8) return 'pulse';
  return wanted;
}

// 这一段谁上场
export function activeRoles(roles, sec, secIndex, nSecs, formId) {
  const e = sec.energy, on = new Set(), byFn = {};
  roles.forEach(r => (byFn[r.fn] ||= []).push(r));
  const intro = sec.mat === 'I';
  for (const [fn, list] of Object.entries(byFn)) {
    list.forEach((r, i) => { const th = (ENTER[fn] || [0])[Math.min(i, (ENTER[fn] || [0]).length - 1)] ?? 0.9; if (e >= th - 1e-6) on.add(r.id); });
  }
  // 主旋律交接：对比段（B、C）换下一件乐器唱；循环渐进曲式每一轮换一件，越往后叠得越多
  const mel = byFn.melody || [];
  if (mel.length > 1) {
    mel.forEach(r => on.delete(r.id));
    const base = sec.mat.replace(/'/g, '');
    let lead = base === 'A' || base === 'L' ? 0 : base === 'B' ? 1 : mel.length - 1; // 第三种素材（三声中部、C 段）交给最后一件
    if (formId === 'loop-build') lead = secIndex;
    lead %= mel.length; on.add(mel[lead].id);
    if (e >= 0.75) on.add(mel[(lead + 1) % mel.length].id);
    if (e >= 0.9 && mel.length > 2) on.add(mel[(lead + 2) % mel.length].id);
  }
  if (sec.soft) { (byFn.pad || []).forEach(r => on.delete(r.id)); mel.forEach((r, i) => { if (i !== mel.length - 1) on.delete(r.id); }); } // 三声中部：编制变薄，只留一件乐器唱
  if (sec.solo) { (byFn.pad || []).forEach(r => on.delete(r.id)); (byFn.counter || []).forEach(r => on.delete(r.id)); }
  if (intro) { mel.forEach(r => on.delete(r.id)); (byFn.counter || []).forEach(r => on.delete(r.id)); }
  if (!intro && mel.length && !mel.some(r => on.has(r.id))) on.add(mel[0].id); // 有旋律的段落至少一件乐器在唱
  if (secIndex === nSecs - 1 && byFn.bass) on.add(byFn.bass[0].id); // 结尾一定有低音托住
  return on;
}

const median = xs => { const s = xs.slice().sort((a, b) => a - b); return s.length ? s[s.length >> 1] : 60; };
// 把一个声部整体挪几个八度，进到乐器最舒服的音区；还在乐器音域外的个别音单独折回来
export function fitRegister(notes, inst, prefer = 0, fn = '') {
  const P = profile(inst), R = INSTRUMENTS[inst].range, hi = P.tess[1], lo = fn === 'bass' ? Math.max(R[0] + 2, P.tess[0] - 5) : P.tess[0]; // 低音声部可以用到乐器的低音区
  if (INSTRUMENTS[inst].drum || !notes.length) return 0;
  let best = 0, bs = -1e9; const fits = {};
  for (let o = -4; o <= 4; o++) { const ok = notes.filter(n => n.p + o * 12 >= lo && n.p + o * 12 <= hi).length; fits[o] = ok; const score = ok - Math.abs(o - prefer) * 0.01 * notes.length; if (score > bs) { bs = score; best = o; } }
  // 主旋律、副旋律、点缀：在「八成以上的音都舒服」的几个八度里，挑最接近这个功能该在的音区的那个
  // （旋律 ≈ 72，站在伴奏上面又不尖；巴松这种低音乐器唱旋律也不会沉到低音区里）
  const TARGET = { melody: 72, counter: 64, color: 84, melodyHigh: 84, bass: 43 };
  if (TARGET[fn]) { const m0 = median(notes.map(n => n.p)); let bd = 1e9; for (let o = -4; o <= 4; o++) if (fits[o] >= notes.length * 0.8) { const d = Math.abs(m0 + o * 12 - TARGET[fn]); if (d < bd) { bd = d; best = o; } } }
  for (const n of notes) { n.p += best * 12; while (n.p > R[1]) n.p -= 12; while (n.p < R[0]) n.p += 12; }
  return best;
}

// 惯用法：长音、强弱、换气、快音
export function applyIdiom(role, notes, { bpm, energyAt, B }) {
  const P = profile(role.inst), spb = 60 / bpm, out = [];
  // 单音乐器（圆号、长笛、独奏小提琴……）不能吹和弦：同一时刻只留一个音，取和弦里的中间音（最像一条内声部）
  if (!isPoly(role.inst)) {
    const by = new Map(); for (const n of notes) { const k = Math.round(n.t * 48); (by.get(k) || by.set(k, []).get(k)).push(n); }
    let prev = null; notes = [...by.values()].map(g => { g.sort((a, b) => a.p - b.p); const pick = prev == null ? g[g.length >> 1] : g.reduce((a, b) => (Math.abs(b.p - prev) < Math.abs(a.p - prev) ? b : a)); prev = pick.p; return pick; }).sort((a, b) => a.t - b.t);
  }
  for (let i = 0; i < notes.length; i++) {
    const n = notes[i];
    // 拉不住长音：木琴、马林巴这类敲击乐器用滚奏代替长音；拨弦乐器每拍补拨一下
    if (!P.sustain && (role.fn === 'melody' || role.fn === 'counter') && n.d * spb > P.decay * 1.3 && n.d >= 1) {
      if (P.attack === 'strike' && P.decay < 1.2) { const step = bpm > 110 ? 0.25 : 0.125; for (let x = 0; x < n.d - 1e-6; x += step) out.push({ ...n, t: n.t + x, d: step * 0.95, v: n.v * (x ? 0.72 : 1), roll: true }); continue; }
      if (n.d >= 2) { for (let x = 0; x < n.d - 1e-6; x += 1) out.push({ ...n, t: n.t + x, d: Math.min(1, n.d - x) * 0.98, v: n.v * (x ? 0.75 : 1) }); continue; }
    }
    // 笨重的乐器（大号、低音提琴拉弓）快音合并成慢一点的音
    if (P.agile < 0.5 && n.d < 0.5 && bpm >= 96 && notes[i + 1] && Math.abs(notes[i + 1].t - (n.t + n.d)) < 1e-6) { out.push({ ...n, d: n.d + notes[i + 1].d }); i++; continue; }
    out.push({ ...n });
  }
  // 管乐、人声：句尾留一口气
  if ((P.attack === 'blow' || P.attack === 'voice') && (role.fn === 'melody' || role.fn === 'counter')) for (const n of out) if (n.phraseEnd && n.d > 0.5) n.d -= Math.min(0.25, n.d * 0.25);
  // 力度：没有强弱的乐器（羽管键琴、管风琴、八音盒）力度拉平，靠别的乐器加厚表现能量
  for (const n of out) {
    const e = energyAt(n.t), base = FN[role.fn].vel * (0.55 + 0.5 * e);
    n.v = P.dyn ? Math.min(1, base * (n.v ?? 0.8) / 0.8) : Math.min(1, 0.62 * (n.v ?? 0.8) / 0.8 + 0.08);
  }
  void B; return out;
}

// 音区分层：伴奏、铺底、副旋律和主旋律挤在一起（中位数差不到 6 个半音）就往远离旋律的方向挪一个八度；
// 伴奏、铺底和低音挤在一起，伴奏往上挪。挪不动（会出乐器音域）就不挪，自检的「乐器搭配」会提示。
export function applyOctaveHints(parts, roles) {
  const notes = [];
  for (const r of roles) if (r.octave && parts[r.id]?.length) { const R = INSTRUMENTS[r.inst].range; parts[r.id].forEach(n => { n.p += 12 * r.octave; while (n.p > R[1]) n.p -= 12; while (n.p < R[0]) n.p += 12; }); notes.push(`${r.name}（${INSTRUMENTS[r.inst].name}）按作曲卡整体${r.octave > 0 ? '升高' : '降低'} ${Math.abs(r.octave)} 个八度`); }
  return notes;
}
export function separate(parts, roles) {
  const notes = [], med = id => median(parts[id].map(n => n.p));
  const can = (r, k) => parts[r.id].every(n => n.p + k >= INSTRUMENTS[r.inst].range[0] && n.p + k <= INSTRUMENTS[r.inst].range[1]);
  const shift = (r, k, why) => { parts[r.id].forEach(n => { n.p += k; }); notes.push(`${r.name}（${INSTRUMENTS[r.inst].name}）${why}，整体${k > 0 ? '往上' : '往下'}挪一个八度`); };
  const mel = roles.filter(r => r.fn === 'melody' && parts[r.id]?.length), bass = roles.filter(r => r.fn === 'bass' && parts[r.id]?.length);
  const mMed = mel.length ? median(mel.flatMap(r => parts[r.id].map(n => n.p))) : null, bMed = bass.length ? median(bass.flatMap(r => parts[r.id].map(n => n.p))) : null;
  const clear = m => (mMed == null || Math.abs(m - mMed) >= 6) && (bMed == null || m - bMed >= 5); // 伴奏、铺底只能在低音上面
  for (const r of roles) {
    if (!['accomp', 'pad', 'counter'].includes(r.fn) || !parts[r.id]?.length || r.octave) continue; // 作曲卡手动指定了八度的不动
    const m = med(r.id); if (clear(m)) continue;
    const why = mMed != null && Math.abs(m - mMed) < 6 ? '和主旋律挤在一起' : '和低音挤在一起';
    // 先试「离旋律远」的方向，再试反方向；挪完要同时躲开旋律和低音
    const dirs = mMed != null && m <= mMed ? [-12, 12, 24, -24] : [12, -12, -24, 24];
    const k = dirs.find(k => can(r, k) && clear(m + k));
    if (k) shift(r, k, why);
  }
  return notes;
}
