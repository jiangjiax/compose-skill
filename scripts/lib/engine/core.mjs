// 维度引擎的公共小工具：随机数、音阶、和弦、找最近的音。
// 时间单位：拍。2/4、3/4、4/4 一拍 = 四分音符；6/8 一拍 = 八分音符（和 12/8 一样，乐谱层按八分音符排）。
export const RNG = seed => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
// 从一个种子派生出互不干扰的几条随机数流（动机、和声、伴奏各用各的，换伴奏不会改掉旋律）
export const subRNG = (seed, tag) => { let h = seed >>> 0; for (const c of tag) h = Math.imul(h ^ c.charCodeAt(0), 2654435761) >>> 0; return RNG(h); };
export const pcOf = p => ((p % 12) + 12) % 12;
export const pick = (r, a) => a[Math.floor(r() * a.length)];
export const NAMES = ['C', '升C', 'D', '降E', 'E', 'F', '升F', 'G', '降A', 'A', '降B', 'B'];
export const SHORT = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
export const nm = p => SHORT[pcOf(p)] + (Math.floor(p / 12) - 1);
export const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10], harmonic: [0, 2, 3, 5, 7, 8, 11], dorian: [0, 2, 3, 5, 7, 9, 10],
  mixolydian: [0, 2, 4, 5, 7, 9, 10], lydian: [0, 2, 4, 6, 7, 9, 11], penta: [0, 2, 4, 7, 9], blues: [0, 3, 5, 6, 7, 10], whole: [0, 2, 4, 6, 8, 10],
};
export const Q = { M: [0, 4, 7], m: [0, 3, 7], d: [0, 3, 6], A: [0, 4, 8], '5': [0, 7], '7': [0, 4, 7, 10], M7: [0, 4, 7, 11], m7: [0, 3, 7, 10], h7: [0, 3, 6, 10], d7: [0, 3, 6, 9], '9': [0, 4, 7, 10, 14], add9: [0, 4, 7, 14], m9: [0, 3, 7, 10, 14], sus4: [0, 5, 7], sus2: [0, 2, 7] };
export const chordPcs = (tonic, ch) => Q[ch.q].map(x => pcOf(tonic + ch.deg + x));
export const inPcs = (pcs, lo, hi) => { const o = []; for (let m = Math.ceil(lo); m <= hi; m++) if (pcs.includes(pcOf(m))) o.push(m); return o; };
export function nearest(pcs, target, lo = 0, hi = 127) {
  let c = inPcs(pcs, lo, hi); if (!c.length) c = inPcs(pcs, target - 12, target + 12); if (!c.length) return Math.round(target);
  return c.reduce((a, b) => (Math.abs(b - target) < Math.abs(a - target) ? b : a));
}
export const N = (p, t, d, v, fn, extra) => ({ p, t, d, v, fn, ...extra });
// 罗马数字（计算记录里给人看）
const RN_MAJ = { 0: 'I', 1: '♭II', 2: 'II', 3: '♭III', 4: 'III', 5: 'IV', 6: '♯IV', 7: 'V', 8: '♭VI', 9: 'VI', 10: '♭VII', 11: 'VII' };
export function roman(ch) {
  const base = RN_MAJ[pcOf(ch.deg)], minorish = ['m', 'd', 'm7', 'h7', 'd7', 'm9'].includes(ch.q);
  const s = minorish ? base.toLowerCase() : base;
  return s + ({ d: '°', h7: 'ø7', d7: '°7', '7': '7', M7: 'maj7', m7: '7', '9': '9', add9: 'add9', m9: '9', sus4: 'sus4', sus2: 'sus2', '5': '5', A: '+' }[ch.q] || '');
}
export const barBeats = meter => meter.startsWith('3/4') ? 3 : meter.startsWith('6/8') ? 6 : meter.startsWith('2/4') ? 2 : 4;
// 一拍里的强弱：0 = 小节第一拍（最强），1 = 次强拍，2 = 其他拍头，3 = 拍内
export function strength(t, meter) {
  const B = barBeats(meter), x = ((t % B) + B) % B;
  if (Math.abs(x) < 1e-6) return 0;
  if (Math.abs(x - Math.round(x)) > 1e-6) return 3;
  if ((B === 4 && Math.abs(x - 2) < 1e-6) || (B === 6 && Math.abs(x - 3) < 1e-6)) return 1;
  return 2;
}
