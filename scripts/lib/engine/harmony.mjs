// 和声维度：给一个段落（几小节、什么调式、结尾要不要「落地」），排出和弦进行。
// 每种和声语汇是一个时代 / 曲风的规则；和弦用「离段落主音几个半音 + 和弦性质」表示，移调不变形。
import { pick } from './core.mjs';

const C = (deg, q) => ({ deg, q });
// 功能和声（巴洛克到浪漫的共同语法）：主 → 下属 → 属 → 主
const FUNC_MAJ = { I: C(0, 'M'), ii: C(2, 'm'), iii: C(4, 'm'), IV: C(5, 'M'), V: C(7, 'M'), V7: C(7, '7'), vi: C(9, 'm'), 'V/V': C(2, '7') };
const FUNC_MIN = { I: C(0, 'm'), ii: C(2, 'd'), iii: C(3, 'M'), IV: C(5, 'm'), V: C(7, 'M'), V7: C(7, '7'), vi: C(8, 'M'), VII: C(10, 'M') };
const NEXT = { I: ['IV', 'ii', 'vi', 'V', 'IV', 'iii'], ii: ['V', 'V7'], iii: ['vi', 'IV'], IV: ['V', 'I', 'ii', 'V7'], V: ['I', 'vi', 'I'], V7: ['I', 'I', 'vi'], vi: ['ii', 'IV', 'V'], VII: ['iii', 'I'], 'V/V': ['V', 'V7'] };

function functional(r, { bars, mode, cad, rate, strict }) {
  const T = mode === 'minor' ? FUNC_MIN : FUNC_MAJ, n = bars * rate, seq = ['I'];
  while (seq.length < n) seq.push(pick(r, NEXT[seq[seq.length - 1]]));
  // 严格风格：七和弦只留在终止式里（句中的 V7 改成 V 三和弦），副属和弦也用三和弦
  if (strict === 'strict') for (let i = 0; i < n - 2; i++) if (seq[i] === 'V7') seq[i] = 'V';
  // 结尾：全终止 = …ii/IV → V7 → I；半终止 = …→ V（悬着）；loop = 回到能接回开头的 V
  if (cad === 'full' && n >= 3) { seq[n - 1] = 'I'; seq[n - 2] = pick(r, ['V7', 'V']); seq[n - 3] = pick(r, ['ii', 'IV', mode === 'minor' || strict === 'strict' ? 'IV' : 'V/V']); }
  else if (cad === 'full' && n === 2) { seq[0] = 'V7'; seq[1] = 'I'; }
  else if ((cad === 'half' || cad === 'loop') && n >= 2) { seq[n - 1] = 'V'; seq[n - 2] = pick(r, ['ii', 'IV', 'I']); }
  return seq.map(k => ({ ...T[k], name: k }));
}
// 巴洛克五度圈模进：I IV vii° iii vi ii V I，一级级往下掉，像楼梯
function sequence(r, { bars, mode, cad, rate }) {
  const ring = mode === 'minor' ? [C(0, 'm'), C(5, 'm'), C(10, 'M'), C(3, 'M'), C(8, 'M'), C(2, 'd'), C(7, '7')] : [C(0, 'M'), C(5, 'M'), C(11, 'd'), C(4, 'm'), C(9, 'm'), C(2, 'm'), C(7, '7')];
  const n = bars * rate, out = []; for (let i = 0; i < n; i++) out.push(ring[i % ring.length]);
  if (cad === 'full') { out[n - 1] = ring[0]; if (n > 1) out[n - 2] = C(7, '7'); }
  else if (cad === 'half' || cad === 'loop') out[n - 1] = C(7, 'M');
  return out;
}
// 印象派平行和弦：七和弦、加九和弦整块平移，不讲「解决」
function planing(r, { bars, rate }) {
  const pool = [C(0, 'M7'), C(2, 'm7'), C(5, 'M7'), C(7, 'add9'), C(9, 'm7'), C(10, 'M7'), C(3, 'M7'), C(4, 'm7')], out = [C(0, 'M7')];
  while (out.length < bars * rate) { const prev = out[out.length - 1]; const cand = pool.filter(c => Math.abs(c.deg - prev.deg) <= 3 && c !== prev); out.push(pick(r, cand.length ? cand : pool)); }
  return out;
}
// 萨蒂：两个大七和弦来回摇
const satie = (r, { bars, rate }) => Array.from({ length: bars * rate }, (_, i) => (i % 2 ? C(5, 'M7') : C(0, 'M7')));
// 12 小节布鲁斯
function blues(r, { bars, cad }) {
  const B = [C(0, '7'), C(5, '7'), C(0, '7'), C(0, '7'), C(5, '7'), C(5, '7'), C(0, '7'), C(0, '7'), C(7, '7'), C(5, '7'), C(0, '7'), C(7, '7')];
  const out = Array.from({ length: bars }, (_, i) => B[i % 12]); if (cad === 'full') out[bars - 1] = C(0, '7'); return out;
}
// 爵士 ii–V–I
function jazz(r, { bars, cad, rate }) {
  const turns = [[C(2, 'm7'), C(7, '7'), C(0, 'M7'), C(0, 'M7')], [C(4, 'm7'), C(9, '7'), C(2, 'm7'), C(7, '7')], [C(5, 'M7'), C(10, '7'), C(4, 'm7'), C(9, '7')]];
  const out = []; while (out.length < bars * rate) out.push(...pick(r, turns));
  out.length = bars * rate; if (cad === 'full') { out[out.length - 1] = C(0, 'M7'); if (out.length > 1) out[out.length - 2] = C(7, '7'); }
  return out;
}
// 流行四和弦循环
function pop(r, { bars, mode, cad, rate }) {
  const loops = mode === 'minor' ? [[C(0, 'm'), C(8, 'M'), C(3, 'M'), C(10, 'M')], [C(0, 'm'), C(5, 'm'), C(8, 'M'), C(7, 'M')]] : [[C(0, 'M'), C(7, 'M'), C(9, 'm'), C(5, 'M')], [C(9, 'm'), C(5, 'M'), C(0, 'M'), C(7, 'M')], [C(0, 'M'), C(9, 'm'), C(5, 'M'), C(7, 'M')]];
  const L = pick(r, loops), out = Array.from({ length: bars * rate }, (_, i) => L[i % 4]);
  if (cad === 'full') out[out.length - 1] = C(0, mode === 'minor' ? 'm' : 'M');
  return out;
}
// 极简主义 / 电影史诗共用的小调循环
function minimal(r, { bars, rate }) { const L = [C(0, 'm'), C(8, 'M'), C(3, 'M'), C(10, 'M')], per = Math.max(1, Math.round(2 * rate)); return Array.from({ length: bars * rate }, (_, i) => L[Math.floor(i / per) % 4]); }
function epic(r, { bars, cad, rate }) {
  const loops = [[C(0, 'm'), C(8, 'M'), C(3, 'M'), C(10, 'M')], [C(0, 'm'), C(5, 'm'), C(8, 'M'), C(7, 'M')], [C(0, 'm'), C(8, 'M'), C(5, 'm'), C(7, 'M')]];
  const L = pick(r, loops), out = Array.from({ length: bars * rate }, (_, i) => L[i % 4]);
  if (cad === 'full') { out[out.length - 1] = C(0, 'M'); if (out.length > 1) out[out.length - 2] = C(7, 'M'); } // 皮卡迪三度：小调落到大三和弦，史诗片尾常用
  return out;
}
// Lo-fi：带七和弦的慵懒循环
function lofi(r, { bars, rate }) { const loops = [[C(5, 'M7'), C(4, 'm7'), C(2, 'm7'), C(0, 'M7')], [C(2, 'm7'), C(7, '7'), C(0, 'M7'), C(9, 'm7')]]; const L = pick(r, loops); return Array.from({ length: bars * rate }, (_, i) => L[i % 4]); }
// 探戈：小调，i 和 V7 来回拉扯
function tango(r, { bars, cad, rate }) {
  const L = [C(0, 'm'), C(0, 'm'), C(7, '7'), C(7, '7'), C(7, '7'), C(7, '7'), C(0, 'm'), C(0, 'm'), C(5, 'm'), C(5, 'm'), C(0, 'm'), C(0, 'm'), C(7, '7'), C(7, '7'), C(0, 'm'), C(0, 'm')];
  const out = Array.from({ length: bars * rate }, (_, i) => L[Math.floor(i * 2 / rate) % 16]); if (cad === 'full') out[out.length - 1] = C(0, 'm'); return out;
}
// 五声：没有功能和声，只有宫音、徵音的持续低音，偶尔落到羽
function penta(r, { bars, rate }) { return Array.from({ length: bars * rate }, (_, i) => (i % 4 === 3 ? pick(r, [C(7, '5'), C(9, 'm'), C(0, '5')]) : C(0, '5'))); }

export const HARMONY = {
  functional: { fn: functional, name: '功能和声', plain: '主 → 下属 → 属 → 主，句尾停在属和弦是「问」，落回主和弦是「答」' },
  sequence: { fn: sequence, name: '五度圈模进', plain: '和弦按五度一级级往下走（I IV vii° iii vi ii V I），像下楼梯，巴洛克最爱' },
  planing: { fn: planing, name: '平行和弦', plain: '七和弦、加九和弦整块平移，不讲解决，听着像雾' },
  satie: { fn: satie, name: '两个和弦摇摆', plain: '两个大七和弦来回交替，像慢慢摇的摇椅' },
  blues: { fn: blues, name: '12 小节布鲁斯', plain: 'I7 ×4 → IV7 ×2 → I7 ×2 → V7 IV7 I7 V7' },
  jazz: { fn: jazz, name: 'ii–V–I', plain: '二级 → 五级 → 一级，全是七和弦，爵士的基本句子' },
  pop: { fn: pop, name: '流行四和弦', plain: '四个和弦反复循环（比如 I V vi IV）' },
  minimal: { fn: minimal, name: '小调循环', plain: 'i – VI – III – VII 不停循环，靠音型变化往前推' },
  epic: { fn: epic, name: '史诗小调循环', plain: '小调四和弦循环，结尾落到大三和弦（皮卡迪三度），电影预告片常用' },
  lofi: { fn: lofi, name: 'Lo-fi 七和弦循环', plain: '全是七和弦的慵懒循环（IVmaj7 iii7 ii7 Imaj7）' },
  tango: { fn: tango, name: '探戈小调', plain: '小调里 i 和 V7 来回拉扯，偶尔去 iv' },
  penta: { fn: penta, name: '五声持续低音', plain: '没有西洋和声，低音守着宫音和徵音，旋律在五个音里走' },
};

// 生成一段的和弦：返回 [{deg, q, t, d}]（t、d 单位是拍，相对段落开头）
export function progression(r, vocab, { bars, beatsPerBar, mode, cad, rate = 1, strict }) {
  const H = HARMONY[vocab] || HARMONY.functional;
  // rate = 每小节几个和弦（0.5 = 两小节一个）；先按「和弦个数」生成，再平均分到整段
  const n = Math.max(1, Math.round(bars * rate)), seq = H.fn(r, { bars: n, mode, cad, rate: 1, strict }).slice(0, n);
  const d = bars * beatsPerBar / n;
  return seq.map((c, i) => ({ deg: c.deg, q: c.q, t: i * d, d }));
}
