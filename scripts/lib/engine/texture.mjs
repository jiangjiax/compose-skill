// 织体维度：除了主旋律以外的每一条线怎么动——伴奏音型、低音、副旋律、铺底、色彩点缀、鼓。
// 每个音型都是「给我和弦、拍号、能量、音区，我还你一串音」的小函数。能量低时音型会变稀，能量高时变密。
import { pick, pcOf, SCALES, chordPcs, nearest, barBeats } from './core.mjs';

// 在 center 附近排一个 n 个音的和弦（从下往上），尽量贴着上一个和弦走（声部进行最省力）
export function voicing(pcs, center, n = 3, prev = null) {
  const out = []; let p = nearest(pcs, center - 5, center - 12, center + 4);
  if (prev?.length) p = nearest(pcs, prev[0], prev[0] - 4, prev[0] + 4);
  out.push(p);
  while (out.length < n) { let q = out[out.length - 1] + 1; while (!pcs.includes(pcOf(q))) q++; out.push(q); }
  return out;
}
const rootOf = (ctx, ch) => pcOf(ctx.tonicAt(ch.t) + ch.deg);
const fifthOf = (ctx, ch) => chordPcs(ctx.tonicAt(ch.t), ch)[ch.q === '5' ? 1 : 2] ?? rootOf(ctx, ch);
const each = (ctx, f) => { for (const ch of ctx.chords) f(ch, chordPcs(ctx.tonicAt(ch.t), ch)); };
const beatsIn = (ch, step) => { const o = []; for (let x = 0; x < ch.d - 1e-6; x += step) o.push(ch.t + x); return o; };

// ---------------- 伴奏音型 ----------------
export const ACCOMP = {
  oompah: { name: '嘣嚓嚓', plain: '第一拍弹低音，后面几拍弹和弦（圆舞曲、小步舞曲）', fn(ctx, out) {
    let prev = null;
    each(ctx, (ch, pcs) => { const v = voicing(pcs.slice(0, 3), ctx.center, Math.min(3, pcs.length), prev); prev = v;
      for (const t of beatsIn(ch, 1)) {
        const x = Math.round(t - ctx.barStart(t));
        if (x === 0) { if (!ctx.hasBass) out.push({ p: nearest([rootOf(ctx, ch)], ctx.center - 14, ctx.center - 22, ctx.center - 8), t, d: 0.9, v: 1 }); continue; }
        if (ctx.energy < 0.3 && x > 1) continue; // 很轻的时候只留「嘣-嚓」
        v.forEach(p => out.push({ p, t, d: 0.5, v: 0.8 }));
      } });
  } },
  alberti: { name: '阿尔贝蒂低音', plain: '和弦拆成「低-高-中-高」一直反复（莫扎特）', fn(ctx, out) {
    let prev = null; each(ctx, (ch, pcs) => { const v = voicing(pcs.slice(0, 3), ctx.center, 3, prev); prev = v; const order = [v[0], v[2], v[1], v[2]], step = ctx.energy < 0.3 ? 1 : 0.5;
      beatsIn(ch, step).forEach((t, i) => out.push({ p: order[i % 4], t, d: step * 0.95, v: i % 4 ? 0.75 : 0.9 })); });
  } },
  arpeggio: { name: '宽分解和弦', plain: '左手从低音一路拨到高音再回来，像水波（肖邦夜曲）', fn(ctx, out) {
    each(ctx, (ch, pcs) => { const r = nearest([rootOf(ctx, ch)], ctx.center - 12, ctx.center - 18, ctx.center - 6), third = pcs[1] ?? pcs[0], fifth = pcs[2] ?? pcs[1] ?? pcs[0];
      const shape = [r, nearest([fifth], r + 7, r + 4, r + 9), nearest([third], r + 15, r + 12, r + 17), nearest([fifth], r + 19, r + 16, r + 21), nearest([third], r + 15, r + 12, r + 17), nearest([fifth], r + 7, r + 4, r + 9)];
      const step = ch.d / (ch.d % 3 === 0 ? 6 : ch.d >= 4 ? 8 : 6); beatsIn(ch, step).forEach((t, i) => out.push({ p: shape[i % shape.length], t, d: Math.max(step, ch.d - (t - ch.t)) * 0.98, v: i ? 0.65 : 0.85 })); });
  } },
  'arp-up': { name: '上行琶音', plain: '和弦音从低往高一串流上去（竖琴、吉他）', fn(ctx, out) {
    let prev = null; each(ctx, (ch, pcs) => { const v = voicing(pcs, ctx.center - 4, Math.min(pcs.length + 2, 6), prev); prev = v; const step = ctx.energy > 0.6 ? 0.25 : 0.5;
      beatsIn(ch, step).forEach((t, i) => out.push({ p: v[i % v.length], t, d: step * 2.5, v: 0.6 + (i % v.length === 0 ? 0.2 : 0) })); });
  } },
  block: { name: '柱式和弦', plain: '和弦整块按下去，一拍或两拍一下（众赞歌、抒情歌）', fn(ctx, out) {
    let prev = null; each(ctx, (ch, pcs) => { const v = voicing(pcs, ctx.center, Math.min(4, pcs.length + 1), prev); prev = v; const step = ctx.energy > 0.6 ? 1 : Math.min(ch.d, ctx.B === 3 ? 3 : 2); beatsIn(ch, step).forEach(t => v.forEach(p => out.push({ p, t, d: step * 0.95, v: 0.8 }))); });
  } },
  continuo: { name: '通奏低音', plain: '羽管键琴每拍弹一个短和弦，给整个乐队打拍子（巴洛克）', fn(ctx, out) {
    let prev = null; each(ctx, (ch, pcs) => { const v = voicing(pcs.slice(0, 3), ctx.center, 3, prev); prev = v; beatsIn(ch, ctx.energy > 0.55 ? 0.5 : 1).forEach(t => v.forEach(p => out.push({ p, t, d: 0.4, v: 0.75 }))); });
  } },
  pulse: { name: '持续八分音符', plain: '同一个和弦一直「哒哒哒哒」地打八分音符，往前推（电影配乐、巴洛克）', fn(ctx, out) {
    let prev = null; each(ctx, (ch, pcs) => { const v = voicing(pcs.slice(0, 3), ctx.center, ctx.energy > 0.7 ? 3 : 2, prev); prev = v; const step = ctx.energy < 0.35 ? 1 : 0.5; beatsIn(ch, step).forEach((t, i) => v.forEach(p => out.push({ p, t, d: step * 0.8, v: i % 2 ? 0.7 : 0.85 }))); });
  } },
  strum: { name: '扫弦', plain: '吉他一拍扫一下和弦，从低到高错开一点点', fn(ctx, out) {
    each(ctx, (ch, pcs) => { const v = voicing(pcs, ctx.center - 3, Math.min(5, pcs.length + 2)); beatsIn(ch, 1).forEach((t, i) => v.forEach((p, k) => out.push({ p, t: t + k * 0.03, d: 0.9 - k * 0.03, v: i % 2 ? 0.6 : 0.8 }))); });
  } },
  afterbeat: { name: '反拍和弦', plain: '低音在正拍，和弦在反拍「嘣-嚓」（进行曲、波尔卡）', fn(ctx, out) {
    let prev = null; each(ctx, (ch, pcs) => { const v = voicing(pcs.slice(0, 3), ctx.center, 3, prev); prev = v; beatsIn(ch, 1).forEach(t => v.forEach(p => out.push({ p, t: t + 0.5, d: 0.35, v: 0.75 }))); });
  } },
  habanera: { name: '哈巴涅拉节奏', plain: '「嘣——哒嘣嘣」附点节奏，探戈的心跳', fn(ctx, out) {
    let prev = null; const H = [[0, 0.75], [0.75, 0.25], [1, 0.5], [1.5, 0.5]];
    each(ctx, (ch, pcs) => { const v = voicing(pcs.slice(0, 3), ctx.center, 3, prev); prev = v; for (let x = 0; x < ch.d - 1e-6; x += 2) H.forEach(([o, d], k) => { if (k === 0) return; v.forEach(p => out.push({ p, t: ch.t + x + o, d: d * 0.85, v: k === 1 ? 0.9 : 0.7 })); }); });
  } },
  rhodes: { name: '慵懒和弦', plain: '七和弦松松地按在第一拍和第二拍半（Lo-fi、爵士）', fn(ctx, out) {
    let prev = null; each(ctx, (ch, pcs) => { const v = voicing(pcs, ctx.center, Math.min(4, pcs.length), prev); prev = v; for (let x = 0; x < ch.d - 1e-6; x += 4) { v.forEach(p => out.push({ p, t: ch.t + x, d: 1.4, v: 0.7 })); if (ch.d - x > 2.5) v.forEach(p => out.push({ p, t: ch.t + x + 2.5, d: 1.2, v: 0.6 })); } });
  } },
  syncopated: { name: '切分和弦', plain: '和弦落在拍子之间，带一点往前冲的劲（流行）', fn(ctx, out) {
    let prev = null; each(ctx, (ch, pcs) => { const v = voicing(pcs, ctx.center, 3, prev); prev = v; for (let x = 0; x < ch.d - 1e-6; x += 4) [[0, 1.5], [1.5, 1], [2.5, 1.5]].forEach(([o, d]) => { if (x + o < ch.d) v.forEach(p => out.push({ p, t: ch.t + x + o, d: d * 0.9, v: o ? 0.65 : 0.8 })); }); });
  } },
  ostinato: { name: '加法图案', plain: '几个和弦音组成的小图案不停重复，每过一段多加一个音（格拉斯）', fn(ctx, out) {
    const cell = ctx.cell || [0, 1, 2, 1, 0, 1, 2, 3], len = Math.min(cell.length, 3 + (ctx.secIndex ?? 0) * 2);
    let i = 0; each(ctx, (ch, pcs) => { const v = voicing(pcs, ctx.center, 4); beatsIn(ch, 0.5).forEach(t => { out.push({ p: v[cell[i % len] % v.length], t, d: 0.45, v: i % len === 0 ? 0.85 : 0.7 }); i++; }); });
  } },
  phase: { name: '相位图案', plain: '另一层图案和第一层一样长，却每段往后错一个八分音符，两层慢慢走散又对齐（赖希）', fn(ctx, out) {
    const cell = ctx.phaseCell || [0, 2, 1, 2, 3, 2, 1, 2, 0, 1, 2, 1], sh = ctx.secIndex ?? 0; let i = 0;
    each(ctx, (ch, pcs) => { const v = voicing(pcs, ctx.center, 4); beatsIn(ch, 0.5).forEach(t => { out.push({ p: v[cell[(i + sh) % cell.length] % v.length], t, d: 0.45, v: 0.65 }); i++; }); });
  } },
  'motif-ostinato': { name: '动机图案', plain: '把主导动机的几个音拆成八分音符的循环图案，每两小节多加一个音（加法过程），旋律从机械音型里浮出来', fn(ctx, out) {
    // 动机的第一个音放在音区中间，其他音按音阶一级级往上、往下数
    // 图案 = 动机 + 动机倒过来（去掉首尾重复），一共十来个音，加法过程能一直加到后半段
    const md = ctx.motif.degs, degs = [...md, ...md.slice(1, -1).reverse()], base = md[0], ladder = []; for (let m = ctx.center - 24; m <= ctx.center + 24; m++) if (ctx.scalePcs.includes(pcOf(m))) ladder.push(m);
    const i0 = ladder.indexOf(nearest(ctx.scalePcs, ctx.center, ctx.center - 6, ctx.center + 6));
    const pitchOf = d => ladder[Math.max(0, Math.min(ladder.length - 1, i0 + d - base))];
    let i = 0; for (let t = ctx.start; t < ctx.end - 1e-6; t += 0.5) {
      const since = ctx.globalBar(t) - (ctx.entryBar ?? 0), len = Math.min(degs.length, 2 + Math.floor(ctx.globalBar(t) / 2)), shift = ctx.phaseShift ? Math.floor(since / 4) : 0; // 相位：进来时先齐奏，之后每 4 小节错开一个八分音符
      const k = (i + shift) % len; out.push({ p: pitchOf(degs[k]), t, d: 0.45, v: k === 0 ? 0.85 : 0.7 }); i++;
    }
  } },
  'motif-phase': { name: '动机相位', plain: '同一个动机图案由另一件乐器弹，每 4 小节往后错一个八分音符，两层慢慢走散又对齐（赖希《钢琴相位》）', fn(ctx, out) { ACCOMP['motif-ostinato'].fn({ ...ctx, phaseShift: true }, out); } },
  pad: { name: '长音铺底', plain: '和弦音拉长音铺在下面，像一层地毯', fn(ctx, out) {
    let prev = null; each(ctx, (ch, pcs) => { const v = voicing(pcs, ctx.center, Math.min(4, Math.max(3, pcs.length)), prev); prev = v; v.forEach(p => out.push({ p, t: ch.t, d: ch.d * 0.98, v: 0.7 })); });
  } },
  'arp-sparse': { name: '稀疏点缀', plain: '一个和弦只轻轻点两三个音（八音盒、钢片琴这类不能拉长音的乐器代替铺底）', fn(ctx, out) {
    each(ctx, (ch, pcs) => { const v = voicing(pcs, ctx.center, 3); [0, 1, 2].forEach(k => { const t = ch.t + k * ch.d / 3; out.push({ p: v[k], t, d: ch.d / 3, v: 0.6 }); }); });
  } },
  heterophony: { name: '支声', plain: '和主旋律同一条线，但把短音并成长音、各加各的花（江南丝竹）', fn(ctx, out) {
    const m = ctx.melody; for (let i = 0; i < m.length; i++) { const n = m[i]; if (i && n.t - m[i - 1].t < 1 && Math.floor(n.t / 2) === Math.floor(m[i - 1].t / 2)) continue; const nx = m.find(x => x.t >= Math.floor(n.t / 2) * 2 + 2); out.push({ p: n.p - 12, t: n.t, d: Math.max(0.5, (nx ? nx.t : n.t + n.d) - n.t) * 0.97, v: 0.7 }); }
  } },
  'tremolo-pluck': { name: '轮指', plain: '长音上快速重复弹同一个音（琵琶的轮指）', fn(ctx, out) {
    for (const n of ctx.melody) { if (n.d >= 1.5) for (let x = 0; x < n.d - 1e-6; x += 0.25) out.push({ p: n.p - 12, t: n.t + x, d: 0.24, v: x ? 0.55 : 0.75 }); else out.push({ p: n.p - 12, t: n.t, d: n.d * 0.9, v: 0.65 }); }
  } },
};

// ---------------- 低音 ----------------
export const BASS = {
  root: { name: '根音长音', plain: '每个和弦弹一个根音；越满越密', fn(ctx, out) { each(ctx, ch => { const p = nearest([rootOf(ctx, ch)], ctx.center, ctx.center - 7, ctx.center + 5), step = ctx.energy > 0.65 ? Math.min(ch.d, ctx.B === 3 ? 3 : 2) : ch.d; beatsIn(ch, step).forEach(t => out.push({ p, t, d: step * 0.95, v: 0.85 })); }); } },
  root5: { name: '根音-五音', plain: '一个和弦里先弹根音再弹五音，来回走（进行曲、乡村）', fn(ctx, out) { each(ctx, ch => { const r = nearest([rootOf(ctx, ch)], ctx.center, ctx.center - 7, ctx.center + 5), f = nearest([fifthOf(ctx, ch)], r - 5, r - 7, r + 7); const step = ctx.B === 3 ? 3 : ctx.B === 2 ? 1 : 2; beatsIn(ch, step).forEach((t, i) => out.push({ p: i % 2 ? f : r, t, d: step * 0.8, v: i % 2 ? 0.7 : 0.85 })); }); } },
  walking: { name: '行走低音', plain: '一拍一个音「走」着：根音 → 经过音 → 和弦音 → 半音靠近下一个根音（爵士）', fn(ctx, out) {
    const chs = ctx.chords; chs.forEach((ch, ci) => { const pcs = chordPcs(ctx.tonicAt(ch.t), ch), r = nearest([pcs[0]], ctx.center, ctx.center - 7, ctx.center + 5), nx = chs[ci + 1], nr = nx ? nearest([chordPcs(ctx.tonicAt(nx.t), nx)[0]], r, r - 7, r + 7) : r;
      const beats = beatsIn(ch, 1); beats.forEach((t, i) => { let p = i === 0 ? r : i === beats.length - 1 ? nr + (nr > r ? -1 : 1) : nearest(i % 2 ? pcs : SCALES.major.map(x => pcOf(x + ctx.tonicAt(t))), r + (nr - r) * i / beats.length + (i % 2 ? 2 : 0), ctx.center - 9, ctx.center + 7); out.push({ p, t, d: 0.9, v: i ? 0.7 : 0.85 }); }); });
  } },
  walking8: { name: '八分音符低音', plain: '低音以八分音符在和弦音和经过音之间不停地走（巴洛克通奏低音）', fn(ctx, out) {
    each(ctx, (ch, pcs) => { const r = nearest([pcs[0]], ctx.center, ctx.center - 7, ctx.center + 5), sc = SCALES.major.map(x => pcOf(x + ctx.tonicAt(ch.t))); let p = r; const step = ctx.energy > 0.5 ? 0.5 : 1; beatsIn(ch, step).forEach((t, i) => { const onBeat = Math.abs(t - Math.round(t)) < 1e-6; if (i) p = onBeat ? nearest(pcs, p + (i % 4 < 2 ? 3 : -3), r - 5, r + 9) : nearest(sc, p + (i % 4 === 1 ? 2 : -1), r - 5, r + 9); out.push({ p, t, d: step * 0.9, v: i ? 0.65 : 0.85 }); }); });
  } },
  pedal: { name: '持续低音', plain: '低音守着主音不动，上面的和弦随便换（电影、民乐）', fn(ctx, out) { const p = nearest([pcOf(ctx.tonicAt(ctx.start))], ctx.center, ctx.center - 7, ctx.center + 5), len = ctx.B * 2; for (let t = ctx.start; t < ctx.end - 1e-6; t += len) out.push({ p, t, d: Math.min(len, ctx.end - t) * 0.98, v: 0.8 }); } },
  octaves: { name: '八度跳动', plain: '根音和高八度来回跳八分音符，有冲劲（迪斯科、电影追逐）', fn(ctx, out) { each(ctx, ch => { const r = nearest([rootOf(ctx, ch)], ctx.center, ctx.center - 7, ctx.center + 5); beatsIn(ch, 0.5).forEach((t, i) => out.push({ p: i % 2 ? r + 12 : r, t, d: 0.4, v: i % 2 ? 0.65 : 0.85 })); }); } },
  habanera: { name: '哈巴涅拉低音', plain: '低音也走「嘣——哒嘣嘣」', fn(ctx, out) { each(ctx, ch => { const r = nearest([rootOf(ctx, ch)], ctx.center, ctx.center - 7, ctx.center + 5), f = nearest([fifthOf(ctx, ch)], r + 7, r, r + 12); for (let x = 0; x < ch.d - 1e-6; x += 2) [[0, 0.75, r], [0.75, 0.25, r], [1, 0.5, f], [1.5, 0.5, r]].forEach(([o, d, p]) => out.push({ p, t: ch.t + x + o, d: d * 0.9, v: o ? 0.7 : 0.9 })); }); } },
  pop: { name: '流行低音', plain: '根音在第一拍，第二拍半带一下，往前推', fn(ctx, out) { each(ctx, ch => { const r = nearest([rootOf(ctx, ch)], ctx.center, ctx.center - 7, ctx.center + 5); for (let x = 0; x < ch.d - 1e-6; x += 4) [[0, 1.5], [1.5, 0.5], [2, 2]].forEach(([o, d]) => { if (x + o < ch.d && (ctx.energy > 0.4 || !o)) out.push({ p: r, t: ch.t + x + o, d: d * 0.9, v: o ? 0.7 : 0.85 }); }); }); } },
};

// ---------------- 副旋律：和主旋律反着走，在它下面三度、六度唱一条慢一点的线 ----------------
export function counterLine(ctx, out) {
  const m = ctx.melody; if (!m.length) return; let prev = null;
  // 节奏「长-短」：3/4 = 2 拍 + 1 拍；4/4 = 2 拍 + 1 拍 + 1 拍，和主旋律错开着动
  const pat = ctx.B === 3 ? [2, 1] : ctx.B === 2 ? [1.5, 0.5] : [2, 1, 1], times = [];
  for (let t = ctx.start, k = 0; t < ctx.end - 1e-6; t += pat[k % pat.length], k++) times.push([t, pat[k % pat.length]]);
  for (const [t, step] of times) {
    const cur = m.filter(n => n.t <= t + 1e-6 && n.t + n.d > t + 1e-6)[0] || m.find(n => n.t >= t && n.t < t + step); if (!cur) continue;
    const ch = ctx.chordAt(t), pcs = chordPcs(ctx.tonicAt(t), ch), mPrev = m.filter(n => n.t < t).pop();
    const dir = mPrev ? Math.sign(cur.p - mPrev.p) : 0;
    let cands = [cur.p - 3, cur.p - 4, cur.p - 8, cur.p - 9].map(x => nearest(pcs, x, x - 1, x + 1)).filter(x => x < cur.p - 2);
    if (prev != null && dir) cands.sort((a, b) => (Math.sign(a - prev) === -dir ? -1 : 1) - (Math.sign(b - prev) === -dir ? -1 : 1) || Math.abs(a - prev) - Math.abs(b - prev));
    let p = cands[0] ?? nearest(pcs, cur.p - 5); while (p > ctx.center + 6) p -= 12; while (p < ctx.center - 9) p += 12;
    out.push({ p, t, d: step * 0.95, v: 0.75 }); prev = p;
  }
}

// ---------------- 色彩：段落开头、乐句开头轻轻点一下高音；进新段前刮奏一串 ----------------
export function colorLine(ctx, out) {
  const B = ctx.B;
  for (let b = 0; b * B < ctx.end - ctx.start - 1e-6; b += 4) { const t = ctx.start + b * B, pcs = chordPcs(ctx.tonicAt(t), ctx.chordAt(t)); out.push({ p: nearest(pcs, ctx.center + 2, ctx.center - 4, ctx.center + 9), t, d: B, v: 0.7 }, { p: nearest(pcs, ctx.center + 7, ctx.center + 2, ctx.center + 14), t: t + B / 2, d: B / 2, v: 0.55 }); }
}
export function glissLine(ctx, out) {
  // 段尾最后一拍往上刮 8 个音，接进下一段
  const t0 = ctx.end - 1, sc = (ctx.mode === 'penta' ? SCALES.penta : SCALES.major).map(x => pcOf(x + ctx.tonicAt(t0)));
  let p = nearest(sc, ctx.center - 7); for (let j = 0; j < 8; j++) { out.push({ p, t: t0 + j / 8, d: 1.2 - j / 8, v: 0.45 + j * 0.04 }); p = nearest(sc, p + 2, p + 1, p + 4); }
}
// 定音鼓：乐句开头敲根音，渐强段的最后一小节滚奏
export function hitsLine(ctx, out) {
  const B = ctx.B;
  for (let b = 0; b * B < ctx.end - ctx.start - 1e-6; b += 4) { const t = ctx.start + b * B; out.push({ p: nearest([pcOf(ctx.tonicAt(t) + ctx.chordAt(t).deg)], ctx.center, ctx.center - 6, ctx.center + 6), t, d: 1, v: 0.85 }); }
  if (ctx.rising) { const p = nearest([pcOf(ctx.tonicAt(ctx.end - B) + 7)], ctx.center); for (let x = 0; x < B; x += 0.125) out.push({ p, t: ctx.end - B + x, d: 0.12, v: 0.35 + 0.55 * x / B }); }
}

// ---------------- 鼓（General MIDI 打击乐编号：36 底鼓 38 军鼓 42 闭镲 46 开镲 49 吊镲 51 叮叮镲 37 鼓边 39 拍手）----------------
export const DRUMS = {
  rock: { name: '流行鼓', plain: '底鼓在 1、3 拍，军鼓在 2、4 拍，闭镲打八分音符', bar: B => B === 4 ? [[36, 0], [42, 0], [42, 0.5], [38, 1], [42, 1], [42, 1.5], [36, 2], [36, 2.5], [42, 2], [42, 2.5], [38, 3], [42, 3], [42, 3.5]] : [[36, 0], [42, 0], [38, 1], [42, 1], [42, 2]] },
  soft: { name: '轻鼓', plain: '鼓边代替军鼓，只打骨架（抒情歌主歌）', bar: B => B === 4 ? [[36, 0], [42, 0], [37, 1], [42, 1], [36, 2.5], [42, 2], [37, 3], [42, 3]] : [[36, 0], [37, 1], [37, 2]] },
  lofi: { name: 'Lo-fi 鼓', plain: '慢半拍的底鼓、闷闷的军鼓，摇摆的闭镲', bar: B => [[36, 0], [42, 0], [42, 0.5], [38, 1], [42, 1], [42, 1.5], [36, 1.75], [36, 2.5], [42, 2], [42, 2.5], [38, 3], [42, 3], [42, 3.5]] },
  jazz: { name: '爵士鼓', plain: '叮叮镲「叮-叮嗒叮-叮嗒」，闭镲踩在 2、4 拍', bar: B => B === 4 ? [[51, 0], [51, 1], [51, 1.66], [42, 1], [51, 2], [51, 3], [51, 3.66], [42, 3], [36, 0]] : [[51, 0], [51, 1], [51, 2]] },
  march: { name: '进行曲军鼓', plain: '军鼓打附点和滚奏，底鼓在每拍（行军）', bar: B => B === 2 ? [[36, 0], [38, 0], [38, 0.75], [38, 1], [36, 1], [38, 1.5]] : [[36, 0], [38, 0], [38, 0.75], [38, 1], [36, 2], [38, 2], [38, 2.5], [38, 3], [38, 3.25], [38, 3.5], [38, 3.75]] },
  waltz: { name: '圆舞曲鼓', plain: '底鼓在第一拍，闭镲在二、三拍', bar: () => [[36, 0], [42, 1], [42, 2]] },
  tango: { name: '探戈鼓', plain: '底鼓跟着哈巴涅拉节奏走', bar: B => [[36, 0], [37, 0.75], [36, 1], [37, 1.5], ...(B === 4 ? [[36, 2], [37, 2.75], [36, 3], [37, 3.5]] : [])] },
  epic: { name: '史诗鼓', plain: '底鼓像战鼓一样隆隆地打，吊镲在段落开头炸开', bar: B => B === 4 ? [[36, 0], [36, 0.75], [36, 1.5], [38, 2], [36, 2.5], [36, 3], [38, 3.5]] : [[36, 0], [36, 1], [38, 2]] },
};
export function drumLine(ctx, out, name) {
  const D = DRUMS[name] || DRUMS.rock, B = ctx.B;
  for (let b = 0; b * B < ctx.end - ctx.start - 1e-6; b++) {
    const t0 = ctx.start + b * B, lastBar = (b + 1) * B >= ctx.end - ctx.start - 1e-6;
    if (b === 0 && ctx.energy > 0.5) out.push({ p: 49, t: t0, d: 1, v: 0.8 });
    let pat = D.bar(B); if (ctx.energy < 0.35) pat = pat.filter(([n, o]) => n === 36 ? o === 0 : n !== 38 || true).filter((_, i) => i % 2 === 0);
    if (lastBar && ctx.fill && B >= 3) pat = [...pat.filter(([, o]) => o < B - 1), ...[0, 0.25, 0.5, 0.75].map(x => [38, B - 1 + x])];
    pat.forEach(([n, o]) => out.push({ p: n, t: t0 + o, d: 0.2, v: (n === 36 ? 0.85 : n === 38 ? 0.75 : n === 42 || n === 51 ? 0.5 : 0.6) }));
  }
}
