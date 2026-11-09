// 旋律维度：先写一个「动机」（几个音的小句子），整首旋律都从它长出来。
//   乐句 = 陈述动机 → 应答（重复或模进）→ 发展（截一半往上推）→ 终止（长音落在目标音上）
//   两个乐句成一个乐段：前句停在「悬着」的音上，后句开头照抄前句、结尾落地。
// 旋律先用「音阶第几级」记，再按段落的调和调式变成具体音高：同一段旋律换调、换大小调都还是它。
import { pick, pcOf, SCALES, chordPcs, nearest, strength, barBeats } from './core.mjs';

// 每种拍子、每种旋律性格可用的一小节节奏（单位：拍）
const RHY = {
  '3/4': { dance: [[1, 1, 1], [2, 1], [1, 0.5, 0.5, 1], [0.5, 0.5, 1, 1], [1.5, 0.5, 1], [1, 1, 0.5, 0.5]], lyric: [[2, 1], [1.5, 0.5, 1], [1, 2], [1, 1, 1]], busy: [[0.5, 0.5, 0.5, 0.5, 1], [1, 0.5, 0.5, 0.5, 0.5], [0.5, 0.5, 0.5, 0.5, 0.5, 0.5]], long: [[3], [2, 1]] },
  '4/4': { dance: [[1, 1, 1, 1], [1, 0.5, 0.5, 1, 1], [2, 1, 1], [1.5, 0.5, 1, 1], [0.5, 0.5, 1, 2]], lyric: [[2, 2], [3, 1], [1.5, 0.5, 2], [1, 1, 2], [2, 1, 1]], busy: [[0.5, 0.5, 0.5, 0.5, 1, 1], [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 1], [1, 0.5, 0.5, 0.5, 0.5, 1]], long: [[4], [3, 1], [2, 2]], march: [[0.75, 0.25, 0.75, 0.25, 1, 1], [1.5, 0.5, 1, 1], [0.75, 0.25, 1, 2], [1, 0.75, 0.25, 2]], swing: [[1.5, 1, 1.5], [1, 0.5, 1, 1.5], [0.5, 1, 0.5, 2], [1, 1, 2]] },
  '2/4': { dance: [[1, 1], [0.5, 0.5, 1], [1, 0.5, 0.5]], lyric: [[2], [1.5, 0.5], [1, 1]], busy: [[0.5, 0.5, 0.5, 0.5], [0.25, 0.25, 0.5, 1]], long: [[2]], march: [[0.75, 0.25, 1], [0.75, 0.25, 0.5, 0.5], [1, 1]], swing: [[1.5, 0.5], [0.5, 1, 0.5]] },
  '6/8': { dance: [[2, 1, 2, 1], [3, 2, 1], [1, 1, 1, 3]], lyric: [[3, 3], [6], [4, 2]], busy: [[1, 1, 1, 1, 1, 1], [2, 1, 1, 1, 1]], long: [[6], [3, 3]] },
};
const rhythms = (meter, style) => { const m = RHY[meter.split(' ')[0]] || RHY['4/4']; return m[style] || m.dance; };
const CAD = { '3/4': [[2, 1], [3]], '4/4': [[2, 2], [3, 1], [4]], '2/4': [[2], [1, 1]], '6/8': [[3, 3], [6]] };

// 动机：音阶级数的轮廓（大多一级级走，一次跳进后反向级进「补回来」）+ 一小节节奏
export function makeMotif(rDeg, rRhy, { meter, mstyle = 'dance', given }) {
  // 动机节奏优先挑「有长有短」的（全是四分音符的动机没有性格，听着像在数拍子）
  const pool = rhythms(meter, mstyle), varied = pool.filter(x => x.length >= 3 && new Set(x).size >= 2);
  const rhythm = given?.rhythm || pick(rRhy, varied.length ? varied : pool);
  if (given?.degs) return { degs: given.degs, rhythm };
  // 轮廓和节奏用两条独立的随机数流：换拍子（3/4 → 4/4）时节奏变了，轮廓还是同一个，耳朵认得出
  const degs = [pick(rDeg, [0, 2, 4])]; let leapt = false;
  for (let i = 1; i < 6; i++) {
    const prev = degs[i - 1], before = degs[i - 2];
    if (!leapt && rDeg() < 0.3) { degs.push(prev + pick(rDeg, [2, 3, -2, 4])); leapt = true; continue; }
    if (before != null && Math.abs(prev - before) >= 2) { degs.push(prev - Math.sign(prev - before)); continue; } // 跳进后反向级进
    degs.push(prev + pick(rDeg, [1, -1, 1, -1, 0, 2, -2]));
  }
  return { degs, rhythm };
}
// 把轮廓配到某个节奏上：音比轮廓多就沿最后的方向级进补，少就截断
const fitContour = (degs, n) => { const o = degs.slice(0, n); while (o.length < n) { const a = o[o.length - 1], b = o[o.length - 2] ?? a; o.push(a + (a >= b ? 1 : -1)); } return o; };

// 一个抽象乐句（只记级数和节奏，不记音高）：roles = 每小节做什么
function abstractPhrase(r, motif, { bars, meter, mstyle, cad, anchor, climax, invert }) {
  const B = barBeats(meter), out = [], sgn = invert ? -1 : 1;
  const roles = bars <= 1 ? ['cad'] : bars === 2 ? ['stmt', 'cad'] : bars === 3 ? ['stmt', 'dev', 'cad'] : ['stmt', 'ans', ...Array(bars - 3).fill('dev'), 'cad'];
  const seqStep = pick(r, [-1, 1, 2, -2]);
  roles.forEach((role, b) => {
    let rhy, degs, base = anchor;
    if (role === 'stmt') { rhy = motif.rhythm; degs = fitContour(motif.degs, rhy.length).map(d => (d - motif.degs[0]) * sgn); }
    else if (role === 'ans') { const alt = rhythms(meter, mstyle).filter(x => x.join() !== motif.rhythm.join() && x.length >= 2); rhy = r() < 0.5 && alt.length ? pick(r, alt) : motif.rhythm; base = anchor + seqStep; degs = fitContour(motif.degs, rhy.length).map(d => (d - motif.degs[0]) * sgn); if (r() < 0.4) degs[degs.length - 1] += pick(r, [-1, 1]); }
    else if (role === 'dev') {
      // 截取动机前半，连说两遍并往上推一级（「拆碎了往上推」）
      const half = Math.max(2, Math.ceil(motif.rhythm.length / 2)), hr = motif.rhythm.slice(0, half), hl = hr.reduce((a, x) => a + x, 0);
      rhy = []; let tt = 0; while (tt + 1e-6 < B) for (const d of hr) { if (tt + 1e-6 >= B) break; const dd = Math.min(d, B - tt); rhy.push(dd); tt += dd; }
      const frag = fitContour(motif.degs, half).map(d => (d - motif.degs[0]) * sgn);
      degs = rhy.map((_, i) => frag[i % half] + Math.floor(i / half) * (climax ? 1 : pick(r, [1, -1, 1])));
      base = anchor + (climax ? 2 + (b - 2) : 1); void hl;
    } else {
      rhy = pick(r, CAD[meter.split(' ')[0]] || CAD['4/4']); degs = rhy.map(() => null); // 终止的音高等会儿按目标音定
    }
    // 节奏和小节不一样长（比如 3 拍的动机放进 4/4）：不够就把最后一个音拉长，多了就截掉
    { const sum = rhy.reduce((a, x) => a + x, 0); if (sum < B - 1e-6) { rhy = rhy.slice(); rhy[rhy.length - 1] += B - sum; } else if (sum > B + 1e-6) { const o = []; let tt = 0; for (const d of rhy) { if (tt >= B - 1e-6) break; o.push(Math.min(d, B - tt)); tt += d; } rhy = o; } }
    let t = 0;
    rhy.forEach((d, i) => { out.push({ deg: degs[i] == null ? null : base + degs[i], t: b * B + t, d, cad: role === 'cad', last: role === 'cad' && i === rhy.length - 1, cadType: cad }); t += d; });
  });
  return out;
}

// 级数 → 具体音高（按调式音阶）
const degToPitch = (deg, scale, tonic, center) => { const L = scale.length, o = Math.floor(deg / L), i = ((deg % L) + L) % L; return center - pcOf(center - tonic) + scale[i] + 12 * o; };

// 一个段落的旋律：材料表（同字母同材料）里取，没有就现写
// ctx = { r, motif, meter, mstyle, tonic, mode, chords(绝对拍), startBeat, center, energy }
export function sectionMelody(ctx, sec, cache) {
  const { r, motif, meter, mstyle } = ctx, B = barBeats(meter), base = sec.mat.replace(/'/g, '');
  let abs = cache[base];
  const phraseBars = sec.bars >= 8 ? 4 : sec.bars;
  if (abs && abs.bars !== sec.bars) {
    // 同一段素材再出现但长度不同：先原样沿用前面写过的（耳朵认得出「回来了」），不够的小节往后续写，太长就截掉、最后一小节重写终止
    const keep = sec.bars > abs.bars ? abs.bars : sec.bars - 1, ph = abs.notes.filter(n => n.t < keep * B - 1e-6).map(n => ({ ...n, last: n.last && keep === abs.bars ? n.last : n.last }));
    let b = keep;
    while (b < sec.bars) { const bars = Math.min(4, sec.bars - b), last = b + bars >= sec.bars; ph.push(...abstractPhrase(r, motif, { bars, meter, mstyle, cad: last ? sec.cad : 'half', anchor: 0, climax: last }).map(n => ({ ...n, t: n.t + b * B }))); b += bars; }
    abs = { bars: sec.bars, notes: ph };
  } else if (!abs) {
    const invert = base !== 'A' && base !== 'L' && base !== 'I' && r() < 0.6, anchor = base === 'A' || base === 'L' ? 0 : pick(r, [2, -1, 3]);
    const ph = []; let b = 0, k = 0;
    const first = abstractPhrase(r, motif, { bars: Math.min(phraseBars, sec.bars), meter, mstyle, cad: 'half', anchor, invert });
    while (b < sec.bars) {
      const bars = Math.min(phraseBars, sec.bars - b), last = b + bars >= sec.bars, cad = last ? sec.cad : 'half', climax = k >= 1 && (b + bars) / sec.bars >= 0.6 && (b + bars) / sec.bars <= 1;
      let p;
      if (k % 2 === 1 && bars === phraseBars) { // 后句：前两小节照抄前句，后面重写、结尾按段尾终止
        const tail = abstractPhrase(r, motif, { bars, meter, mstyle, cad, anchor, climax, invert });
        p = [...first.filter(n => n.t < 2 * B), ...tail.filter(n => n.t >= 2 * B)];
        p.forEach(n => { if (n.cad) n.cadType = cad; });
      } else p = k === 0 ? first.map(n => ({ ...n, cadType: last ? sec.cad : n.cadType })) : abstractPhrase(r, motif, { bars, meter, mstyle, cad, anchor: anchor + (k >= 2 ? 1 : 0), climax, invert });
      ph.push(...p.map(n => ({ ...n, t: n.t + b * B })));
      b += bars; k++;
    }
    abs = { bars: sec.bars, notes: ph };
    if (!cache[base]) cache[base] = abs;
  }
  // 具体化：按段落调式变音高；强拍对齐和弦音；终止音落在目标上
  const scale = SCALES[ctx.mode] || SCALES.major, out = [], lo = ctx.center - 10, hi = ctx.center + 12;
  let prev = null;
  const notes = varied(abs.notes, sec.vary || (sec.mat.includes("'") ? 'ornament-light' : null), r, B);
  for (const n of notes) {
    const T = ctx.startBeat + n.t, ch = ctx.chordAt(T), cp = ch.q === '5' ? scale.map(x => pcOf(x + ctx.tonic)) : chordPcs(ctx.tonic, ch); // 五声的持续低音上，五个音都算「和弦音」
    let p;
    if (n.deg == null) {
      // 终止：全终止落主和弦根音或三音（最后一个音必是主音），半终止落属和弦的音
      const target = n.cadType === 'full' ? (n.last ? [pcOf(ctx.tonic)] : cp) : n.cadType === 'half' ? cp : cp;
      p = nearest(target, prev ?? ctx.center, lo, hi);
    } else {
      p = degToPitch(n.deg, scale, ctx.tonic, ctx.center);
      // 哪些音必须是和弦音：严格风格（巴洛克、古典）= 落在拍点上、或者从拍子之间拖过下一个拍点的音；中等 = 强拍和长音；自由 = 只管强拍
      const st = strength(T, meter), crosses = Math.ceil(T - 1e-6) < T + n.d - 1e-6 && st === 3;
      const must = ctx.strict === 'strict' ? st <= 2 || crosses : ctx.strict === 'free' ? st <= 1 : st <= 1 || (st === 2 && n.d >= 1) || (crosses && n.d >= 1);
      if (must && !cp.includes(pcOf(p))) { // 挑离原定音和上一个音都近的和弦音（声部进行最省力）
        const want = p, c = [];
        for (let q = want - 4; q <= want + 4; q++) if (cp.includes(pcOf(q))) c.push(q);
        const cost = q => Math.abs(q - want) + 0.6 * Math.abs(q - (prev ?? want)) + (q === prev && want !== prev ? 2.5 : 0); // 原本要动的音，别因为对齐和弦就变成原地重复
        if (c.length) p = c.reduce((a, b) => (cost(b) < cost(a) ? b : a));
      }
    }
    while (p > hi) p -= 12; while (p < lo) p += 12;
    if (prev != null && Math.abs(p - prev) > 9) p += p > prev ? -12 : 12; // 避免太远的大跳
    if (p > hi || p < lo) p = nearest(cp, ctx.center, lo, hi);
    out.push({ p, t: T, d: n.d, phraseEnd: !!n.last || !!(n.cad && n === notes[notes.length - 1]) });
    prev = p;
  }
  // 乐句最后一个音标出来（给管乐留换气）
  for (let i = 0; i < out.length; i++) if (notes[i].last) out[i].phraseEnd = true;
  // 和弦音之间隔了三度、四度的地方，把前一个音拆成两半，中间插一个音阶里的经过音——旋律更像「唱」而不是「蹦和弦」
  const fill = [];
  for (let i = 0; i < out.length; i++) {
    const a = out[i], b = out[i + 1], gap = b ? b.p - a.p : 0;
    if (b && a.d >= 1 && !a.phraseEnd && Math.abs(gap) >= 3 && Math.abs(gap) <= 5 && Math.abs(b.t - (a.t + a.d)) < 1e-6 && r() < 0.65) {
      const h = a.d / 2, mid = nearest(scale.map(x => pcOf(x + ctx.tonic)), a.p + gap / 2, Math.min(a.p, b.p) + 1, Math.max(a.p, b.p) - 1);
      fill.push({ ...a, d: h }, { p: mid, t: a.t + h, d: h, phraseEnd: false });
    } else fill.push(a);
  }
  // 同一个音连着出现三次以上，把中间的改成上方邻音（重复太多像在打点）
  for (let i = 1; i < fill.length - 1; i++) {
    const a = fill[i - 1], b = fill[i], c = fill[i + 1];
    if (a.p === b.p && b.p === c.p && !b.phraseEnd) { const T = b.t, cp = chordPcs(ctx.tonic, ctx.chordAt(T)), sc = scale.map(x => pcOf(x + ctx.tonic)), st = strength(T, meter);
      b.p = st <= 1 ? nearest(cp.filter(x => x !== pcOf(b.p)), b.p + 2, b.p + 1, b.p + 5) : nearest(sc, b.p + 2, b.p + 1, b.p + 3); }
  }
  return fill;
}

// 变奏手法（只改节奏或加经过音，不改动机的样子）
function varied(notes, how, r, B) {
  if (!how) return notes;
  const out = [];
  for (let i = 0; i < notes.length; i++) {
    const n = notes[i], nx = notes[i + 1];
    if ((how === 'ornament' || (how === 'ornament-light' && r() < 0.35)) && n.deg != null && nx?.deg != null && n.d >= 1 && Math.abs(nx.deg - n.deg) >= 2 && !n.cad) {
      const h = n.d / 2; out.push({ ...n, d: h }, { ...n, deg: n.deg + Math.sign(nx.deg - n.deg), t: n.t + h, d: h }); continue; // 中间插一个经过音
    }
    if (how === 'ornament' && n.deg != null && n.d >= 1 && !n.cad && r() < 0.5) { const h = n.d / 2; out.push({ ...n, d: h }, { ...n, deg: n.deg + 1, t: n.t + h, d: h / 2 }, { ...n, t: n.t + h * 1.5, d: h / 2 }); continue; } // 上邻音
    if (how === 'dotted' && nx && Math.abs(n.d - nx.d) < 1e-6 && n.d <= 1 && Math.abs((n.t / n.d) % 2) < 1e-6 && !n.cad) { out.push({ ...n, d: n.d * 1.5 }, { ...nx, t: n.t + n.d * 1.5, d: nx.d * 0.5 }); i++; continue; }
    out.push(n);
  }
  return out;
}

// 布鲁斯：一句唱、一句空（留给别的乐器应答）；三句里第二句照抄第一句（AAB）
export function bluesMelody(ctx, sec) {
  const { r, motif, meter } = ctx, B = barBeats(meter), out = [], scale = SCALES.blues;
  const line = () => { const rhy = motif.rhythm, degs = fitContour(motif.degs, rhy.length); const ns = []; let t = 0; rhy.forEach((d, i) => { ns.push({ deg: degs[i] - degs[0], t, d }); t += d; }); ns.push({ deg: pick(r, [0, -1, 2]), t: B, d: B * 1.5 }); return ns; };
  const L1 = line(), L3 = line().map(n => ({ ...n, deg: -n.deg + 2 }));
  for (let b = 0; b < sec.bars; b += 4) {
    const which = Math.floor(b / 4) % 3, L = which === 2 ? L3 : L1;
    for (const n of L) {
      const T = ctx.startBeat + b * B + n.t; let p = degToPitch(n.deg, scale, ctx.tonic, ctx.center);
      if (b + 4 >= sec.bars && n === L[L.length - 1]) p = nearest([pcOf(ctx.tonic)], p);
      out.push({ p, t: T, d: n.d, phraseEnd: n === L[L.length - 1] });
    }
  }
  return out;
}
