// 把「音符列表」整理成「乐谱」：按声部、按小节，量化到十六分音符，跨小节的音拆开连上（连音线）。
// MusicXML（五线谱）和简谱都从这里取数据。
import { spell, fifthsOf, INSTRUMENTS } from './theory.mjs';

export const DIV = 48; // 一个四分音符 = 48 份
const GRID = 12;        // 量化到十六分音符
const VALUES = [[192, 'whole', 0], [144, 'half', 1], [96, 'half', 0], [72, 'quarter', 1], [48, 'quarter', 0], [36, 'eighth', 1], [24, 'eighth', 0], [18, '16th', 1], [12, '16th', 0]];

export function meterOf(m) {
  if (m.startsWith('12/8')) return { beats: 12, type: 8, unitDiv: 24, label: '12/8' };
  if (m.startsWith('6/8')) return { beats: 6, type: 8, unitDiv: 24, label: '6/8' };
  if (m.startsWith('3/4')) return { beats: 3, type: 4, unitDiv: 48, label: '3/4' };
  if (m.startsWith('2/4')) return { beats: 2, type: 4, unitDiv: 48, label: '2/4' };
  return { beats: 4, type: 4, unitDiv: 48, label: '4/4' };
}
const q = x => Math.round(x / GRID) * GRID;

// 把一段时值拆成能写出来的音符（必要时用连音线连起来）
export function splitDur(d) { const out = []; while (d >= GRID) { const v = VALUES.find(([n]) => n <= d); out.push(v); d -= v[0]; } return out; }

// parts: [{ role, name, inst, notes:[{p,t,d}] }]  t、d 的单位是生成器的「拍」
// opts.barStarts：每个小节从第几拍开始（弱起、2/4 的起始小节等不规则小节用；不给就按拍号等分）
// 三连音：一拍里三个等长的音（起点在 0、1/3、2/3 拍，各长 1/3 拍）不量化到十六分，按八分三连音写
export function buildScore(parts, meterStr, key, opts = {}) {
  const meter = meterOf(meterStr), barDiv = meter.beats * meter.unitDiv, u = meter.unitDiv, tl = u / 3;
  const fifths = fifthsOf(key);
  const isTrip = n => { const x = n.t * u, d = n.d * u, r = x % u; return Math.abs(d - tl) < 2 && (Math.abs(r - tl) < 2 || Math.abs(r - 2 * tl) < 2 || r < 2); };
  const qs = n => (isTrip(n) ? Math.round(n.t * u / tl) * tl : q(n.t * u));
  const end = Math.max(...parts.flatMap(p => p.notes.map(n => (isTrip(n) ? qs(n) + tl : q((n.t + n.d) * u)))));
  const bs = opts.barStarts?.length ? opts.barStarts.map(b => Math.round(b * u)) : null;
  const total = bs ? Math.max(end, bs[bs.length - 1] + barDiv) : Math.ceil(end / barDiv) * barDiv;
  const nBars = bs ? bs.length : total / barDiv;
  const barOf = x => { if (!bs) return Math.floor(x / barDiv); let b = 0; while (b + 1 < bs.length && bs[b + 1] <= x) b++; return b; };
  const barBeg = b => (bs ? bs[b] : b * barDiv), barEnd = b => (bs ? (bs[b + 1] ?? total) : (b + 1) * barDiv);
  const barBeats = Array.from({ length: nBars }, (_, b) => (barEnd(b) - barBeg(b)) / u);
  const out = parts.map(part => {
    // 同一时刻起的音合成一个和弦；时值不超过下一个起音（谱面上一个声部只写一层）
    const byStart = new Map();
    for (const n of part.notes) { const s = qs(n); (byStart.get(s) || byStart.set(s, []).get(s)).push(n); }
    const starts = [...byStart.keys()].sort((a, b) => a - b);
    const evs = starts.map((s, i) => {
      const grp = byStart.get(s), next = starts[i + 1] ?? total, trip = grp.every(isTrip);
      let e = trip ? s + tl : Math.max(...grp.map(n => q((n.t + n.d) * u))); if (!trip) e = Math.min(Math.max(e, s + GRID), next);
      return { s, e, trip, pitches: [...new Set(grp.map(n => n.p))].sort((a, b) => a - b), v: Math.max(...grp.map(n => n.v ?? 0.7)) };
    });
    // 铺进小节：空的地方补休止符，跨小节的音拆开并标连音线
    const bars = Array.from({ length: nBars }, () => []);
    let cur = 0;
    const put = (s, e, ev) => {
      if (ev?.trip) { const b = barOf(s); bars[b].push({ rest: false, pitches: ev.pitches, start: s - barBeg(b), abs: s, len: tl, type: u === 48 ? 'eighth' : '16th', dots: 0, tup: Math.round((s % u) / tl) + 1, tieStop: false, tieStart: false, v: ev.v }); return; }
      while (s < e) {
        const b = barOf(s), be = barEnd(b), seg = Math.min(e, be);
        splitDur(seg - s).forEach(([len, type, dots], k, arr) => {
          bars[b].push({ rest: !ev, pitches: ev ? ev.pitches : [], start: s - barBeg(b), abs: s, len, type, dots, tieStop: ev && (s > ev.s || k > 0), tieStart: ev && (seg < e || k < arr.length - 1), v: ev?.v });
          s += len;
        });
        s = seg;
      }
    };
    for (const ev of evs) { if (ev.s > cur) put(cur, ev.s, null); put(ev.s, ev.e, ev); cur = ev.e; }
    if (cur < total) put(cur, total, null);
    const all = evs.flatMap(e => e.pitches); const med = all.sort((a, b) => a - b)[all.length >> 1] ?? 60;
    return { ...part, clef: med >= 57 ? 'G' : 'F', bars, range: INSTRUMENTS[part.inst]?.range };
  });
  return { meter, fifths, key, parts: out, nBars, barBeats, spell: p => spell(p, fifths) };
}
