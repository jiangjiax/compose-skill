// 乐谱里的一个声部 → 简谱（HTML）。竹笛、二胡等民乐通常看简谱。
// 规则：首调唱名（小调用关系大调的 1，小调主音写成 6）；一拍一个数字；
// 半拍下面一条线、四分之一拍两条线；长音后面跟「-」；附点写「·」；高八度上加点、低八度下加点；休止写 0。
// 给了 sec（拍 → 秒）时，每个数字带 data-s0 / data-s1（开始、结束秒），动态简谱视频靠它定位和点亮；
// strip: true 时不分页，整首排成一行，返回 { html, css } 给视频用。
import { fifthsOf } from './theory.mjs';

const DEG = { 0: ['', '1'], 1: ['#', '1'], 2: ['', '2'], 3: ['b', '3'], 4: ['', '3'], 5: ['', '4'], 6: ['#', '4'], 7: ['', '5'], 8: ['b', '6'], 9: ['', '6'], 10: ['b', '7'], 11: ['', '7'] };
const PCNAME = ['C', '升C', 'D', '降E', 'E', 'F', '升F', 'G', '降A', 'A', '降B', 'B'];
const FIFTHS_PC = { 0: 0, 1: 7, 2: 2, 3: 9, 4: 4, 5: 11, 6: 6, '-1': 5, '-2': 10, '-3': 3, '-4': 8, '-5': 1, '-6': 6 };

export const JIANPU_CSS = `
  .row { display: flex; align-items: center; margin: 0 0 34px; font-family: "Helvetica Neue", Arial, sans-serif; font-size: 24px; }
  .row.strip { display: inline-flex; white-space: nowrap; margin: 0; }
  .bar { display: flex; flex: 1; justify-content: space-around; align-items: flex-start; }
  .strip .bar { flex: none; padding: 0 14px; gap: 10px; }
  .bl { padding: 0 4px; font-weight: 300; color: #333; }
  .g { display: inline-flex; padding: 0 5px; position: relative; }
  .c { position: relative; display: inline-flex; flex-direction: column; align-items: center; min-width: 22px; padding-bottom: 8px; }
  .c b { font-weight: 500; position: relative; line-height: 1.2; } .c sup { font-size: 13px; position: absolute; left: -9px; top: -2px; } .c em { font-style: normal; position: absolute; right: -8px; }
  .c .u { position: absolute; top: -12px; font-style: normal; font-size: 18px; line-height: 6px; letter-spacing: -2px; writing-mode: vertical-rl; }
  .c .d { position: absolute; bottom: -6px; font-style: normal; font-size: 18px; line-height: 6px; writing-mode: vertical-rl; }
  .l1 b::after, .l2 b::after { content: ""; position: absolute; left: -3px; right: -3px; bottom: -3px; border-bottom: 1.5px solid currentColor; }
  .l2 b::before { content: ""; position: absolute; left: -3px; right: -3px; bottom: -7px; border-bottom: 1.5px solid currentColor; }
  .l1, .l2 { min-width: 18px; }
  .g .t3 { position: absolute; top: -16px; left: 50%; transform: translateX(-50%); font-style: italic; font-size: 13px; line-height: 1; }
  .tie { display: inline-block; width: 12px; height: 8px; border-top: 1.4px solid currentColor; border-radius: 50% 50% 0 0; margin-top: -4px; }
  .end { font-size: 26px; padding-left: 6px; }
`;

// 选「不加点」那个八度的 1 在哪：让尽量多的音落在 1–7 这一组里
function pickDoBase(ps, doPc, prefer) {
  if (prefer != null) return prefer;
  let best = 60, bn = -1;
  for (let base = 36 + doPc; base <= 84; base += 12) { const n = ps.filter(p => p >= base && p < base + 12).length; if (n > bn) { bn = n; best = base; } }
  return best;
}

export function toJianpu(score, part, { title, subtitle, doBase: prefer, sec, strip } = {}) {
  const doPc = FIFTHS_PC[fifthsOf(score.key)];
  const unit = score.meter.unitDiv;  // 一拍的长度（4/4、3/4 是四分音符；12/8 是八分音符）
  const ps = part.bars.flat().filter(e => !e.rest).map(e => e.pitches[e.pitches.length - 1]);
  const doBase = pickDoBase(ps, doPc, prefer);
  const cell = (txt, { acc = '', up = 0, down = 0, lines = 0, dot = false, tieS = false, tieE = false, tm = null } = {}) =>
    `<span class="c${lines ? ' l' + lines : ''}${tieS ? ' ts' : ''}${tieE ? ' te' : ''}"${tm ? ` data-s0="${tm[0]}" data-s1="${tm[1]}"` : ''}>${up ? `<i class="u">${'·'.repeat(up)}</i>` : ''}<b>${acc ? `<sup>${acc}</sup>` : ''}${txt}${dot ? '<em>·</em>' : ''}</b>${down ? `<i class="d">${'·'.repeat(down)}</i>` : ''}</span>`;
  const timeOf = ev => (sec && !ev.rest ? [+sec(ev.abs / unit).toFixed(3), +sec((ev.abs + ev.len) / unit).toFixed(3)] : null);
  const bars = part.bars.map(bar => {
    // 按拍分组，同一拍里的短音线连在一起
    const groups = []; let g = null;
    for (const ev of bar) {
      const beat = Math.floor(ev.start / unit);
      const p = ev.rest ? null : ev.pitches[ev.pitches.length - 1];
      let txt = '0', acc = '', up = 0, down = 0;
      if (p != null) { const rel = p - doBase, oct = Math.floor(rel / 12), d = DEG[((p - doPc) % 12 + 12) % 12]; acc = d[0]; txt = d[1]; if (oct > 0) up = oct; if (oct < 0) down = -oct; }
      const beats = ev.len / unit, tm = timeOf(ev);
      if (beats >= 1) { // 一拍或更长：数字 + 横线
        const whole = Math.floor(beats + 1e-6), frac = beats - whole;
        const parts = [cell(txt, { acc, up, down, dot: frac > 0.4, tieE: ev.tieStop, tm })];
        for (let k = 1; k < whole; k++) parts.push(ev.rest ? cell('0') : cell('-', { tm }));
        groups.push({ beat, html: parts.join('') + (ev.tieStart ? '<span class="tie"></span>' : ''), sep: true }); g = null;
      } else if (ev.tup) { // 三连音：一条线 + 上方标 3
        const html = cell(txt, { acc, up, down, lines: 1, tm });
        if (g && g.beat === beat && !g.sep) g.html += html; else { g = { beat, html: '<i class="t3">3</i>' + html, sep: false }; groups.push(g); }
      } else {
        const lines = beats >= 0.5 - 1e-6 ? 1 : 2, dot = Math.abs(beats - 0.75) < 1e-6 || Math.abs(beats - 0.375) < 1e-6;
        const html = cell(txt, { acc, up, down, lines: dot && beats > 0.5 ? 1 : lines, dot, tieE: ev.tieStop, tm }) + (ev.tieStart ? '<span class="tie"></span>' : '');
        if (g && g.beat === beat && !g.sep) g.html += html; else { g = { beat, html, sep: false }; groups.push(g); }
      }
    }
    return `<span class="bar">${groups.map(x => `<span class="g">${x.html}</span>`).join('')}</span>`;
  });
  const keyName = PCNAME[doPc];
  const bl = '<span class="bl">|</span>';
  if (strip) return { html: `<div class="row strip">${bars.join(bl)}<span class="end">‖</span></div>`, css: JIANPU_CSS, head: `1 = ${keyName}　${score.meter.label}` };
  const per = score.meter.beats >= 6 ? 2 : 4; // 12/8 一小节很长，一行放两小节
  const rows = []; for (let i = 0; i < bars.length; i += per) rows.push(bars.slice(i, i + per).join(bl));
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>${title} · 简谱</title><style>
  body { margin: 0; background: #fff; color: #111; font-family: "Noto Serif SC", "Songti SC", serif; }
  .page { width: 860px; margin: 0 auto; padding: 48px 40px; }
  h1 { text-align: center; font-size: 30px; margin: 0 0 6px; font-weight: 600; } .sub { text-align: center; color: #555; font-size: 15px; margin-bottom: 4px; }
  .head { display: flex; justify-content: space-between; font-size: 18px; margin: 18px 0 26px; }
  ${JIANPU_CSS}
  </style></head><body><div class="page"><h1>${title}</h1><div class="sub">${subtitle || ''}</div>
  <div class="head"><span>1 = ${keyName}　${score.meter.label}</span><span>${part.roleName ? part.roleName + ' · ' : ''}${part.name}</span></div>
  ${rows.map((r, i) => `<div class="row">${r}${i === rows.length - 1 ? '<span class="end">‖</span>' : bl}</div>`).join('')}
  <div class="sub" style="text-align:left;margin-top:30px">读法：数字是唱名（1=do），上面加点高八度、下面加点低八度；下面一条线是半拍、两条线是四分之一拍；「-」表示把前一个音再延长一拍；「·」附点＝再延长一半；0 是休止。</div>
  </div></body></html>`;
}
