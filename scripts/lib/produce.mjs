// 一首作品（work）→ 全部产物。作曲（compose.mjs）和后期修改（edit.mjs）都走这里，保证两边产物一致。
// work = { title, composer, style, era, key:{pc,minor}, meter, bpm, roles:{id:{name, inst, mute, vol, pan}}, notes:[{p,t,d,v,role,s,e}], jianpu?:[role] }
//   t、d = 拍（谱面用）；s、e = 秒（声音用）。两套时间分开存，摇摆、自由速度、改速度都不会把谱面弄乱。
import fs from 'node:fs';
import path from 'node:path';
import { INSTRUMENTS, keyLabel } from './theory.mjs';
import { buildScore } from './score.mjs';
import { toMusicXML } from './musicxml.mjs';
import { toJianpu } from './jianpu.mjs';
import { writeMidi } from './midi.mjs';
import { auditScore, auditAudio, auditMarkdown } from './audit.mjs';
import { renderAudio } from './render.mjs';

const JIANPU_AUTO = ['dizi', 'erhu', 'flute', 'violin', 'sax', 'clarinet', 'trumpet', 'oboe', 'recorder', 'harmonica', 'voice', 'pan_flute', 'ocarina', 'shakuhachi'];
const safe = s => s.replace(/[\\/:*?"<>|]/g, '_');

export async function produce(work, out, { stems = true } = {}) {
  fs.mkdirSync(out, { recursive: true });
  for (const f of ['动态曲谱.mp4', '动态简谱.mp4']) fs.rmSync(path.join(out, f), { force: true }); // 内容变了，旧视频作废
  const R = work.roles, live = Object.keys(R).filter(r => !R[r].mute && work.notes.some(n => n.role === r)); // 一个音都没有的声部（比如能量一直没到它进场的门槛）不出谱、不出分轨
  const isDrum = r => INSTRUMENTS[R[r].inst]?.drum;
  // 拍 → 秒：用音符自己的起点做分段线性插值（改过速度、摇摆都成立）
  const pts = [...new Map(work.notes.map(n => [n.t, n.s])).entries()].sort((a, b) => a[0] - b[0]);
  const sec = b => { if (b <= pts[0][0]) return pts[0][1] + (b - pts[0][0]) * 60 / work.bpm; for (let i = 0; i < pts.length - 1; i++) if (b <= pts[i + 1][0]) { const [t0, s0] = pts[i], [t1, s1] = pts[i + 1]; return s0 + (s1 - s0) * (b - t0) / (t1 - t0 || 1); } const [tl, sl] = pts[pts.length - 1]; return sl + (b - tl) * 60 / work.bpm; };

  // 1 · 乐谱（鼓和静音声部不进谱）
  const parts = live.filter(r => !isDrum(r)).map(r => ({ role: r, name: INSTRUMENTS[R[r].inst].name, roleName: R[r].name, inst: R[r].inst, notes: work.notes.filter(n => n.role === r) }));
  const dup = new Set(parts.map(p => p.name).filter((n, i, a) => a.indexOf(n) !== i));
  parts.forEach(p => { if (dup.has(p.name)) p.name = `${p.roleName}（${p.name.replace(/（.*）/, '')}）`; });
  const twelve = /^(12|6)\/8/.test(work.meter); // 以八分音符为一拍的拍号
  const score = buildScore(parts, work.meter, work.key, { barStarts: work.barStarts });
  const xml = toMusicXML(score, { title: work.title, composer: work.composer, bpm: work.bpm * (twelve ? 0.5 : 1) });
  fs.writeFileSync(path.join(out, '乐谱.musicxml'), xml);
  fs.writeFileSync(path.join(out, '乐谱.mid'), writeMidi(live.map(r => ({ name: R[r].name, inst: R[r].inst, notes: work.notes.filter(n => n.role === r) }))));

  const { default: createVerovioModule } = await import('verovio/wasm');
  const { VerovioToolkit } = await import('verovio/esm');
  const tk = new VerovioToolkit(await createVerovioModule());
  tk.setOptions({ pageWidth: 2100, pageHeight: 2970, pageMarginLeft: 160, scale: 40, adjustPageHeight: true, breaks: 'auto', header: 'none', footer: 'none' });
  tk.loadData(xml);
  const pages = []; for (let p = 1; p <= tk.getPageCount(); p++) pages.push(tk.renderToSVG(p));
  const sub = `${work.composer}　·　${keyLabel(work.key)}　·　${work.meter.split(' ')[0]}　·　${twelve ? '♪' : '♩'}≈${Math.round(work.bpm)}`;
  fs.writeFileSync(path.join(out, '五线谱.html'), `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>${work.title} · 五线谱</title><style>body{margin:0;background:#fff;font-family:"Noto Serif SC","Songti SC",serif}.pg{width:840px;margin:0 auto;padding:36px 30px}h1{text-align:center;font-size:28px;margin:0 0 4px;font-weight:600}.sub{text-align:center;color:#555;font-size:14px;margin-bottom:18px}svg{width:100%;height:auto;display:block;margin-bottom:24px}</style></head><body><div class="pg"><h1>${work.title}</h1><div class="sub">${sub}</div>${pages.join('\n')}</div></body></html>`);
  tk.setOptions({ pageWidth: 60000, scale: 45, adjustPageHeight: true, breaks: 'none', header: 'none', footer: 'none' });
  tk.loadData(xml);
  const strip = tk.renderToSVG(1);
  const tmap = tk.renderToTimemap().map(e => ({ t: sec(e.qstamp * (twelve ? 2 : 1)), on: e.on || [], off: e.off || [] }));

  // 2 · 简谱
  for (const f of fs.readdirSync(out)) if (f.startsWith('简谱-')) fs.rmSync(path.join(out, f));
  const jp = work.jianpu === true ? parts.map(p => p.role) : work.jianpu?.length ? work.jianpu : parts.filter(p => JIANPU_AUTO.includes(p.inst)).map(p => p.role);
  const jianpuFiles = [], jianpuStrips = {};
  for (const role of jp) {
    const part = score.parts.find(p => p.role === role); if (!part) continue;
    const doBase = part.inst === 'dizi' && work.key.pc === 2 ? 74 : undefined;
    const f = `简谱-${safe(R[role].name)}.html`;
    fs.writeFileSync(path.join(out, f), toJianpu(score, part, { title: work.title, subtitle: work.composer, doBase, sec })); jianpuFiles.push(f);
    jianpuStrips[role] = { name: R[role].name, ...toJianpu(score, part, { doBase, sec, strip: true }) }; // 动态简谱视频用的单行长条
  }

  // 3 · 声音：总混 + 每个声部一条分轨（分轨用总混的音量系数，相对音量一致，可以直接拖进 GarageBand 重新混）
  const mix = Object.fromEntries(Object.entries(R).map(([r, x]) => [r, { inst: x.inst, mute: x.mute, vol: x.vol ?? 1, pan: x.pan ?? 0 }]));
  const tl = work.notes.map(n => ({ p: n.p, s: n.s, e: n.e, v: n.v, role: n.role }));
  const { end, scale } = renderAudio(tl, mix, path.join(out, '音频.m4a'));
  const stemFiles = [];
  if (stems) {
    const dir = path.join(out, '分轨'); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir);
    live.forEach((r, i) => {
      const f = `${String(i + 1).padStart(2, '0')}-${safe(R[r].name)}-${safe(INSTRUMENTS[R[r].inst].name)}.wav`;
      renderAudio(tl.filter(n => n.role === r), { [r]: mix[r] }, path.join(dir, f), { scale, wav: true }); stemFiles.push('分轨/' + f);
    });
  }

  // 4 · 自检
  // 只查真的出声的声部；整首重复的作品只查一遍（重复本身不该让平行五度、重复率翻倍）
  const span = work.auditSpan || Infinity, liveR = Object.fromEntries(live.map(r => [r, R[r]]));
  const sym = auditScore({ notes: work.notes.filter(n => !R[n.role].mute && n.t < span), meter: work.meter }, { style: work.style, strict: work.strict, roles: liveR, mix: Object.fromEntries(live.map(r => [r, R[r].inst])), tonicPc: work.key.pc, melodyRoles: work.melodyRoles, scale: work.scale, era: work.era });
  if (work.auditSpan) sym.items.unshift({ name: '检查范围', value: `只查第一遍（前 ${Math.round(span / (work.meter.startsWith('3/4') ? 3 : 4))} 小节）`, level: 'info', plain: '整首原样重复的作品，后面几遍和第一遍一样；查一遍就够，避免平行五度、重复率被重复次数放大' });
  const aud = auditAudio(path.join(out, '音频.m4a'));
  fs.writeFileSync(path.join(out, '内心听觉自检.md'), auditMarkdown(work.title, sym, aud));

  fs.writeFileSync(path.join(out, 'work.json'), JSON.stringify(work));
  fs.writeFileSync(path.join(out, 'piece.json'), JSON.stringify({ title: work.title, composer: work.composer, key: keyLabel(work.key), meter: work.meter, bpm: work.bpm, style: work.style, era: work.era,
    roles: Object.fromEntries(live.map(r => [r, { name: R[r].name, inst: R[r].inst, instName: INSTRUMENTS[R[r].inst].name }])), notes: tl, strip, tmap, jianpu: jianpuStrips, duration: end - 2 }));
  return { seconds: Math.round(end - 3), sym, aud, files: ['音频.m4a', ...stemFiles, '乐谱.mid', '乐谱.musicxml', '五线谱.html', ...jianpuFiles, '内心听觉自检.md', 'work.json'] };
}
