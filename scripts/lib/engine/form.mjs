// 曲式维度：整首分几段、每段多长、在哪个调、结尾停在哪、每段多「满」（能量）。
// 时长：按目标秒数把每段的小节数等比放缩，再取整到乐句长度；有画面切点（cues）时，段落边界对齐切点。
import { barBeats } from './core.mjs';

// mat = 素材：同一个字母 = 同一段旋律（再出现时会认出来）；带撇的是变化再现
// key = 离主调几个半音；mode：same / major / minor（不写就跟主调）；cad = 段尾终止：full 落地 / half 悬着 / loop 能接回开头 / none 不终止
const S = (label, mat, bars, key, cad, extra = {}) => ({ label, mat, bars, key, cad, ...extra });
export const FORMS = {
  binary: { name: '二段式', plain: 'A 段停在悬着的地方，B 段走远再落回家', secs: [S('A', 'A', 8, 0, 'half'), S('B', 'B', 8, 0, 'full')] },
  'minuet-trio': { name: '小步舞曲 + 三声中部', plain: '小步舞曲（A B）→ 三声中部换到下属调、更轻 → 小步舞曲回来', secs: [S('小步舞曲 A', 'A', 8, 0, 'half'), S('小步舞曲 B', 'B', 8, 0, 'full'), S('三声中部', 'C', 8, 5, 'full', { soft: true }), S('小步舞曲再现', "A'", 8, 0, 'full')] },
  ternary: { name: '三段式 ABA', plain: '主题 → 对比段（换调、换情绪）→ 主题加花回来', secs: [S('A', 'A', 8, 0, 'full'), S('B', 'B', 8, 7, 'half'), S("A'", "A'", 8, 0, 'full')] },
  rondo: { name: '回旋曲 ABACA', plain: '一段好记的主题反复回来，中间插两段不一样的', secs: [S('A', 'A', 8, 0, 'full'), S('B', 'B', 8, 7, 'half'), S('A', 'A', 8, 0, 'full'), S('C', 'C', 8, 0, 'half', { modeShift: 'relative' }), S("A'", "A'", 8, 0, 'full')] },
  'theme-var': { name: '主题与变奏', plain: '主题 → 加花 → 换小调 → 换节奏 → 主题回来', secs: [S('主题', 'A', 8, 0, 'full'), S('变奏 1 · 加花', "A'", 8, 0, 'full', { vary: 'ornament' }), S('变奏 2 · 小调', "A'", 8, 0, 'full', { vary: 'minor', modeShift: 'parallel' }), S('变奏 3 · 附点', "A'", 8, 0, 'full', { vary: 'dotted' }), S('尾声', 'A', 8, 0, 'full')] },
  'loop-build': { name: '循环渐进', plain: '同一个和弦循环反复，乐器一层层加进来，越来越满', secs: [S('第 1 轮', 'L', 8, 0, 'loop'), S('第 2 轮', 'L', 8, 0, 'loop'), S('第 3 轮', "L'", 8, 0, 'loop'), S('第 4 轮', "L'", 8, 0, 'full')] },
  'verse-chorus': { name: '主歌副歌', plain: '前奏 → 主歌 → 副歌 → 主歌 → 副歌 → 尾奏', secs: [S('前奏', 'I', 4, 0, 'loop'), S('主歌', 'A', 8, 0, 'loop'), S('副歌', 'B', 8, 0, 'loop'), S('主歌', "A'", 8, 0, 'loop'), S('副歌', 'B', 8, 0, 'full')] },
  aaba: { name: 'AABA 歌曲式', plain: '同一句唱两遍 → 桥段换个方向 → 再唱一遍', secs: [S('A', 'A', 8, 0, 'half'), S('A', 'A', 8, 0, 'full'), S('B（桥段）', 'B', 8, 5, 'half'), S("A'", "A'", 8, 0, 'full')] },
  march: { name: '进行曲', plain: '前奏号角 → 主题 → 第二主题 → 中段（下属调、更抒情）→ 主题回来', secs: [S('前奏', 'I', 4, 0, 'half'), S('第一主题', 'A', 8, 0, 'full'), S('第二主题', 'B', 8, 0, 'half'), S('中段', 'C', 8, 5, 'full', { soft: true }), S('主题再现', "A'", 8, 0, 'full')] },
  blues: { name: '布鲁斯段落', plain: '每段 12 小节，一段接一段地唱', secs: [S('第 1 段', 'A', 12, 0, 'loop'), S('第 2 段', "A'", 12, 0, 'loop'), S('第 3 段', 'B', 12, 0, 'full')] },
  through: { name: '贯穿式', plain: '一段接一段往前走，不怎么回头（印象派常这样）', secs: [S('A', 'A', 8, 0, 'none'), S('B', 'B', 8, 2, 'none'), S("A'", "A'", 8, 0, 'full')] },
  ritornello: { name: '回归曲式（协奏曲）', plain: '全体合奏的主题段反复回来，中间独奏段在别的调上炫技', secs: [S('全奏', 'A', 8, 0, 'full'), S('独奏', 'B', 8, 7, 'half', { solo: true }), S('全奏', 'A', 4, 7, 'full'), S('独奏', 'C', 8, 0, 'half', { solo: true, modeShift: 'relative' }), S('全奏', "A'", 8, 0, 'full')] },
};

// 能量曲线：每段多满（0 = 只剩一两件乐器，1 = 全体最强）
export const PROCESS = {
  arch: { name: '拱形', plain: '慢慢变满，高潮在三分之二处，再收回来', f: x => 0.35 + 0.6 * Math.sin(Math.PI * Math.min(1, x / 0.66) / 2) * (x > 0.66 ? 1 - (x - 0.66) / 0.34 * 0.55 : 1) },
  build: { name: '一路渐强', plain: '从最少的乐器开始，一层层加，到最后最满（波莱罗、预告片）', f: x => 0.18 + 0.82 * x },
  wave: { name: '波浪', plain: '满一段、空一段地起伏', f: (x, i) => (i % 2 ? 0.75 : 0.45) },
  flat: { name: '平稳', plain: '从头到尾差不多一样满（背景音乐不抢话）', f: () => 0.5 },
};

// 规划整首：返回段落列表 [{label, mat, bars, key, cad, energy, startBar, ...}]
export function planForm({ form, seconds, bpm, meter, cues, process = 'arch', unit = 4 }) {
  const F = FORMS[form] || FORMS.ternary, B = barBeats(meter), barSec = B * 60 / bpm;
  let secs = F.secs.map(s => ({ ...s }));
  if (cues?.length) {
    // 画面切点：切点之间是一段，段落标签按曲式模板轮流套，小节数按时长取整
    const pts = [0, ...cues.map(c => c.at).filter(x => x > 0).sort((a, b) => a - b), seconds || cues[cues.length - 1].at + 8];
    secs = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const tpl = F.secs[Math.min(i, F.secs.length - 1)], cue = cues.find(c => Math.abs(c.at - pts[i]) < 1e-6);
      secs.push({ ...tpl, soft: false, bars: Math.max(2, Math.round((pts[i + 1] - pts[i]) / barSec)), cue: cue?.label, energyFixed: cue?.energy, cad: i === pts.length - 2 ? 'full' : tpl.cad === 'full' ? 'half' : tpl.cad });
    }
  } else if (seconds) {
    const target = Math.max(unit, Math.round(seconds / barSec)), base = secs.reduce((a, s) => a + s.bars, 0);
    // 太短就从中间删段（保留头尾），太长就整体放大
    while (secs.length > (unit >= 12 ? 1 : 2) && target < base * 0.6 && secs.reduce((a, s) => a + s.bars, 0) > target * 1.3) secs.splice(secs.length - 2, 1);
    const sum = secs.reduce((a, s) => a + s.bars, 0), k = target / sum;
    secs.forEach(s => { const u = s.bars % 12 === 0 ? 12 : unit; s.bars = Math.max(u === 12 ? 12 : Math.min(unit, s.bars), Math.round(s.bars * k / u) * u); });
    // 微调最后一段，让总长尽量贴近目标
    let diff = target - secs.reduce((a, s) => a + s.bars, 0); const last = secs[secs.length - 1];
    if (Math.abs(diff) >= unit / 2 && last.bars % 12 !== 0) last.bars = Math.max(unit, last.bars + Math.round(diff / 2) * 2);
  }
  const total = secs.reduce((a, s) => a + s.bars, 0), P = PROCESS[process] || PROCESS.arch;
  let at = 0;
  secs.forEach((s, i) => {
    s.startBar = at; at += s.bars;
    const x = secs.length > 1 ? (s.startBar + s.bars / 2) / total : 0.5;
    s.energy = s.energyFixed ?? Math.max(0.1, Math.min(1, s.soft ? Math.min(0.4, P.f(x, i) * 0.6) : P.f(x, i)));
  });
  return { form: F, secs, totalBars: total, barSec, process: P };
}
