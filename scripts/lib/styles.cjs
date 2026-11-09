// 10 种风格的「作曲配方」。每个都是 (种子) → 一首曲子 + 一份「我是怎么算的」记录。
// 同一个种子永远生成同一首；换种子就是换一首。
(function () {
  // ---------------- 小工具 ----------------
  const RNG = seed => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  const NAMES = ['C', '升C', 'D', '降E', 'E', 'F', '升F', 'G', '降A', 'A', '降B', 'B'];
  const SHORT = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
  const pcOf = p => ((p % 12) + 12) % 12;
  const nm = p => SHORT[pcOf(p)] + (Math.floor(p / 12) - 1);
  const pick = (r, a) => a[Math.floor(r() * a.length)];
  const inPcs = (pcs, lo, hi) => { const o = []; for (let m = lo; m <= hi; m++) if (pcs.includes(pcOf(m))) o.push(m); return o; };
  const nearest = (pcs, target, lo = 0, hi = 127) => inPcs(pcs, lo, hi).reduce((a, b) => (Math.abs(b - target) < Math.abs(a - target) ? b : a));
  const tr = (pcs, k) => pcs.map(x => pcOf(x + k));
  const iv = (a, b) => pcOf(b - a);
  const SCALES = {
    major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10], harmonic: [0, 2, 3, 5, 7, 8, 11],
    penta: [0, 2, 4, 7, 9], whole: [0, 2, 4, 6, 8, 10], blues: [0, 3, 5, 6, 7, 10], dorian: [0, 2, 3, 5, 7, 9, 10], lydian: [0, 2, 4, 6, 7, 9, 11],
  };
  const Q = { M: [0, 4, 7], m: [0, 3, 7], d: [0, 3, 6], A: [0, 4, 8], '7': [0, 4, 7, 10], M7: [0, 4, 7, 11], m7: [0, 3, 7, 10], h7: [0, 3, 6, 10], '9': [0, 4, 7, 10, 14] };
  const chord = (root, q) => Q[q].map(x => pcOf(root + x));
  const N = (p, t, d, v, role) => ({ p, t, d, v, role });
  const keyName = (pc, mode) => NAMES[pc] + (mode === 'minor' ? ' 小调' : ' 大调');
  const swing = (spb, ratio = 2 / 3) => b => { const f = Math.floor(b), x = b - f; return (f + (x < 0.5 ? x / 0.5 * ratio : ratio + (x - 0.5) / 0.5 * (1 - ratio))) * spb; };

  const STYLES = [];
  const add = s => STYLES.push(s);

  // ============ 1 巴洛克 · 三声部卡农（巴赫式）============
  add({
    id: 'canon', era: 'baroque', name: '三声部卡农', who: '巴赫、帕赫贝尔',
    sound: '同一段旋律，三个声部错开时间进来，像三个人轮唱，叠在一起却处处和谐。',
    recipe: ['先写一段旋律，切成慢、中、快三截（A、B、C）', '三个声部都按 A→B→C 唱，但一个比一个晚 4 小节进来', '所以任何时刻同时响的，都是 A、B、C 各一截：只要这三截叠起来和谐，整首就和谐', 'A 随机挑和弦里的音；B、C 让电脑随机写几万遍，按规则打分，留分最高的'],
    roles: { high: { name: '高声部', inst: 'organ' }, mid: { name: '中声部', inst: 'organ' }, low: { name: '低声部', inst: 'organ' } },
    gen(seed) {
      const r = RNG(seed), steps = [];
      const tonic = pick(r, [0, 2, 7, 9]), k = tonic > 6 ? tonic - 12 : tonic;
      const PROG = [
        { name: 'i – iv – V – i – VI – iv – V – V7', ch: [[0, 'm'], [5, 'm'], [7, 'M'], [0, 'm'], [8, 'M'], [5, 'm'], [7, 'M'], [7, '7']] },
        { name: 'i – VII – VI – V – i – iv – V – V7', ch: [[0, 'm'], [10, 'M'], [8, 'M'], [7, 'M'], [0, 'm'], [5, 'm'], [7, 'M'], [7, '7']] },
      ];
      const prog = pick(r, PROG), H = prog.ch.map(([rt, q]) => chord(rt + tonic, q));
      steps.push(`调：<b>${keyName(tonic, 'minor')}</b>。和弦进行（每半小节一个）：${prog.name}`);
      const LO = 55 + k, HI = 74 + k;
      // A：每个和弦挑一个和弦音，尽量离上一个音近（像唱歌，不乱跳）
      const A = [];
      H.forEach((h, i) => { const c = inPcs(h, LO + 5, HI).filter(p => !A.length || (Math.abs(p - A[i - 1]) <= 5 && p !== A[i - 1])); A.push(c.length ? pick(r, c) : nearest(h, A[i - 1] || 67 + k, LO, HI)); });
      steps.push(`主题 A（随机挑和弦音）：${A.map(nm).join(' ')}`);
      const scaleFor = ci => tr(prog.ch[ci][0] === 7 ? SCALES.harmonic : SCALES.minor, tonic);
      const genB = () => { const B = []; for (let b = 0; b < 16; b++) { const ci = b >> 1; let c = inPcs(H[ci], LO, HI).filter(p => !B.length || (Math.abs(p - B[b - 1]) <= 7 && p !== B[b - 1])); if (b % 2 === 0) c = c.filter(p => pcOf(p) !== pcOf(A[ci])); if (!c.length) return null; B.push(pick(r, c)); } return B; };
      const genC = B => { const C = []; for (let e = 0; e < 32; e++) { const ci = e >> 2; if (e % 2 === 0) { let c = inPcs(H[ci], LO, HI).filter(p => !C.length || (Math.abs(p - C[e - 1]) <= 7 && p !== C[e - 1])); if (e % 4 === 0) c = c.filter(p => pcOf(p) !== pcOf(A[ci]) && pcOf(p) !== pcOf(B[e >> 1])); if (!c.length) return null; C.push(pick(r, c)); } else { const c = inPcs(scaleFor(ci), LO, HI).filter(p => Math.abs(p - C[e - 1]) <= 2 && p !== C[e - 1]); C.push(pick(r, c)); } } return C; };
      const score = (B, C) => {
        const rows = []; for (let b = 0; b < 16; b++) rows.push([A[b >> 1], B[b], C[b * 2]]);
        const s = { 三和弦: 0, 平行五八度: 0, 大跳: 0, 反向: 0 };
        for (let b = 0; b < 16; b += 2) if (new Set(rows[b].map(pcOf)).size < 3) s.三和弦 -= 30;
        for (let b = 0; b < 15; b++) for (const [i, j] of [[0, 1], [0, 2], [1, 2]]) { const x = rows[b], y = rows[b + 1]; if (x[i] === y[i] && x[j] === y[j]) continue; const a1 = iv(x[i], x[j]); if (a1 === iv(y[i], y[j]) && [0, 5, 7].includes(a1)) s.平行五八度 -= 40; }
        for (let q = 1; q < 16; q++) if (Math.abs(B[q] - B[q - 1]) > 4) s.大跳 -= 2;
        for (let q = 1; q < 32; q++) if (Math.abs(C[q] - C[q - 1]) > 4) s.大跳 -= 3;
        for (let b = 0; b < 15; b++) { const d1 = Math.sign(rows[b + 1][1] - rows[b][1]), d2 = Math.sign(rows[b + 1][2] - rows[b][2]); if (d1 && d2 && d1 !== d2) s.反向 += 1; }
        s.总分 = s.三和弦 + s.平行五八度 + s.大跳 + s.反向; return s;
      };
      let best = null, bs = null, ok = 0; const TRIES = 40000;
      for (let t = 0; t < TRIES; t++) { const B = genB(); if (!B) continue; const C = genC(B); if (!C) continue; ok++; const s = score(B, C); if (!bs || s.总分 > bs.总分) { bs = s; best = { B, C }; } }
      steps.push(`B、C：电脑随机写了 ${TRIES.toLocaleString()} 遍，其中 ${ok.toLocaleString()} 遍走完（其余走进死路作废）。最高分 <b>${bs.总分}</b> = 完整三和弦 ${bs.三和弦}、平行五八度 ${bs.平行五八度}、大跳 ${bs.大跳}、反向运动 +${bs.反向}`);
      const ph = { A: A.map((p, i) => [p, i * 2, 2]), B: best.B.map((p, i) => [p, i, 1]), C: best.C.map((p, i) => [p, i * 0.5, 0.5]) };
      const notes = [], roles = ['high', 'mid', 'low'], order = ['A', 'B', 'C'];
      roles.forEach((role, vi) => { for (let seg = vi, q = 0; seg < 5; seg++, q++) for (const [p, t, d] of ph[order[q % 3]]) notes.push(N(p + [12, 0, -12][vi], seg * 16 + t, d * 0.97, [0.75, 0.68, 0.66][vi] * (t % 4 === 0 ? 1.08 : 1), role)); });
      const third = pcOf(tonic + 4);
      notes.push(N(nearest([third], 76 + k, 70, 82), 80, 4, 0.8, 'high'), N(nearest([pcOf(tonic + 7)], 67 + k, 60, 72), 80, 4, 0.75, 'mid'), N(nearest([tonic], 48 + k, 42, 54), 80, 4, 0.8, 'low'));
      steps.push('三个声部各晚 4 小节进来，分别高一个八度、原位、低一个八度；最后一个和弦把小调的三音升高半音，变成大三和弦（巴洛克常用的「辟卡迪三度」）');
      return { bpm: 76, meter: '4/4', key: keyName(tonic, 'minor'), notes, steps };
    },
  });

  // ============ 2 巴洛克 · 五度圈模进（维瓦尔第式）============
  add({
    id: 'sequence', era: 'baroque', name: '五度圈模进', who: '维瓦尔第、亨德尔',
    sound: '一个短小的音型像台阶一样一级一级往下挪，乐队齐奏和独奏轮流，充满冲劲。',
    recipe: ['和弦按「五度圈」走：每个和弦的根音比上一个低五度（等于高四度）', '写一个 8 个音的小音型，记成「和弦里的第几个音」', '每换一个和弦，把同一个音型整体平移过去——形状不变，高度变，这叫「模进」', '整首分三段：乐队齐奏 → 独奏 → 乐队齐奏（「回旋」）'],
    roles: { solo: { name: '独奏旋律', inst: 'strings' }, inner: { name: '内声部', inst: 'strings' }, continuo: { name: '通奏低音和弦', inst: 'harpsichord' }, bass: { name: '低音', inst: 'strings' } },
    gen(seed) {
      const r = RNG(seed), steps = [];
      const tonic = pick(r, [9, 2, 7, 4]), k = tonic > 6 ? tonic - 12 : tonic;
      const CIRCLE = [[0, 'm'], [5, 'm'], [10, 'M'], [3, 'M'], [8, 'M'], [2, 'd'], [7, 'M'], [0, 'm']];
      const H = CIRCLE.map(([rt, q]) => chord(rt + tonic, q));
      steps.push(`调：<b>${keyName(tonic, 'minor')}</b>。和弦：i – iv – VII – III – VI – ii° – V – i（根音一路下五度/上四度，像在一个圆上转圈）`);
      const SHAPES = [[0, 1, 2, 3, 2, 1, 0, 1], [0, 2, 1, 3, 2, 4, 3, 2], [2, 1, 0, 1, 2, 3, 2, 1], [0, 0, 2, 2, 1, 1, 3, 3], [3, 2, 1, 0, 1, 2, 3, 4]];
      const shape = pick(r, SHAPES);
      steps.push(`音型（和弦里的第几个音，0 = 根音）：[${shape.join(', ')}]，每个和弦都用同一个形状`);
      const notes = [];
      let anchor = 76 + k;
      const tone = (h, idx, base) => { const ext = []; for (let o = -2; o <= 2; o++) h.forEach(pc => ext.push(base - pcOf(base - pc) + o * 12)); ext.sort((a, b) => a - b); const root = ext.filter(p => pcOf(p) === h[0]).reduce((a, b) => Math.abs(b - base) < Math.abs(a - base) ? b : a); const i0 = ext.indexOf(root); return ext[i0 + idx]; };
      const section = (bar0, soloV, tutti) => {
        H.forEach((h, b) => {
          const t0 = (bar0 + b) * 4;
          anchor = nearest([h[0]], anchor, 64 + k, 82 + k);
          shape.forEach((ix, j) => notes.push(N(tone(h, ix, anchor), t0 + j * 0.5, 0.48, soloV * (j % 2 ? 0.85 : 1), 'solo')));
          if (tutti) for (let j = 0; j < 8; j++) notes.push(N(nearest([h[1]], 64 + k, 58 + k, 70 + k), t0 + j * 0.5, 0.4, 0.45, 'inner'));
          const vo = h.map(pc => nearest([pc], 60 + k, 55 + k, 67 + k));
          [0, 2].forEach(bt => vo.forEach(p => notes.push(N(p, t0 + bt, 1.6, tutti ? 0.5 : 0.35, 'continuo'))));
          [0, 1, 2, 3].forEach(bt => notes.push(N(nearest([bt === 2 ? h[2] : h[0]], 43 + k, 36 + k, 50 + k), t0 + bt, 0.9, tutti ? 0.62 : 0.45, 'bass')));
        });
      };
      section(0, 0.72, true); section(8, 0.8, false); section(16, 0.75, true);
      notes.push(N(nearest([tonic], 69 + k, 64 + k, 76 + k), 96, 3, 0.8, 'solo'), N(nearest([tonic], 45 + k, 38 + k, 50 + k), 96, 3, 0.7, 'bass'));
      chord(tonic, 'M').forEach(pc => notes.push(N(nearest([pc], 62 + k, 56 + k, 68 + k), 96, 3, 0.5, 'continuo')));
      steps.push('三段：第 1–8 小节乐队齐奏（内声部一直重复同一个音推着走）→ 第 9–16 小节独奏，乐队退下 → 第 17–24 小节乐队回来。结尾同样落在大三和弦上');
      return { bpm: 108, meter: '4/4', key: keyName(tonic, 'minor'), notes, steps };
    },
  });

  // ============ 3 古典 · 骰子小步舞曲（莫扎特式）============
  add({
    id: 'dice', era: 'classical', name: '骰子小步舞曲', who: '莫扎特（据说）、海顿',
    sound: '三拍子的宫廷舞曲，「嘣-嚓-嚓」，旋律清楚对称。1792 年出版的《音乐骰子游戏》就是这么玩的。',
    recipe: ['事先写好一张表：16 个小节，每个小节准备 11 种写法（全部配同一个和弦，所以怎么拼都和谐）', '每个小节掷两颗骰子，点数之和 2–12，正好对应 11 种写法', '前 8 小节停在「悬着」的属和弦上，后 8 小节落回主和弦', '可能拼出的曲子有 11¹⁶ ≈ 4.6 亿亿首'],
    roles: { melody: { name: '旋律', inst: 'piano' }, accomp: { name: '伴奏（嘣嚓嚓）', inst: 'piano' } },
    gen(seed) {
      const r = RNG(seed), steps = [];
      const tonic = pick(r, [0, 5, 7, 2, 10]), k = tonic > 6 ? tonic - 12 : tonic;
      const PLAN = [[0, 'M'], [7, '7'], [0, 'M'], [5, 'M'], [0, 'M'], [7, '7'], [0, 'M'], [7, 'M'], [7, '7'], [0, 'M'], [5, 'M'], [0, 'M'], [2, 'm'], [7, '7'], [0, 'M'], [0, 'M']];
      steps.push(`调：<b>${keyName(tonic, 'major')}</b>，三拍子。16 个小节的和弦是固定的：${PLAN.map(([rt, q]) => ({ 0: 'I', 5: 'IV', 7: 'V', 2: 'ii' }[rt] + (q === '7' ? '7' : ''))).join(' ')}`);
      // 表：用一个固定种子生成（就像 1792 年那张印好的表），只有骰子是随机的
      const T = RNG(1792), RHY = [[1, 1, 1], [2, 1], [0.5, 0.5, 1, 1], [1, 0.5, 0.5, 1], [0.5, 0.5, 0.5, 0.5, 1], [1.5, 0.5, 1]];
      const sc = tr(SCALES.major, tonic);
      const table = PLAN.map(([rt, q], bar) => Array.from({ length: 11 }, () => {
        const h = chord(rt + tonic, q), last = bar === 15, half = bar === 7;
        const rhy = last ? [3] : half ? pick(T, [[2, 1], [3]]) : pick(T, RHY);
        let p = nearest(h, 72 + k + Math.round((T() - 0.5) * 8), 65 + k, 86 + k), t = 0; const out = [];
        rhy.forEach((d, i) => {
          if (i > 0) { const onBeat = Math.abs(t - Math.round(t)) < 1e-6; p = onBeat ? nearest(h, p + Math.round((T() - 0.5) * 9), 65 + k, 86 + k) : nearest(sc, p + (T() < 0.5 ? -2 : 2), 65 + k, 86 + k); }
          if (last) p = nearest([tonic], 72 + k, 65 + k, 80 + k);
          out.push([p, t, d]); t += d;
        });
        return out;
      }));
      const notes = [], rolls = [];
      PLAN.forEach(([rt, q], bar) => {
        const d1 = 1 + Math.floor(r() * 6), d2 = 1 + Math.floor(r() * 6), s = d1 + d2; rolls.push(`${bar + 1}:${d1}+${d2}=${s}`);
        for (const [p, t, d] of table[bar][s - 2]) notes.push(N(p, bar * 3 + t, d * 0.95, t === 0 ? 0.75 : 0.62, 'melody'));
        const h = chord(rt + tonic, q);
        notes.push(N(nearest([h[0]], 48 + k, 40 + k, 52 + k), bar * 3, bar === 15 ? 3 : 0.9, 0.6, 'accomp'));
        if (bar < 15) [1, 2].forEach(bt => h.slice(1, 3).forEach(pc => notes.push(N(nearest([pc], 60 + k, 55 + k, 66 + k), bar * 3 + bt, 0.5, 0.42, 'accomp'))));
      });
      steps.push(`掷骰子（小节:两颗骰子=点数 → 表里第几种写法）：<br>${rolls.join('　')}`);
      steps.push('同一个调换种子再生成，表不变、骰子变——这正是 1792 年那本书的玩法。');
      return { bpm: 132, meter: '3/4', key: keyName(tonic, 'major'), notes, steps };
    },
  });

  // ============ 4 古典 · 问答乐句 + 阿尔贝蒂低音（莫扎特式）============
  add({
    id: 'period', era: 'classical', name: '一问一答的主题', who: '莫扎特、海顿、早期贝多芬',
    sound: '右手唱一句「问」，停在悬着的地方；再唱一句「答」，开头一样，结尾落稳。左手一直「低-高-中-高」地分解和弦。',
    recipe: ['8 小节分两半：前 4 小节是「问」，最后停在属和弦（V）上，听着没说完', '后 4 小节是「答」：开头两小节照抄「问」，结尾换成落回主和弦（I）', '旋律在强拍上用和弦音，弱拍用音阶里的经过音把它们连起来', '左手阿尔贝蒂低音：每个和弦按「根音-五音-三音-五音」反复', '整段再来一遍，在相隔三度的两个音中间插一个经过音当装饰'],
    roles: { melody: { name: '右手旋律', inst: 'piano' }, alberti: { name: '左手阿尔贝蒂', inst: 'piano' } },
    gen(seed) {
      const r = RNG(seed), steps = [];
      const tonic = pick(r, [0, 7, 2, 5, 10]), k = tonic > 6 ? tonic - 12 : tonic, sc = tr(SCALES.major, tonic);
      const HAR = [[[0, 'M']], [[0, 'M']], [[5, 'M']], [[7, 'M']], [[0, 'M']], [[0, 'M']], [[5, 'M'], [7, '7']], [[0, 'M']]];
      steps.push(`调：<b>${keyName(tonic, 'major')}</b>。和弦：I | I | IV | V ‖ I | I | IV V7 | I`);
      const RHY = [[2, 1, 1], [1, 0.5, 0.5, 2], [1, 1, 1, 1], [1.5, 0.5, 2], [1, 1, 2]];
      const bars = [];
      let p = nearest([tonic, pcOf(tonic + 4)], 72 + k, 67 + k, 79 + k);
      for (let b = 0; b < 8; b++) {
        if (b === 4 || b === 5) { bars.push(bars[b - 4]); p = bars[b][bars[b].length - 1][0]; continue; }
        const h = b === 6 ? null : chord(HAR[b][0][0] + tonic, HAR[b][0][1]);
        const rhy = b === 3 || b === 7 ? [1, 1, 2] : pick(r, RHY), out = []; let t = 0;
        rhy.forEach((d, i) => {
          const hh = b === 6 ? chord(HAR[6][t < 2 ? 0 : 1][0] + tonic, HAR[6][t < 2 ? 0 : 1][1]) : h;
          const strong = Math.abs(t - Math.round(t)) < 1e-6 && t % 1 === 0;
          if (b === 3 && i === rhy.length - 1) p = nearest([pcOf(tonic + 7), pcOf(tonic + 11), pcOf(tonic + 2)], p, 67 + k, 81 + k);
          else if (b === 7 && i === rhy.length - 1) p = nearest([tonic], p, 67 + k, 79 + k);
          else p = strong ? nearest(hh, p + Math.round((r() - 0.5) * 10), 67 + k, 84 + k) : nearest(sc, p + (r() < 0.5 ? -2 : 2), 67 + k, 84 + k);
          out.push([p, t, d]); t += d;
        });
        bars.push(out);
      }
      steps.push(`问句（第 1–4 小节）最后一个音落在 ${nm(bars[3][bars[3].length - 1][0])}（属和弦里的音 = 悬着）；答句第 5–6 小节照抄第 1–2 小节，第 8 小节落在主音 ${nm(bars[7][bars[7].length - 1][0])}`);
      const notes = [];
      const ALB = h => [h[0], h[2], h[1], h[2]];
      for (let pass = 0; pass < 2; pass++) bars.forEach((bar, b) => {
        const t0 = pass * 32 + b * 4;
        bar.forEach(([pp, t, d], i) => {
          const nx = bar[i + 1];
          if (pass === 1 && nx && d >= 1 && Math.abs(nx[0] - pp) >= 3 && Math.abs(nx[0] - pp) <= 4) {
            notes.push(N(pp, t0 + t, d / 2, 0.72, 'melody'), N(nearest(sc, (pp + nx[0]) / 2, 0, 127), t0 + t + d / 2, d / 2 * 0.95, 0.6, 'melody'));
          } else notes.push(N(pp, t0 + t, d * 0.95, t === 0 ? 0.76 : 0.66, 'melody'));
        });
        HAR[b].forEach(([rt, q], hi) => {
          const h = chord(rt + tonic, q), span = 4 / HAR[b].length;
          for (let e = 0; e < span * 2; e++) { const pc = ALB(h)[e % 4]; notes.push(N(nearest([pc], e % 4 === 0 ? 50 + k : 57 + k, 45 + k, 64 + k), t0 + hi * span + e * 0.5, 0.48, e % 4 === 0 ? 0.5 : 0.38, 'alberti')); }
        });
      });
      steps.push('第二遍：凡是两个音相隔三度（3–4 个半音）、而且前一个音够长，就在中间插一个音阶里的经过音');
      return { bpm: 112, meter: '4/4', key: keyName(tonic, 'major'), notes, steps };
    },
  });

  // ============ 5 浪漫 · 动机发展（贝多芬式）============
  add({
    id: 'motif', era: 'romantic', name: '一个动机打天下', who: '贝多芬、勃拉姆斯',
    sound: '只用一个四五个音的小动机，翻来覆去地变：换高度、换声部、拆碎、越推越响，最后从黑暗冲到光明。',
    recipe: ['随机挑一个节奏型（比如「短短短长」）和一个音高走向，组成动机', '变化 1 · 移位：整个动机加一个常数，换个高度再说一遍', '变化 2 · 换声部：同一个动机交给高、中、低声部轮流说', '变化 3 · 截断：只留前半截，一级一级往上推，力度一路加大', '结尾：小调换成同名大调，极强收束'],
    roles: { motif: { name: '动机', inst: 'strings' }, harmony: { name: '和声', inst: 'horn' }, bass: { name: '低音', inst: 'strings' } },
    gen(seed) {
      const r = RNG(seed), steps = [];
      const tonic = pick(r, [0, 7, 5, 2]), k = tonic > 6 ? tonic - 12 : tonic;
      const RH = pick(r, [{ d: [0.5, 0.5, 0.5, 2.5], n: '短短短长' }, { d: [0.75, 0.25, 0.5, 2.5], n: '长-短-短-长（附点）' }, { d: [0.5, 0.5, 1, 2], n: '短短-中-长' }, { d: [1, 0.5, 0.5, 2], n: '中-短短-长' }]);
      const SH = pick(r, [[0, 0, 0, -4], [0, 0, 0, -3], [0, 1, 0, -5], [0, -1, 0, 3], [0, 2, 3, -4]]);
      steps.push(`动机：节奏「${RH.n}」，音高相对第一个音的走向 [${SH.join(', ')}]（单位：半音）`);
      const notes = [], sc = tr(SCALES.harmonic, tonic);
      const motif = (start, base, v, role, oct = [0]) => { let t = start; RH.d.forEach((d, i) => { const p = nearest(sc, base + SH[i], 0, 127); oct.forEach(o => notes.push(N(p + o, t, d * 0.92, v, role))); t += d; }); return t; };
      const g = 67 + k;
      let t = motif(0, g, 1, 'motif', [0, -12]);
      motif(t, g - 2, 1, 'motif', [0, -12]);
      steps.push('第 1–2 小节：动机齐奏，极强；第二次整体低 2 个半音（移位）');
      const CH = [[0, 'm'], [8, 'M'], [5, 'm'], [7, 'M']];
      CH.forEach(([rt, q], i) => {
        const t0 = 9 + i * 4, h = chord(rt + tonic, q);
        for (let e = 0; e < 8; e++) h.forEach(pc => notes.push(N(nearest([pc], 62 + k, 55 + k, 69 + k), t0 + e * 0.5, 0.45, 0.2, 'harmony')));
        notes.push(N(nearest([h[0]], 43 + k, 36 + k, 50 + k), t0, 4, 0.3, 'bass'));
        motif(t0, nearest([h[0], h[2]], [79, 67, 55, 48][i] + k, 0, 127), 0.32 + i * 0.03, ['motif', 'motif', 'bass', 'bass'][i]);
      });
      steps.push('第 3–6 小节：突然变轻；和弦按 i – VI – iv – V 走，动机依次交给高、中、低声部（换声部）');
      const cut = RH.d.slice(0, 3), t1 = 25;
      for (let i = 0; i < 7; i++) {
        const base = nearest(sc, 60 + k + [0, 2, 3, 5, 7, 8, 11][i], 0, 127), v = 0.3 + 0.65 * i / 6;
        let tt = t1 + i * 1.5; cut.forEach(d => { notes.push(N(base, tt, d * 0.9, v, 'motif'), N(base + 12, tt, d * 0.9, v * 0.9, 'motif')); tt += d; });
        notes.push(N(nearest([pcOf(tonic + 7)], 31 + k, 26 + k, 38 + k), t1 + i * 1.5, 1.4, 0.3 + 0.5 * i / 6, 'bass'));
      }
      steps.push(`第 7–8 小节：截断，只留动机前三个音，一级一级往上推 7 次；力度 v = 0.3 + 0.65 × 第几次 ÷ 6，从 0.30 推到 0.95`);
      const maj = chord(tonic, 'M');
      motif(36, 43 + k, 1, 'bass', [0, -12]);
      maj.forEach(pc => notes.push(N(nearest([pc], 76 + k, 70 + k, 84 + k), 37.5, 3.5, 0.95, 'harmony')));
      [41, 42, 43].forEach((tt, i) => { maj.forEach(pc => notes.push(N(nearest([pc], 74 + k, 67 + k, 84 + k), tt, i === 2 ? 4 : 0.85, 1, 'motif'))); notes.push(N(nearest([tonic], 36 + k, 30 + k, 42 + k), tt, i === 2 ? 4 : 0.85, 1, 'bass')); });
      steps.push(`结尾：${NAMES[tonic]} 小三和弦 {${chord(tonic, 'm').map(x => NAMES[x]).join(' ')}} 的中间那个音升高半音 → ${NAMES[tonic]} 大三和弦 {${maj.map(x => NAMES[x]).join(' ')}}，极强`);
      return { bpm: 104, meter: '4/4', key: keyName(tonic, 'minor'), notes, steps };
    },
  });

  // ============ 6 浪漫 · 夜曲（肖邦式）============
  add({
    id: 'nocturne', era: 'romantic', name: '夜曲', who: '肖邦、菲尔德',
    sound: '左手大跨度的分解和弦像水波，右手像人在唱歌；速度一直在「呼吸」，偶尔借一个小调的音，颜色突然暗下来。',
    recipe: ['左手每个和弦 6 个音，按相对根音 [0, 7, 16, 19, 16, 7] 个半音展开，跨度超过一个半八度，踩着踏板连成一片', '右手：长音落在和弦音上，常常往上大跳，再一级一级往下落', '第 4 小节加一串半音一路滑下来的装饰音', '第 6 小节把 IV 和弦换成 iv（借来小调的一个音）', '速度不是匀速：每个乐句先略推前、后放慢，结尾渐慢（rubato）'],
    roles: { melody: { name: '右手旋律', inst: 'piano' }, accomp: { name: '左手分解和弦', inst: 'piano' } },
    gen(seed) {
      const r = RNG(seed), steps = [];
      const tonic = pick(r, [3, 1, 8, 6]), k = tonic > 6 ? tonic - 12 : tonic, sc = tr(SCALES.major, tonic);
      const V2 = pick(r, [[[0, 'M'], [0, 'M']], [[0, 'M'], [9, 'm']]]);
      const HAR = [V2, [[5, 'M'], [0, 'M']], [[9, 'm'], [2, '7']], [[7, '7'], [7, '7']], [[0, 'M'], [0, 'M']], [[5, 'M'], [5, 'm']], [[0, 'M'], [7, '7']], [[0, 'M'], null]];
      steps.push(`调：<b>${keyName(tonic, 'major')}</b>，12/8 拍（每小节 12 个八分音符，左手每半小节换一个和弦）`);
      const notes = [];
      HAR.forEach((bar, b) => bar.forEach((c, hi) => {
        if (!c) return;
        const h = chord(c[0] + tonic, c[1]), root = nearest([h[0]], 38 + k, 33, 45);
        [0, 7, 16, 19, 16, 7].forEach((o, j) => { let p = root + o; if (j === 2 || j === 4) p = nearest([h[1]], p, 0, 127); notes.push(N(p, b * 12 + hi * 6 + j, 6 - j, j === 0 ? 0.45 : 0.32, 'accomp')); });
      }));
      ['', 7, 12, 16, 19, 24].forEach((o, j) => { if (o === '') return; notes.push(N(nearest([tonic], 38 + k, 33, 45) + o, 84 + j * 0.6, 12 - j * 0.6, 0.32, 'accomp')); });
      let p = nearest([pcOf(tonic + 7)], 70 + k, 65 + k, 76 + k);
      for (let b = 0; b < 8; b++) {
        const t0 = b * 12;
        const hOf = t => { const c = HAR[b][t < 6 ? 0 : 1] || HAR[b][0]; return chord(c[0] + tonic, c[1]); };
        if (b === 3) {
          notes.push(N(nearest(hOf(0), p, 70 + k, 82 + k), t0, 5.5, 0.6, 'melody'));
          let q = nearest(sc, p + 3, 72 + k, 86 + k); for (let j = 0; j < 12; j++) { notes.push(N(q, t0 + 6 + j * 0.5, 0.48, 0.48, 'melody')); q += j < 7 ? -1 : 1; }
          steps.push(`第 4 小节装饰音群：从 ${nm(nearest(sc, p + 3, 72 + k, 86 + k))} 起一个半音一个半音往下滑 7 步，再往回走`);
          p = q; continue;
        }
        if (b === 7) { notes.push(N(nearest([tonic], p, 67 + k, 79 + k), t0, 12, 0.6, 'melody')); continue; }
        const leap = nearest(hOf(0), p + 5 + Math.floor(r() * 5), 70 + k, 86 + k);
        notes.push(N(p, t0, 2, 0.55, 'melody'), N(leap, t0 + 2, 6, 0.66, 'melody'));
        let q = leap; [8, 9, 10, 11].forEach(tt => { q = nearest(tt === 8 ? hOf(8) : sc, q - 1.5, 62 + k, 86 + k); notes.push(N(q, t0 + tt, 1, 0.52, 'melody')); });
        if (b === 5) { const b6 = pcOf(tonic + 8); notes.push(N(nearest([b6], q + 2, 64 + k, 84 + k), t0 + 6, 2, 0.6, 'melody')); steps.push(`第 6 小节借用小调：IV 和弦 {${chord(tonic + 5, 'M').map(x => NAMES[x]).join(' ')}} 变成 iv {${chord(tonic + 5, 'm').map(x => NAMES[x]).join(' ')}}，只改了一个音`); }
        p = q;
      }
      const base = 0.34;
      const d = e => { const ph = (e % 24) / 24; let m = 1 - 0.1 * Math.sin(Math.PI * 2 * ph) + 0.12 * Math.pow(ph, 6); if (e >= 72) m *= 1 + (e - 72) * 0.025; return base * m; };
      const cum = [0]; for (let e = 0; e < 120; e++) cum.push(cum[e] + d(e));
      const time = b => { const f = Math.floor(b); return cum[Math.min(f, 119)] + (b - f) * d(f); };
      steps.push('自由速度：第 e 个八分音符占 0.34 × (1 − 0.1·sin(2π·p) + 0.12·p⁶) 秒，p 是它在乐句里的位置（0–1）；最后两小节再逐渐放慢');
      return { bpm: 60 / 0.34, meter: '12/8', key: keyName(tonic, 'major'), notes, steps, time };
    },
  });

  // ============ 7 印象派 · 全音阶与平行和弦（德彪西式）============
  add({
    id: 'debussy', era: 'impressionism', name: '雾中的平行和弦', who: '德彪西、拉威尔',
    sound: '没有明确的「家」，声音像雾和水面的反光；同一个和弦形状整块平移，竖琴一直在流动，低音一个音一直不动。',
    recipe: ['随机挑一种「没有家」的音阶：全音阶（6 个音距离全相等）或五声音阶（只有 5 个音，没有半音）', '旋律只用这个音阶里的音，长短自由，结尾也不回到主音', '平行和弦：同一个和弦形状，跟着旋律整块上下平移——巴赫规则里禁止的平行五度，德彪西故意用', '竖琴一路往上刷音阶；低音一个音从头按到尾（持续音）'],
    roles: { melody: { name: '旋律', inst: 'flute' }, planing: { name: '平行和弦', inst: 'strings' }, harp: { name: '竖琴琶音', inst: 'harp' }, pedal: { name: '持续低音', inst: 'horn' } },
    gen(seed) {
      const r = RNG(seed), steps = [];
      const root = Math.floor(r() * 12), kind = r() < 0.5 ? 'whole' : 'penta', sc = tr(SCALES[kind], root);
      const shape = kind === 'whole' ? [0, -4, -8] : [0, -5, -10];
      steps.push(kind === 'whole' ? `音阶：从 ${NAMES[root]} 开始的<b>全音阶</b> {${sc.map(x => NAMES[x]).join(' ')}}——12 个音里每隔一个挑一个，任意两个相邻音都差 2 个半音，听不出哪个是「家」` : `音阶：从 ${NAMES[root]} 开始的<b>五声音阶</b> {${sc.map(x => NAMES[x]).join(' ')}}——钢琴上相当于只弹黑键那种感觉，没有半音的摩擦`);
      steps.push(`平行和弦形状：在旋律音下面再叠 ${shape.slice(1).map(x => -x).join('、')} 个半音（${kind === 'whole' ? '增三和弦' : '四度叠置'}），整块平移`);
      const notes = [], LEN = 32;
      let p = nearest(sc, 74, 68, 82), t = 0;
      const RH = [3, 1, 2, 1.5, 0.5, 4, 2, 2];
      while (t < LEN - 4) {
        const d = pick(r, RH);
        notes.push(N(p, t, d * 0.98, 0.5 + r() * 0.15, 'melody'));
        shape.slice(1).forEach(o => notes.push(N(p + o - 2, t, d * 0.98, 0.32, 'planing')));
        notes.push(N(p - 2 - 12, t, d * 0.98, 0.3, 'planing'));
        p = nearest(sc, p + pick(r, [-3, -2, -1, 1, 2, 3, 5, -5]), 67, 84); t += d;
      }
      notes.push(N(p, t, LEN - t, 0.45, 'melody'));
      for (let b = 0; b < LEN; b += 2) { let q = nearest(sc, 48 + (b % 8), 40, 60); for (let j = 0; j < 8; j++) { notes.push(N(q, b + j * 0.25, 1.5, 0.28 + j * 0.02, 'harp')); q = nearest(sc, q + 3, 40, 90); } }
      notes.push(N(nearest([root], 40, 34, 46), 0, LEN, 0.3, 'pedal'));
      steps.push(`持续低音：${nm(nearest([root], 40, 34, 46))} 从头按到尾；竖琴每两拍从低到高刷 8 个音阶里的音`);
      steps.push(`旋律最后停在 ${nm(p)}，故意不落回 ${NAMES[root]}——没有终止感，像淡出`);
      return { bpm: 58, meter: '自由', key: kind === 'whole' ? '全音阶（无调）' : '五声音阶', notes, steps };
    },
  });

  // ============ 8 印象派 · 两个和弦摇摆（萨蒂式）============
  add({
    id: 'satie', era: 'impressionism', name: '慢三拍的两个和弦', who: '萨蒂（《裸体舞曲》）',
    sound: '极慢的三拍子，左手在两个柔和的七和弦之间来回摇，右手一个人慢慢地哼。简单到近乎冷淡。',
    recipe: ['只用两个「大七和弦」（大三和弦再加一个大七度，听起来柔软、略带忧郁），根音相隔纯五度，每小节换一次', '左手：第一拍弹一个低音，第二、三拍弹和弦', '右手前 4 小节不出现；之后用这两个和弦共同的音阶写长音为主的旋律，大多一级一级往下走'],
    roles: { melody: { name: '旋律', inst: 'piano' }, bass: { name: '低音', inst: 'piano' }, chords: { name: '和弦', inst: 'piano' } },
    gen(seed) {
      const r = RNG(seed), steps = [];
      const a = pick(r, [7, 2, 0, 5, 9]), b = pcOf(a + 7), A = chord(a, 'M7'), B = chord(b, 'M7'), sc = tr(SCALES.major, b);
      steps.push(`两个和弦：${NAMES[a]}maj7 {${A.map(x => NAMES[x]).join(' ')}} ↔ ${NAMES[b]}maj7 {${B.map(x => NAMES[x]).join(' ')}}，根音差 7 个半音（纯五度）`);
      const notes = [], BARS = 20;
      for (let i = 0; i < BARS; i++) {
        const h = i % 2 ? A : B, t0 = i * 3;
        notes.push(N(nearest([h[0]], 43, 36, 48), t0, 0.95, 0.5, 'bass'));
        h.slice(1).forEach(pc => notes.push(N(nearest([pc], 62, 55, 67), t0 + 1, 1.9, 0.36, 'chords')));
      }
      let p = nearest(sc, 78, 72, 84), t = 12;
      const RH = [[3], [2, 1], [1, 1, 1], [3], [2, 1]];
      while (t < BARS * 3 - 6) {
        for (const d of pick(r, RH)) { notes.push(N(p, t, d * 0.97, 0.55, 'melody')); p = nearest(sc, p + (r() < 0.75 ? -2 : 3), 66, 84); t += d; }
      }
      notes.push(N(nearest([b], p, 64, 80), t, 6, 0.5, 'melody'));
      steps.push(`旋律从第 5 小节进来，每一步有 75% 的概率往下走一级、25% 往上跳一点；最后落在 ${NAMES[b]}`);
      return { bpm: 72, meter: '3/4', key: `${NAMES[b]} 大调色彩`, notes, steps };
    },
  });

  // ============ 9 布鲁斯 · 12 小节 ============
  add({
    id: 'blues', era: 'blues', name: '12 小节布鲁斯', who: 'W.C. 汉迪、罗伯特·约翰逊、B.B. 金',
    sound: '摇摆的「长-短」节奏，固定的 12 小节和弦，旋律一句唱、一句应，带着「蓝音」的苦味。',
    recipe: ['12 小节固定和弦：I7 I7 I7 I7 | IV7 IV7 I7 I7 | V7 IV7 I7 V7（四个一组，三组）', '旋律用布鲁斯音阶：1、降3、4、降5、5、降7——那几个「降」的音就是蓝音', '歌词式的 AAB：第一句（A）在 I 上唱，第二句把同一句在 IV 上再唱一遍，第三句（B）换新的；每句唱完空两小节，让钢琴「应」一句', '摇摆：每拍里的两个八分音符不平分，前长后短（2:1）', '低音一拍一个音按「根-三-五-六」上下走；鼓在第 2、4 拍打军鼓'],
    roles: { lead: { name: '主唱旋律', inst: 'sax' }, piano: { name: '钢琴', inst: 'piano' }, bass: { name: '低音', inst: 'bass' }, drums: { name: '鼓', inst: 'drums' } },
    gen(seed) {
      const r = RNG(seed), steps = [];
      const tonic = pick(r, [4, 9, 7, 0, 5]), k = tonic > 6 ? tonic - 12 : tonic, bl = tr(SCALES.blues, tonic);
      const quick = r() < 0.5;
      const FORM = [0, quick ? 5 : 0, 0, 0, 5, 5, 0, 0, 7, 5, 0, 7];
      steps.push(`调：<b>${NAMES[tonic]}</b>。12 小节和弦：${FORM.map(x => ({ 0: 'I7', 5: 'IV7', 7: 'V7' }[x])).join(' ')}${quick ? '（第 2 小节提前去一下 IV7，叫 quick change）' : ''}`);
      steps.push(`布鲁斯音阶：{${bl.map(x => NAMES[x]).join(' ')}}`);
      const notes = [];
      const phrase = len => { const out = []; let t = 0, p = nearest(bl, 67 + k + Math.round((r() - 0.5) * 6), 60 + k, 79 + k); while (t < len) { const d = pick(r, [0.5, 0.5, 1, 1.5]); out.push([p, t, Math.min(d, len - t)]); p = nearest(bl, p + pick(r, [-3, -2, -1, 1, 2, 3]), 60 + k, 79 + k); t += d; } out[out.length - 1][0] = nearest([tonic, pcOf(tonic + 10)], out[out.length - 1][0], 60 + k, 79 + k); return out; };
      for (let ch = 0; ch < 2; ch++) {
        const A = phrase(6), B = phrase(6), c0 = ch * 48;
        [[A, 0], [A, 16], [B, 32]].forEach(([ph, t]) => ph.forEach(([p, tt, d]) => notes.push(N(p, c0 + t + tt, d * 0.92, 0.7, 'lead'))));
        [8, 24, 40].forEach(t => { const lick = phrase(3); lick.forEach(([p, tt, d]) => notes.push(N(p + 12, c0 + t + 1 + tt, d * 0.9, 0.5, 'piano'))); });
        FORM.forEach((deg, bar) => {
          const t0 = c0 + bar * 4, h = chord(tonic + deg, '7'), rootP = nearest([h[0]], 40 + k, 33, 47);
          const walk = bar % 2 === 0 ? [0, 4, 7, 9] : [10, 9, 7, 4];
          walk.forEach((o, bt) => notes.push(N(rootP + o, t0 + bt, 0.9, 0.62, 'bass')));
          [1, 3].forEach(bt => h.forEach(pc => notes.push(N(nearest([pc], 58 + k, 52 + k, 66 + k), t0 + bt, 0.4, 0.4, 'piano'))));
          for (let bt = 0; bt < 4; bt++) { notes.push(N(51, t0 + bt, 0.3, 0.45, 'drums'), N(51, t0 + bt + 0.5, 0.2, 0.3, 'drums')); if (bt % 2) notes.push(N(38, t0 + bt, 0.3, 0.55, 'drums')); else notes.push(N(36, t0 + bt, 0.3, 0.6, 'drums')); }
        });
      }
      const last = 96; chord(tonic, '9').forEach(pc => notes.push(N(nearest([pc], 62 + k, 55 + k, 72 + k), last, 3, 0.5, 'piano')));
      notes.push(N(nearest([tonic], 40 + k, 33, 47), last, 3, 0.7, 'bass'), N(nearest([tonic], 67 + k, 60 + k, 76 + k), last, 3, 0.7, 'lead'), N(36, last, 0.3, 0.7, 'drums'), N(51, last, 1, 0.5, 'drums'));
      steps.push('每段 12 小节：第 1–2 小节唱 A，第 5–6 小节在 IV7 上把 A 再唱一遍，第 9–10 小节唱 B；中间空着的地方钢琴高八度「应」一句。一共两段，每段的 A、B 都重新随机');
      steps.push('摇摆：每拍前半拍占 2/3、后半拍占 1/3（播放时自动换算成「长-短」）');
      return { bpm: 92, meter: '4/4 摇摆', key: NAMES[tonic] + ' 布鲁斯', notes, steps, time: swing(60 / 92) };
    },
  });

  // ============ 10 爵士 · ii–V–I 摇摆 ============
  add({
    id: 'jazz', era: 'jazz', name: 'ii–V–I 摇摆', who: '查理·帕克、迈尔斯·戴维斯、比尔·艾文斯',
    sound: '低音一拍一个音「走」着，鼓刷「叮-叮嗒」，钢琴零星地戳和弦，萨克斯即兴一长串八分音符。',
    recipe: ['和弦：爵士最常用的 ii7 → V7 → Imaj7（像「起-承-落」），反复变化着走', '行走低音：每拍一个音；第一拍弹根音，中间两拍走和弦音或音阶，第四拍从上或下半音「贴」到下一个和弦的根音', '钢琴只弹每个和弦的三音和七音（再加一个九音）——这两个音决定和弦的性格，叫「导音」', '萨克斯即兴：正拍尽量踩和弦音，反拍用经过音；一句长短随机，句与句之间留空换气', '摇摆 + 鼓：叮叮镲打「叮、叮-嗒、叮、叮-嗒」，踩镲在第 2、4 拍'],
    roles: { sax: { name: '萨克斯即兴', inst: 'sax' }, piano: { name: '钢琴和弦', inst: 'piano' }, bass: { name: '行走低音', inst: 'bass' }, drums: { name: '鼓', inst: 'drums' } },
    gen(seed) {
      const r = RNG(seed), steps = [];
      const tonic = pick(r, [0, 5, 10, 3, 7]), k = tonic > 6 ? tonic - 12 : tonic;
      const tritone = r() < 0.5;
      const FORM = [[[2, 'm7']], [[7, '7']], [[0, 'M7']], [[0, 'M7']], [[4, 'm7'], [9, '7']], [[2, 'm7'], [tritone ? 1 : 7, '7']], [[0, 'M7']], [[2, 'm7'], [7, '7']]];
      const lab = ([rt, q]) => ({ 0: 'Imaj7', 2: 'ii7', 4: 'iii7', 7: 'V7', 9: 'VI7', 1: '♭II7' }[rt] || '?');
      steps.push(`调：<b>${keyName(tonic, 'major')}</b>。8 小节和弦：${FORM.map(b => b.map(lab).join(' ')).join(' | ')}${tritone ? '。第 6 小节的 V7 换成了 ♭II7（「三全音替代」：两个和弦共享同一对导音）' : ''}`);
      const notes = [], spans = [];
      for (let ch = 0; ch < 2; ch++) FORM.forEach((bar, b) => bar.forEach((c, i) => spans.push({ t: ch * 32 + b * 4 + i * (4 / bar.length), len: 4 / bar.length, h: chord(c[0] + tonic, c[1]) })));
      spans.push({ t: 64, len: 4, h: chord(tonic, 'M7') });
      // 行走低音
      let bp = nearest([spans[0].h[0]], 41 + k, 33, 50);
      spans.forEach((s, si) => {
        const next = spans[si + 1];
        for (let bt = 0; bt < s.len; bt++) {
          let p;
          if (bt === 0) p = nearest([s.h[0]], bp, 33, 52);
          else if (bt === s.len - 1 && next) { const target = nearest([next.h[0]], bp, 33, 52); p = target + (r() < 0.5 ? 1 : -1); }
          else p = nearest(r() < 0.6 ? s.h : tr(SCALES.major, tonic), bp + (r() < 0.5 ? 2 : -2), 33, 52);
          notes.push(N(p, s.t + bt, 0.9, bt === 0 ? 0.7 : 0.6, 'bass')); bp = p;
        }
        // 钢琴导音：三音 + 七音 + 九音，节奏随机挑「查尔斯顿」或「抢拍」
        const shell = [s.h[1], s.h[3] ?? s.h[2], pcOf(s.h[0] + 2)].map(pc => nearest([pc], 60 + k, 53 + k, 68 + k));
        const rh = s.len === 4 ? pick(r, [[0, 1.5], [1.5, 3.5], [0, 2.5]]) : pick(r, [[0], [0.5]]);
        rh.forEach(x => shell.forEach(p => notes.push(N(p, s.t + x, 0.6, 0.45, 'piano'))));
        for (let bt = 0; bt < s.len; bt++) { const at = s.t + bt; notes.push(N(51, at, 0.3, 0.42, 'drums')); if (pcOf(Math.round(at)) % 2 === 1) { notes.push(N(51, at + 0.5, 0.2, 0.3, 'drums'), N(42, at, 0.2, 0.4, 'drums')); } notes.push(N(36, at, 0.2, 0.18, 'drums')); }
      });
      steps.push('行走低音：每拍一个音；每个和弦的第一拍 = 根音；最后一拍 = 下一个根音的上方或下方半音（「贴」过去）');
      steps.push('钢琴：每个和弦只弹三音、七音、九音（导音），节奏在「第 1 拍 + 第 2 拍后半」和「抢拍」之间随机');
      // 萨克斯即兴
      let t = 1, p = 67 + k, phrases = 0;
      const spanAt = tt => spans.reduce((a, s) => (tt >= s.t ? s : a), spans[0]);
      while (t < 62) {
        const len = 3 + Math.floor(r() * 5); phrases++;
        for (let e = 0; e < len * 2 && t < 63; e++, t += 0.5) {
          const s = spanAt(t), on = e % 2 === 0;
          const pool = on ? s.h.concat([pcOf(s.h[0] + 2)]) : tr(SCALES.major, tonic).concat(s.h);
          p = nearest(pool, p + pick(r, on ? [-4, -3, 3, 4, -1, 2] : [-2, -1, 1, 2]), 58 + k, 79 + k);
          notes.push(N(p, t, 0.46, on ? 0.66 : 0.52, 'sax'));
        }
        notes.push(N(nearest(spanAt(t).h, p, 58 + k, 79 + k), t, 1, 0.66, 'sax'));
        t += 1 + pick(r, [1, 1.5, 2, 2.5]);
      }
      steps.push(`萨克斯：一共 ${phrases} 句，每句 3–7 拍的八分音符；正拍从和弦音 + 九音里挑，反拍从音阶里挑，句尾停在和弦音上，句间空 1–2.5 拍`);
      notes.push(N(nearest([tonic], 67 + k, 60 + k, 76 + k), 64, 4, 0.6, 'sax'));
      return { bpm: 132, meter: '4/4 摇摆', key: keyName(tonic, 'major'), notes, steps, time: swing(60 / 132) };
    },
  });


  // ======================= 扩展配方（第二批）=======================
  // 共用：在一个调式里，按和弦表写一句旋律（强拍落和弦音，弱拍走音阶）
  const phrase = (r, { sc, chords, rhythms, lo, hi, start, endPcs, beatsPerBar = 4 }) => {
    const out = []; let p = start;
    chords.forEach((h, b) => {
      const rhy = pick(r, rhythms); let t = 0;
      rhy.forEach((d, i) => {
        const last = b === chords.length - 1 && i === rhy.length - 1;
        const strong = Math.abs(t - Math.round(t)) < 1e-6 && Math.round(t) % 2 === 0;
        if (last && endPcs) p = nearest(endPcs, p, lo, hi);
        else p = strong ? nearest(h, p + Math.round((r() - 0.5) * 8), lo, hi) : nearest(sc, p + (r() < 0.5 ? -2 : 2), lo, hi);
        out.push([p, b * beatsPerBar + t, d]); t += d;
      });
    });
    return out;
  };
  const DEG = (tonic, mode) => (deg, q) => chord(tonic + deg, q);

  // ============ 11 巴洛克 · 四声部众赞歌（巴赫式）============
  add({
    id: 'chorale', era: 'baroque', name: '四声部众赞歌', who: '巴赫（371 首众赞歌）',
    sound: '教堂里的四部合唱：女高音唱一条简单的赞美诗旋律，下面三个声部一拍一个和弦地托着它，每句末尾停一下。',
    recipe: ['女高音旋律：一拍一个音，大多一级一级走；四句，第 1、3 句停在属和弦（悬着），第 2、4 句停在主和弦（落地）', '给每个旋律音配和弦：和弦里必须有这个音，而且按「功能」往前走（I 之后什么都行，V 之后多半回 I 或 vi，IV 之后去 V 或 I……）', '低音弹和弦根音；女中音、男高音从剩下的和弦音里挑离上一拍最近的，三个声部之间不超过一个八度、不交叉', '每一拍都检查：任何两个声部不许连着走平行五度或八度'],
    roles: { soprano: { name: '女高音', inst: 'choir' }, alto: { name: '女中音', inst: 'choir' }, tenor: { name: '男高音', inst: 'choir' }, bass: { name: '男低音', inst: 'choir' } },
    gen(seed) {
      const r = RNG(seed), steps = [];
      const tonic = pick(r, [0, 7, 2, 5, 10]), k = tonic > 6 ? tonic - 12 : tonic, sc = tr(SCALES.major, tonic);
      steps.push(`调：<b>${keyName(tonic, 'major')}</b>，四句，每句 8 拍，句末延长`);
      const FUNC = { 0: [0, 2, 4, 5, 7, 9], 2: [7, 5], 4: [9, 5], 5: [7, 0, 2], 7: [0, 9], 9: [2, 5, 7] }, Q = { 0: 'M', 2: 'm', 4: 'm', 5: 'M', 7: 'M', 9: 'm' }, RN = { 0: 'I', 2: 'ii', 4: 'iii', 5: 'IV', 7: 'V', 9: 'vi' };
      const sop = []; let p = nearest([pcOf(tonic + pick(r, [0, 4, 7]))], 69 + k, 64 + k, 74 + k);
      for (let ph = 0; ph < 4; ph++) for (let i = 0; i < 7; i++) {
        if (i === 6) p = nearest(ph % 2 === 0 ? [pcOf(tonic + 2), pcOf(tonic + 7), pcOf(tonic + 11)] : [tonic], p, 62 + k, 77 + k);
        else if (ph === 3 && i === 5) p = nearest([pcOf(tonic + 2), pcOf(tonic + 11)], p, 62 + k, 77 + k);
        else if (sop.length) p = nearest(sc, p + (r() < 0.8 ? pick(r, [-2, -1, 1, 2]) : pick(r, [-4, -3, 3, 4])), 62 + k, 77 + k);
        sop.push({ p, t: ph * 8 + i, d: i === 6 ? 2 : 1, end: i === 6 ? (ph % 2 === 0 ? 'half' : 'full') : i === 5 ? 'pre' : '' });
      }
      steps.push(`女高音旋律（随机，80% 一级一级走）：${sop.map(x => nm(x.p)).join(' ')}`);
      // 配和弦：按功能表随机走，句末强制 V 或 I，倒数第二拍在全终止前用 V
      let prev = 0; const prog = [];
      sop.forEach((s, i) => {
        let opts = Object.keys(Q).map(Number).filter(d => chord(tonic + d, Q[d]).includes(pcOf(s.p)));
        if (s.end === 'half') opts = opts.filter(d => d === 7).length ? [7] : opts;
        if (s.end === 'full') opts = opts.includes(0) ? [0] : opts;
        if (s.end === 'pre' && sop[i + 1]?.end === 'full' && opts.includes(7)) opts = [7];
        const good = opts.filter(d => i === 0 || FUNC[prev].includes(d) || d === prev);
        const d = good.length ? pick(r, good) : pick(r, opts.length ? opts : [0]); prog.push(d); prev = d;
      });
      steps.push(`和弦（罗马数字 = 第几级和弦）：${prog.map((d, i) => RN[d] + (sop[i].end === 'half' || sop[i].end === 'full' ? ' ‖' : '')).join(' ')}`);
      // 内声部：枚举候选，挑「动得最少、不出平行五八度、和弦音齐全」的
      const notes = [], par = (a1, b1, a2, b2) => { const i1 = pcOf(a1 - b1), i2 = pcOf(a2 - b2); return (i1 === 0 || i1 === 7) && i1 === i2 && a1 !== a2; };
      let last = null, bad = 0;
      sop.forEach((s, i) => {
        const h = chord(tonic + prog[i], Q[prog[i]]);
        const bass = inPcs([h[0]], 40 + k, 59 + k).reduce((a, b) => (last && Math.abs(b - last[3]) < Math.abs(a - last[3]) ? b : a));
        let best = null, bc = 1e9;
        for (const al of inPcs(h, 55 + k, 72 + k)) for (const te of inPcs(h, 48 + k, 67 + k)) {
          if (!(s.p >= al && al >= te && te >= bass) || s.p - al > 12 || al - te > 12) continue;
          const set = new Set([s.p, al, te, bass].map(pcOf)); let c = (set.has(h[1]) ? 0 : 20) + (set.size < 3 ? 6 : 0);
          if (last) { const v = [s.p, al, te, bass]; c += Math.abs(al - last[1]) + Math.abs(te - last[2]); for (let x = 0; x < 4; x++) for (let y = x + 1; y < 4; y++) if (par(last[x], last[y], v[x], v[y])) c += 50; }
          if (c < bc) { bc = c; best = [s.p, al, te, bass]; }
        }
        if (!best) best = [s.p, nearest(h, s.p - 5, 55 + k, 72 + k), nearest(h, s.p - 12, 48 + k, 67 + k), bass];
        if (bc >= 50) bad++;
        ['soprano', 'alto', 'tenor', 'bass'].forEach((role, v) => notes.push(N(best[v], s.t, s.d * 0.96, v === 0 ? 0.72 : 0.6, role)));
        last = best;
      });
      steps.push(`内声部：每一拍在女中音、男高音的音域里枚举所有和弦音组合，打分 = 移动距离 + 缺三音 20 分 + 平行五/八度 50 分，取最低。全曲还剩 ${bad} 处没能避开平行`);
      const time = b => { let s = 0; for (const x of sop) { if (b >= x.t + x.d) s += x.d * (x.d > 1 ? 1.5 : 1); else { s += (b - x.t) * (x.d > 1 ? 1.5 : 1); break; } } return s * 60 / 72; };
      steps.push('句末的长音再放慢一半（像合唱队在句尾换气，乐谱上的「延长记号」）');
      return { bpm: 72, meter: '4/4', key: keyName(tonic, 'major'), notes, steps, time };
    },
  });

  // ============ 12 古典 · 主题与变奏（莫扎特《小星星变奏曲》式）============
  add({
    id: 'variations', era: 'classical', name: '主题与变奏', who: '莫扎特、海顿、贝多芬',
    sound: '先唱一段简单得像儿歌的主题，然后每一遍换一种「打扮」：加花、变成小调、换节奏、让低音来唱，最后原样回来。',
    recipe: ['主题：8 小节，一拍一个音，强拍落和弦音；第 4 小节停在属和弦，第 8 小节落回主音', '变奏 1 · 加花：每个四分音符拆成两个八分音符，第二个是通往下一个音的经过音或邻音', '变奏 2 · 小调：把主题里的 3、6 级音各降半音，大调变小调，同一段旋律立刻变暗', '变奏 3 · 附点：每拍改成「长-短」（3/4 + 1/4 拍），像跳着走', '变奏 4 · 低音唱主题：主题挪到低音，右手改弹快速分解和弦', '尾声：主题原样回来，左手加厚成柱式和弦'],
    roles: { melody: { name: '旋律', inst: 'piano' }, accomp: { name: '伴奏', inst: 'piano' } },
    gen(seed) {
      const r = RNG(seed), steps = [];
      const tonic = pick(r, [0, 7, 2, 5]), k = tonic > 6 ? tonic - 12 : tonic, sc = tr(SCALES.major, tonic), D = DEG(tonic);
      const HAR = [D(0, 'M'), D(0, 'M'), D(5, 'M'), D(7, 'M'), D(0, 'M'), D(5, 'M'), D(7, '7'), D(0, 'M')];
      steps.push(`调：<b>${keyName(tonic, 'major')}</b>。主题和弦：I I IV V | I IV V7 I`);
      const theme = phrase(r, { sc, chords: HAR, rhythms: [[1, 1, 1, 1], [1, 1, 2], [2, 1, 1]], lo: 65 + k, hi: 81 + k, start: nearest([tonic], 72 + k, 65 + k, 79 + k), endPcs: [tonic] });
      theme.forEach(x => { if (x[1] >= 12 && x[1] < 16 && x[1] + x[2] >= 16) x[0] = nearest(HAR[3], x[0], 65 + k, 81 + k); });
      steps.push(`主题旋律：${theme.map(x => nm(x[0])).join(' ')}`);
      const notes = [], T0 = [0, 32, 64, 96, 128, 160];
      const acc = (t0, kind, minor) => HAR.forEach((h0, b) => {
        const h = minor ? h0.map(pc => [4, 9].includes(pcOf(pc - tonic)) ? pcOf(pc - 1) : pc) : h0, t = t0 + b * 4;
        if (kind === 'alberti') for (let e = 0; e < 8; e++) notes.push(N(nearest([[h[0], h[2], h[1], h[2]][e % 4]], 52 + k, 45 + k, 62 + k), t + e * 0.5, 0.48, 0.38, 'accomp'));
        if (kind === 'block') [0, 2].forEach(x => h.forEach(pc => notes.push(N(nearest([pc], 55 + k, 48 + k, 64 + k), t + x, 1.9, 0.42, 'accomp'))));
        if (kind === 'oompah') [0, 1, 2, 3].forEach(x => (x % 2 ? h.slice(1) : [h[0]]).forEach(pc => notes.push(N(nearest([pc], x % 2 ? 57 + k : 45 + k, 40 + k, 64 + k), t + x, 0.8, 0.42, 'accomp'))));
        if (kind === 'arp') for (let e = 0; e < 16; e++) notes.push(N(nearest([h[e % 3]], 72 + k + (e % 6 > 2 ? 4 : 0), 60 + k, 86 + k), t + e * 0.25, 0.24, 0.4, 'melody'));
        if (kind === 'thick') h.forEach(pc => [48, 55].forEach(o => notes.push(N(nearest([pc], o + k, 40 + k, 64 + k), t, 3.8, 0.45, 'accomp'))));
      });
      theme.forEach(([p, t, d]) => notes.push(N(p, t, d * 0.95, 0.72, 'melody'))); acc(0, 'alberti');
      theme.forEach(([p, t, d], i) => { const nx = theme[i + 1]?.[0] ?? p; for (let q = 0; q < d; q++) { notes.push(N(q ? nearest(sc, (p + nx) / 2, 0, 127) : p, T0[1] + t + q, 0.48, 0.7, 'melody'), N(nearest(sc, p + (nx >= p ? 2 : -2), 0, 127), T0[1] + t + q + 0.5, 0.46, 0.6, 'melody')); } }); acc(T0[1], 'alberti');
      const toMinor = p => [4, 9].includes(pcOf(p - tonic)) ? p - 1 : p;
      theme.forEach(([p, t, d]) => notes.push(N(toMinor(p), T0[2] + t, d * 0.95, 0.62, 'melody'))); acc(T0[2], 'block', true);
      theme.forEach(([p, t, d]) => { for (let q = 0; q < d; q++) notes.push(N(p, T0[3] + t + q, 0.72, 0.72, 'melody'), N(nearest(sc, p + 2, 0, 127), T0[3] + t + q + 0.75, 0.23, 0.6, 'melody')); }); acc(T0[3], 'oompah');
      theme.forEach(([p, t, d]) => notes.push(N(p - 24, T0[4] + t, d * 0.95, 0.68, 'accomp'))); acc(T0[4], 'arp');
      theme.forEach(([p, t, d]) => notes.push(N(p, T0[5] + t, d * 0.95, 0.78, 'melody'), N(p + 12, T0[5] + t, d * 0.95, 0.5, 'melody'))); acc(T0[5], 'thick');
      steps.push('变奏 1 加花（八分音符经过音）→ 变奏 2 小调（3、6 级降半音）→ 变奏 3 附点（3/4 + 1/4 拍）→ 变奏 4 主题挪到低两个八度，右手十六分音符分解和弦 → 尾声主题加八度、左手柱式和弦');
      return { bpm: 108, meter: '4/4', key: keyName(tonic, 'major'), notes, steps };
    },
  });

  // ============ 13 古典 · 回旋曲（ABACA）============
  add({
    id: 'rondo', era: 'classical', name: '回旋曲', who: '莫扎特《土耳其进行曲》、贝多芬《致爱丽丝》',
    sound: '一段好记的主旋律 A 反复回来，中间插进两段不一样的插部：一段去了明亮的属调，一段去了忧伤的关系小调。',
    recipe: ['A 段：主调上 4 小节轻快的旋律，每次回来都一模一样（这就是「回旋」）', 'B 段：转到属调（主音往上 7 个半音），更亮', 'C 段：转到关系小调（主音往下 3 个半音），更暗', '顺序 A B A C A，最后加两小节结尾'],
    roles: { melody: { name: '旋律', inst: 'flute' }, accomp: { name: '伴奏', inst: 'piano' } },
    gen(seed) {
      const r = RNG(seed), steps = [];
      const tonic = pick(r, [0, 7, 2, 9, 5]), k = tonic > 6 ? tonic - 12 : tonic;
      const sec = (root, mode) => { const D = DEG(root), sc = tr(mode === 'minor' ? SCALES.harmonic : SCALES.major, root), q = mode === 'minor' ? 'm' : 'M';
        const H = [D(0, q), D(5, mode === 'minor' ? 'm' : 'M'), D(7, '7'), D(0, q)];
        return { H, mel: phrase(r, { sc, chords: H, rhythms: [[0.5, 0.5, 1, 1, 1], [1, 0.5, 0.5, 2], [0.5, 0.5, 0.5, 0.5, 2], [1, 1, 1, 1]], lo: 67 + k, hi: 86 + k, start: nearest([root], 74 + k, 67 + k, 84 + k), endPcs: [root] }) }; };
      const A = sec(tonic, 'major'), B = sec(pcOf(tonic + 7), 'major'), C = sec(pcOf(tonic + 9), 'minor');
      steps.push(`调：<b>${keyName(tonic, 'major')}</b>。A 在 ${NAMES[tonic]} 大调，B 在 ${NAMES[pcOf(tonic + 7)]} 大调（属调），C 在 ${NAMES[pcOf(tonic + 9)]} 小调（关系小调）`);
      const notes = [], order = [['A', A], ['B', B], ['A', A], ['C', C], ['A', A]];
      order.forEach(([nmS, s], i) => {
        const t0 = i * 16;
        s.mel.forEach(([p, t, d]) => notes.push(N(p, t0 + t, d * 0.92, nmS === 'A' ? 0.72 : 0.64, 'melody')));
        s.H.forEach((h, b) => [0, 1, 2, 3].forEach(x => (x === 0 ? [h[0]] : h.slice(1, 3)).forEach(pc => notes.push(N(nearest([pc], x === 0 ? 45 + k : 57 + k, 38 + k, 64 + k), t0 + b * 4 + x, 0.85, x === 0 ? 0.5 : 0.36, 'accomp')))));
      });
      const end = 80; [0, 2].forEach(x => chord(tonic, 'M').forEach(pc => notes.push(N(nearest([pc], 60 + k, 52 + k, 67 + k), end + x, x ? 2 : 1.8, 0.6, 'accomp'))));
      notes.push(N(nearest([tonic], 74 + k, 67 + k, 84 + k), end, 0.9, 0.7, 'melody'), N(nearest([tonic], 79 + k, 67 + k, 86 + k), end + 2, 2, 0.75, 'melody'));
      steps.push(`A 段旋律：${A.mel.map(x => nm(x[0])).join(' ')}（回来三次，一个音都不改）`);
      return { bpm: 120, meter: '4/4', key: keyName(tonic, 'major'), notes, steps };
    },
  });

  // ============ 14 浪漫 · 圆舞曲 ============
  add({
    id: 'waltz', era: 'romantic', name: '圆舞曲', who: '肖邦、约翰·施特劳斯',
    sound: '三拍子的旋转舞曲，左手「嘣-嚓-嚓」，右手第一拍往上一跳再旋转着落下来；第二拍稍微抢一点，像舞步的摆荡。',
    recipe: ['三拍子，左手第 1 拍弹低音、第 2、3 拍弹和弦', '和弦：I 和 V7 来回转，第 9–12 小节去一下 IV', '右手每两小节一个乐句：第一拍往上大跳（六度左右），之后一级一级落下来', '维也纳式摆荡：每小节第 2 拍提前一点点', '第二遍旋律高八度、更响'],
    roles: { melody: { name: '旋律', inst: 'violin' }, bass: { name: '低音', inst: 'piano' }, chords: { name: '和弦', inst: 'piano' } },
    gen(seed) {
      const r = RNG(seed), steps = [];
      const tonic = pick(r, [7, 2, 9, 5, 3]), k = tonic > 6 ? tonic - 12 : tonic, sc = tr(SCALES.major, tonic), D = DEG(tonic);
      const PLAN = [0, 0, 7, 7, 7, 7, 0, 0, 0, 0, 5, 5, 0, 7, 0, 0];
      steps.push(`调：<b>${keyName(tonic, 'major')}</b>。16 小节和弦：${PLAN.map(x => ({ 0: 'I', 5: 'IV', 7: 'V7' }[x])).join(' ')}`);
      const notes = []; let p = nearest([pcOf(tonic + 4)], 69 + k, 64 + k, 76 + k);
      for (let rep = 0; rep < 2; rep++) PLAN.forEach((deg, b) => {
        const h = D(deg, deg === 7 ? '7' : 'M'), t0 = (rep * 16 + b) * 3, up = rep * 12;
        notes.push(N(nearest([h[0]], 43 + k, 36 + k, 50 + k), t0, 0.9, 0.55, 'bass'));
        [1, 2].forEach(x => h.slice(1, 4).forEach(pc => notes.push(N(nearest([pc], 60 + k, 54 + k, 67 + k), t0 + x, 0.6, 0.38, 'chords'))));
        if (b === 15) { notes.push(N(nearest([tonic], p, 64 + k, 79 + k) + up, t0, 3, 0.75, 'melody')); return; }
        if (b % 2 === 0) { const leap = nearest(h, p + 7 + Math.floor(r() * 3), 64 + k, 84 + k); notes.push(N(p + up, t0, 1, 0.6 + rep * 0.1, 'melody'), N(leap + up, t0 + 1, 2, 0.72 + rep * 0.1, 'melody')); p = leap; }
        else { for (let x = 0; x < 3; x++) { p = nearest(x === 0 ? h : sc, p - (x ? 2 : 1), 62 + k, 84 + k); notes.push(N(p + up, t0 + x, 0.95, 0.62 + rep * 0.1, 'melody')); } }
      });
      steps.push('右手：每个奇数小节第一拍从上一个音往上跳 7–9 个半音落在和弦音上，偶数小节一级一级往下落；第二遍整体高八度');
      const spb = 60 / 168, time = b => { const bar = Math.floor(b / 3), x = b - bar * 3; const warp = x < 1 ? x * 0.88 : x < 2 ? 0.88 + (x - 1) * 1.06 : 1.94 + (x - 2) * 1.06; return (bar * 3 + warp) * spb * (1 + Math.max(0, b - 84) * 0.012); };
      steps.push('维也纳摆荡：每小节第 2 拍提前约 12% 拍，第 3 拍补回来；最后几小节放慢');
      return { bpm: 168, meter: '3/4', key: keyName(tonic, 'major'), notes, steps, time };
    },
  });

  // ============ 15 浪漫 · 艺术歌曲（舒伯特式）============
  add({
    id: 'lied', era: 'romantic', name: '艺术歌曲', who: '舒伯特、舒曼',
    sound: '一个人声唱着好记的旋律，钢琴右手一直流动地分解和弦，前半首在小调里忧伤，后半首突然转进同名大调，像云开了。',
    recipe: ['12/8 拍（每拍分三份，像小船摇）；人声每小节两三个音，好唱、一级一级走', '钢琴右手每个八分音符一个音，在和弦里上下流动；左手每半小节一个低音', '前 4 小节小调（i iv V i），后 4 小节换成同名大调（I IV V I）——舒伯特最爱的明暗转换', '结尾人声落在大调主音上'],
    roles: { voice: { name: '人声', inst: 'voice' }, rh: { name: '钢琴右手', inst: 'piano' }, lh: { name: '钢琴左手', inst: 'piano' } },
    gen(seed) {
      const r = RNG(seed), steps = [];
      const tonic = pick(r, [7, 2, 9, 4, 0]), k = tonic > 6 ? tonic - 12 : tonic;
      const MIN = [['m', 0], ['m', 5], ['7', 7], ['m', 0]], MAJ = [['M', 0], ['M', 5], ['7', 7], ['M', 0]];
      steps.push(`调：<b>${keyName(tonic, 'minor')} → ${keyName(tonic, 'major')}</b>，12/8 拍`);
      const notes = []; let p = nearest([pcOf(tonic + 7)], 67 + k, 62 + k, 74 + k);
      [MIN, MAJ].forEach((plan, half) => plan.forEach(([q, deg], b) => {
        const h = chord(tonic + deg, q), t0 = (half * 4 + b) * 12, sc = tr(half ? SCALES.major : SCALES.harmonic, tonic);
        for (let e = 0; e < 12; e++) notes.push(N(nearest([h[[0, 1, 2, 1][e % 4] % h.length]], 60 + k + (e % 6 < 3 ? 0 : 5), 55 + k, 74 + k), t0 + e, 0.95, 0.32, 'rh'));
        [0, 6].forEach(x => notes.push(N(nearest([x ? h[2] : h[0]], 43 + k, 36 + k, 50 + k), t0 + x, 5.8, 0.42, 'lh')));
        const rhy = b === 3 ? [9, 3] : pick(r, [[6, 3, 3], [3, 3, 6], [6, 6], [9, 3]]); let t = 0;
        rhy.forEach((d, i) => { if (b === 3 && i === 0) p = nearest(half ? [tonic, pcOf(tonic + 4)] : [tonic, pcOf(tonic + 3)], p, 60 + k, 76 + k); else p = t % 6 === 0 ? nearest(h, p + Math.round((r() - 0.5) * 6), 60 + k, 76 + k) : nearest(sc, p + (r() < 0.5 ? -2 : 2), 60 + k, 76 + k); notes.push(N(p, t0 + t, d * 0.95, 0.7, 'voice')); t += d; });
      }));
      notes.push(N(nearest([tonic], p, 60 + k, 76 + k), 96, 12, 0.66, 'voice')); chord(tonic, 'M').forEach(pc => notes.push(N(nearest([pc], 60 + k, 55 + k, 72 + k), 96, 12, 0.4, 'rh'))); notes.push(N(nearest([tonic], 40 + k, 33 + k, 47 + k), 96, 12, 0.5, 'lh'));
      steps.push(`小调和大调只差一个音：${NAMES[tonic]} 小三和弦 {${chord(tonic, 'm').map(x => NAMES[x]).join(' ')}} → 大三和弦 {${chord(tonic, 'M').map(x => NAMES[x]).join(' ')}}`);
      return { bpm: 150, meter: '12/8', key: keyName(tonic, 'minor'), notes, steps };
    },
  });

  // ============ 16 近代 · 波莱罗式渐强（拉威尔式）============
  add({
    id: 'bolero', era: 'modern', name: '波莱罗式渐强', who: '拉威尔《波莱罗》',
    sound: '小军鼓从头到尾打同一个节奏，同一段旋律一遍遍重复，每一遍换一种乐器、越来越响、乐器越来越多，最后全体爆发。',
    recipe: ['小军鼓：三拍子的固定节奏，从头打到尾，一点点变响', '低音：拨弦反复「主音-属音-属音」', '同一段 8 小节旋律重复 4 遍，依次交给长笛、单簧管、萨克斯、小号——旋律不变，只换音色（配器）', '力度从很轻一路推到很响；第 4 遍加弦乐在下方三度和声', '最后两小节全体齐奏收住'],
    roles: { snare: { name: '小军鼓', inst: 'drums' }, ostinato: { name: '固定低音', inst: 'pizzicato' }, m1: { name: '第 1 遍旋律', inst: 'flute' }, m2: { name: '第 2 遍旋律', inst: 'clarinet' }, m3: { name: '第 3 遍旋律', inst: 'sax' }, m4: { name: '第 4 遍旋律', inst: 'trumpet' }, harm: { name: '和声', inst: 'strings' } },
    gen(seed) {
      const r = RNG(seed), steps = [];
      const tonic = pick(r, [0, 2, 7, 5]), k = tonic > 6 ? tonic - 12 : tonic, sc = tr([0, 2, 4, 5, 7, 9, 10], tonic);
      steps.push(`调：<b>${NAMES[tonic]}</b>（带降七级的大调，像西班牙民间舞曲）。三拍子，旋律 8 小节 × 4 遍`);
      const tune = []; let p = nearest([tonic], 72 + k, 67 + k, 79 + k), t = 0;
      while (t < 24) { const d = pick(r, t % 3 === 0 ? [3, 2, 1.5] : [1, 0.5]); const dd = Math.min(d, 24 - t); p = nearest(sc, p + pick(r, [-2, -1, 1, 2, -3]), 64 + k, 81 + k); tune.push([p, t, dd]); t += dd; }
      tune[tune.length - 1][0] = nearest([tonic], p, 64 + k, 81 + k);
      steps.push(`旋律（随机，大多级进）：${tune.map(x => nm(x[0])).join(' ')}`);
      const notes = [], SN = [0, 0.667, 0.833, 1, 1.667, 1.833, 2, 2.333, 2.5, 2.667, 2.833];
      const roles = ['m1', 'm2', 'm3', 'm4'];
      for (let rep = 0; rep < 4; rep++) {
        const t0 = rep * 24, v = 0.35 + rep * 0.18;
        tune.forEach(([pp, tt, d]) => { notes.push(N(pp, t0 + tt, d * 0.95, v, roles[rep])); if (rep === 3) notes.push(N(nearest(sc, pp - 4, 0, 127), t0 + tt, d * 0.95, v * 0.8, 'harm')); });
      }
      for (let bar = 0; bar < 34; bar++) { const v = 0.25 + 0.65 * bar / 33; SN.forEach(x => notes.push(N(38, bar * 3 + x, 0.1, x % 1 === 0 ? v : v * 0.7, 'snare'))); [0, 1, 2].forEach(x => notes.push(N(nearest([x ? pcOf(tonic + 7) : tonic], 43 + k, 36 + k, 50 + k), bar * 3 + x, 0.4, 0.3 + 0.5 * bar / 33, 'ostinato'))); }
      [96, 99].forEach((tt, i) => { chord(tonic, 'M').forEach(pc => ['m4', 'harm', 'm3'].forEach(role => notes.push(N(nearest([pc], 67 + k, 55 + k, 79 + k), tt, i ? 3 : 2.8, 1, role)))); notes.push(N(36, tt, 0.3, 1, 'snare'), N(nearest([tonic], 36 + k, 30 + k, 42 + k), tt, 3, 1, 'ostinato')); });
      steps.push('小军鼓每小节 11 下（近似原作的三连音节奏），力度从 0.25 线性推到 0.90；旋律每一遍换一件乐器，力度 0.35 → 0.89');
      return { bpm: 76, meter: '3/4', key: keyName(tonic, 'major'), notes, steps };
    },
  });

  // ============ 17 20 世纪 · 极简主义（格拉斯 / 赖希式）============
  add({
    id: 'minimal', era: 'modern', name: '极简主义', who: '菲利普·格拉斯、斯蒂夫·赖希',
    sound: '几个音组成的小图案不停重复，像钟表齿轮；图案一点点变长、两层图案慢慢错位，耳朵会听出不断变化的花纹。',
    recipe: ['四个和弦循环：i – VI – III – VII，每个两小节', '第一层（加法过程）：8 个音的分解和弦图案，第一遍只弹前 3 个，每遍多加 1 个，直到 8 个', '第二层（相位过程）：同一个 12 音图案，另一件乐器跟着弹，每 4 小节往后错开一个八分音符——两层慢慢「走散」又「对齐」', '低音一个和弦一个长音，弦乐在下面轻轻铺和声'],
    roles: { add: { name: '加法图案', inst: 'marimba' }, phase: { name: '相位图案', inst: 'vibraphone' }, bass: { name: '低音', inst: 'cello' }, pad: { name: '铺底和声', inst: 'strings' } },
    gen(seed) {
      const r = RNG(seed), steps = [];
      const tonic = pick(r, [9, 4, 2, 7]), k = tonic > 6 ? tonic - 12 : tonic;
      const PROG = [[0, 'm'], [8, 'M'], [3, 'M'], [10, 'M']], H = PROG.map(([d, q]) => chord(tonic + d, q));
      steps.push(`调：<b>${keyName(tonic, 'minor')}</b>。和弦循环 i – VI – III – VII，一共 4 轮，32 小节`);
      const cell = pick(r, [[0, 1, 2, 1, 0, 1, 2, 3], [0, 2, 1, 2, 0, 2, 3, 2], [2, 1, 0, 1, 2, 3, 2, 1]]), ph = pick(r, [[0, 2, 1, 2, 3, 2, 1, 2, 0, 1, 2, 1], [0, 1, 2, 0, 1, 2, 3, 2, 1, 3, 2, 1]]);
      steps.push(`加法图案（和弦里第几个音）：[${cell.join(', ')}]；相位图案：[${ph.join(', ')}]`);
      const tone = (h, i, base) => { const ext = [...h, ...h.map(x => x + 12)]; return nearest([ext[i % ext.length] % 12], base + (i >= h.length ? 7 : 0), base - 6, base + 14); };
      const notes = []; let len = 3, shift = 0;
      for (let bar = 0; bar < 32; bar++) {
        const h = H[Math.floor(bar / 2) % 4], t0 = bar * 4;
        if (bar % 2 === 0 && bar > 0 && len < 8) len++;
        for (let e = 0; e < 8; e++) { const i = e % len; notes.push(N(tone(h, cell[i], 64 + k), t0 + e * 0.5, 0.45, 0.55 + (e % len === 0 ? 0.1 : 0), 'add')); }
        if (bar >= 4) { if (bar % 4 === 0 && bar > 4) shift++; for (let e = 0; e < 8; e++) notes.push(N(tone(h, ph[(bar * 8 + e + shift) % 12], 72 + k), t0 + e * 0.5, 0.45, 0.48, 'phase')); }
        if (bar % 2 === 0) { notes.push(N(nearest([h[0]], 40 + k, 33 + k, 47 + k), t0, 7.8, 0.5, 'bass')); h.forEach(pc => notes.push(N(nearest([pc], 57 + k, 50 + k, 64 + k), t0, 7.8, 0.28, 'pad'))); }
      }
      steps.push('加法：图案长度 3 → 8（每两小节 +1）；相位：第 5 小节起第二层进来，之后每 4 小节往后错一个八分音符，共错开 6 次');
      return { bpm: 132, meter: '4/4', key: keyName(tonic, 'minor'), notes, steps };
    },
  });

  // ============ 18 中国 · 五声音阶 + 支声复调（江南丝竹式）============
  add({
    id: 'sizhu', era: 'chinese', name: '五声支声（江南丝竹式）', who: '江南丝竹《欢乐歌》《中花六板》一类',
    sound: '只用五个音（宫商角徵羽），竹笛、二胡、琵琶、古筝同时演奏同一条旋律，但各自加不同的花——这叫「支声复调」，是中国合奏的味道。',
    recipe: ['五声音阶：1 2 3 5 6（宫商角徵羽），没有半音的摩擦', '「鱼咬尾」：下一句的第一个音，就是上一句的最后一个音（民间常用的接句方法）', '四句旋律，最后落在宫音（1）', '支声复调：竹笛在长音前加倚音、在音之间加经过音；二胡把短音合并成长音拉；琵琶在长音上用快速重复（轮指）；古筝弹低音和句尾的刮奏'],
    roles: { dizi: { name: '竹笛', inst: 'dizi' }, erhu: { name: '二胡', inst: 'erhu' }, pipa: { name: '琵琶', inst: 'pipa' }, guzheng: { name: '古筝', inst: 'guzheng' } },
    gen(seed) {
      const r = RNG(seed), steps = [];
      const tonic = pick(r, [2, 7, 0, 9]), k = tonic > 6 ? tonic - 12 : tonic, pen = tr(SCALES.penta, tonic);
      steps.push(`宫音（1）= <b>${NAMES[tonic]}</b>，五声音阶 {${pen.map(x => NAMES[x]).join(' ')}}，四句 × 4 小节`);
      const mel = []; let p = nearest([pcOf(tonic + 7)], 74 + k, 69 + k, 81 + k), t = 0, links = [];
      for (let ph = 0; ph < 4; ph++) {
        if (ph > 0) links.push(nm(p));
        const end = ph * 16 + 16;
        while (t < end) {
          const d = Math.min(pick(r, [1, 1, 0.5, 0.5, 2, 1.5]), end - t), lastNote = t + d >= end;
          if (lastNote) p = nearest(ph === 3 ? [tonic] : [pcOf(tonic + pick(r, [7, 2, 9]))], p, 67 + k, 84 + k);
          else if (!(ph > 0 && t === ph * 16)) p = nearest(pen, p + pick(r, [-2, -1, 1, 2, -3, 3]), 67 + k, 84 + k);
          mel.push([p, t, d]); t += d;
        }
      }
      steps.push(`鱼咬尾：第 2、3、4 句的第一个音沿用上一句最后一个音（${links.join('、')}）`);
      const notes = [];
      mel.forEach(([pp, tt, d], i) => {
        const nx = mel[i + 1]?.[0];
        if (d >= 1 && r() < 0.6) { notes.push(N(nearest(pen, pp + 2, 60, 100), tt, 0.25, 0.55, 'dizi'), N(pp, tt + 0.25, d - 0.25, 0.7, 'dizi')); }
        else if (d >= 1 && nx != null && Math.abs(nx - pp) > 2 && r() < 0.5) { notes.push(N(pp, tt, d - 0.5, 0.7, 'dizi'), N(nearest(pen, (pp + nx) / 2, 60, 100), tt + d - 0.5, 0.5, 0.58, 'dizi')); }
        else notes.push(N(pp, tt, d * 0.95, 0.68, 'dizi'));
        if (d >= 1.5) for (let q = 0; q < d / 0.25; q++) notes.push(N(pp - 12, tt + q * 0.25, 0.24, 0.42 + (q === 0 ? 0.15 : 0), 'pipa'));
        else notes.push(N(pp - 12, tt, Math.min(d, 1) * 0.9, 0.5, 'pipa'));
      });
      for (let b = 0; b < 32; b += 2) { const seg = mel.filter(x => x[1] >= b && x[1] < b + 2); if (!seg.length) continue; notes.push(N(seg[0][0] - 12, b, 1.95, 0.55, 'erhu')); }
      for (let bar = 0; bar < 16; bar++) { notes.push(N(nearest([tonic], 50 + k, 43 + k, 55 + k), bar * 4, 1.9, 0.5, 'guzheng'), N(nearest([pcOf(tonic + 7)], 50 + k, 45 + k, 57 + k), bar * 4 + 2, 1.9, 0.42, 'guzheng'));
        if (bar % 4 === 3) { let q = nearest(pen, 55 + k, 50, 70); for (let j = 0; j < 8; j++) { notes.push(N(q, bar * 4 + 2 + j * 0.25, 1, 0.35 + j * 0.03, 'guzheng')); q = nearest(pen, q + 2, 0, 127); } } }
      notes.push(N(nearest([tonic], 74 + k, 67 + k, 84 + k), 64, 3, 0.7, 'dizi'), N(nearest([tonic], 62 + k, 55 + k, 72 + k), 64, 3, 0.6, 'erhu'), N(nearest([tonic], 45 + k, 40 + k, 52 + k), 64, 3, 0.6, 'guzheng'), N(nearest([tonic], 62 + k, 55 + k, 72 + k), 64, 1, 0.6, 'pipa'));
      steps.push('支声：竹笛在 60% 的长音前加上方倚音、在大跳中间补经过音；二胡每两拍只拉一个音；琵琶在 1.5 拍以上的长音上用十六分音符重复（轮指）；古筝每拍弹宫、徵，每句末尾往上刮八个音');
      return { bpm: 84, meter: '4/4', key: `${NAMES[tonic]} 宫调（五声）`, notes, steps };
    },
  });

  window.STYLES = STYLES;
  window.MUSIC = { NAMES, nm, SCALES, Q, chord, pcOf };
})();
