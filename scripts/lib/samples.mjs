// 乐器采样缓存：~/.cache/compose-skill/<来源>/<乐器>/<midi>.f32（44.1kHz 单声道）。第一次用到某个乐器时现做，以后直接读。
// 来源（按 setSoundMode 选）：
//   钢琴 = Salamander Grand Piano（CC BY 3.0，从 tonejs.github.io 下载；公开发布要署名）
//   mis = 爱荷华大学电子音乐工作室乐器采样（University of Iowa MIS，真人独奏录音，每个半音都录；官方声明可用于任何项目、无限制）。
//         原始文件放在 ~/.cache/compose-skill/src/iowa-<乐器>/（一个文件是一串半音阶），先跑 python3 prepare_mis.py <乐器> 切成单音
//   vsco = VSCO 2 Community Edition（Versilian Studios，CC0，随便用、可公开发布）：带揉弦的弦乐组 / 独奏小提琴 / 圆号 / 长号，
//          几个力度层取中间一层。只下载用得到的文件夹到 ~/.cache/compose-skill/src/vsco2/（保持仓库原路径），见 references/instruments.md
//   gb  = 本机 GarageBand 自带采样（弦乐合奏、长笛、单簧管、铜管、萨克斯、拨弦低音提琴；只限本机自用，不可再分发）
//   sf2 = ~/.cache/compose-skill/soundfonts/ 里的 SoundFont（比如 MuseScore General，MIT 许可，可以用于公开发布的作品）
//   gm  = macOS 自带 General MIDI 音色库（1990 年代 Roland 音色，只限本机自用）
//   syn = 公式合成（管风琴；没有音色库时的鼓）
// 模式：best（默认，本机能找到的最好音色）/ publish（只用可以公开发布的来源：钢琴 + sf2 + 合成）
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { INSTRUMENTS } from './theory.mjs';
const INST_RANGE = Object.fromEntries(Object.entries(INSTRUMENTS).map(([k, v]) => [k, v.range]));

const SR = 44100;
export const CACHE = path.join(os.homedir(), '.cache', 'compose-skill');
const DLS = '/System/Library/Components/CoreAudio.component/Contents/Resources/gs_instruments.dls';
export function soundfont() {
  if (process.env.LI_COMPOSE_SF2 && fs.existsSync(process.env.LI_COMPOSE_SF2)) return process.env.LI_COMPOSE_SF2;
  const dir = path.join(CACHE, 'soundfonts'); if (!fs.existsSync(dir)) return null;
  const f = fs.readdirSync(dir).filter(x => x.toLowerCase().endsWith('.sf2')).sort((a, b) => (b.includes('MuseScore') ? 1 : 0) - (a.includes('MuseScore') ? 1 : 0))[0];
  return f ? path.join(dir, f) : null;
}
let MODE = 'best';
export function setSoundMode(m) { MODE = m === 'publish' ? 'publish' : 'best'; }
// 某件乐器这次用哪个来源
export function sourceOf(id) {
  const sf = soundfont();
  if (id === 'piano') return 'piano';
  if (id === 'organ') return 'syn';
  if (id === 'drums') return sf ? 'sf2' : 'syn';
  if (VSCO[id] && vscoFiles(id).length) return 'vsco'; // 专业录音的持续音（揉弦、多力度），优先于爱荷华
  if (MISRC[id] && misFiles(id).length) return 'mis'; // 真人独奏录音，授权无限制，best / publish 都用它
  if (MODE === 'best' && GBSRC[id] && fs.existsSync(GBSRC[id].dir)) return 'gb';
  if (sf && (GMSRC[id] || GBSRC[id] || GBPROG[id] != null)) return 'sf2';
  if (MODE === 'best' && GBSRC[id] && fs.existsSync(GBSRC[id].dir)) return 'gb';
  if (GMSRC[id]) return 'gm';
  if (SYN[id]) return 'syn';
  if (GBSRC[id]) return 'gb';
  throw new Error('不认识的乐器：' + id);
}
const SRC_NAME = { vsco: 'VSCO 2 Community Edition（Versilian Studios，CC0，可用于任何项目）', mis: '爱荷华大学乐器采样（University of Iowa MIS，真人独奏录音，可用于任何项目、无限制）', piano: 'Salamander 钢琴采样（CC BY 3.0，公开发布请署名 Alexander Holm）', gb: 'GarageBand 采样（只限本机自用，不可再分发）', sf2: '', gm: 'macOS 自带 General MIDI 音色（只限本机自用）', syn: '公式合成（无版权限制）' };
export function soundReport(insts) {
  const by = {}; for (const i of new Set(insts)) { const snd = i in BORROW ? BORROW[i] : i; const src = sourceOf(snd); (by[src] ||= []).push(i); }
  const sf = soundfont();
  return Object.entries(by).map(([src, xs]) => `${src === 'sf2' ? `SoundFont「${path.basename(sf)}」（${/musescore/i.test(sf) ? 'MIT 许可，可用于公开发布' : '许可见音色库作者说明'}）` : SRC_NAME[src]}：${xs.join('、')}`)
    .concat(MODE === 'publish' && Object.keys(by).some(s => s === 'gb' || s === 'gm') ? ['⚠ publish 模式下仍有乐器只能用本机自用音色（没找到 SoundFont），这一版不能公开发布'] : []);
}
const BORROW = { dizi: 'flute', erhu: 'violin', guzheng: 'koto', pipa: 'shamisen' };
// GarageBand 乐器在 SoundFont 里对应的 General MIDI 音色号（sf2 模式替代 GarageBand 用）
const GBPROG = { strings: 48, flute: 73, clarinet: 71, horn: 60, trumpet: 56, trombone: 57, tuba: 58, sax: 65, bass: 32 };
const GB = '/Library/Application Support/GarageBand/Instrument Library/Sampler/Sampler Files/';
const GBSRC = {
  strings: { dir: GB + 'String Ensemble', match: /^\d+[nm]\d[ab]/, step: 3, len: 5 },
  flute: { dir: GB + 'Flute Solo/Flute_LV_na_sus_mf', step: 3, len: 4 },
  clarinet: { dir: GB + 'Clarinet Solo/Clarinet-L_pA_sus_mf', step: 3, len: 4 },
  horn: { dir: GB + 'Horn Solo/French Horn-L_oV_nA_sus_mf', step: 3, len: 4 },
  trumpet: { dir: GB + 'Trumpets/Trumpets_nA_sus_mf', step: 3, len: 4 },
  trombone: { dir: GB + 'Trombones/Trombones_nA_sus_mf', step: 3, len: 4 },
  tuba: { dir: GB + 'Tuba Solo/Tuba-L_nA_sus_mf', step: 3, len: 4 },
  sax: { dir: GB + 'Alto Sax', match: /^YTASMLNOM/, step: 2, len: 4 },
  bass: { dir: GB + 'Upright Jazz Bass', match: /^KBLONS/, step: 2, len: 3, max: 67 },
};
// 爱荷华大学采样：原始的半音阶录音先用 prepare_mis.py 切成单音（按逐帧音高切，比按静音切准），放在 notes/<midi>.wav
const MISRC = Object.fromEntries(['cello', 'violin', 'viola', 'contrabass', 'flute', 'oboe', 'clarinet', 'bassoon', 'horn', 'trumpet', 'trombone', 'tuba', 'sax'].map(i => [i, { dir: path.join(CACHE, 'src', 'iowa-' + i, 'notes'), len: 6 }]));
const misFiles = id => { const c = MISRC[id]; return fs.existsSync(c.dir) ? fs.readdirSync(c.dir).filter(f => /^\d+\.wav$/.test(f)) : []; };
const decode = (file, len) => { const b = execFileSync('ffmpeg', ['-v', 'error', '-i', file, '-t', String(len), '-ac', '1', '-ar', String(SR), '-f', 'f32le', '-'], { maxBuffer: 1 << 28 }); return new Float32Array(b.buffer, b.byteOffset, b.length / 4); };
function pitchOf(x) {
  const s = Math.min(Math.floor(SR * 0.35), Math.max(0, x.length - 9000)), N = 4000; let best = 0, bl = 0;
  for (let lag = 30; lag < 2000 && s + N + lag < x.length; lag += 1) {
    let c = 0, e1 = 0, e2 = 0; for (let i = 0; i < N; i += 2) { c += x[s + i] * x[s + i + lag]; e1 += x[s + i] ** 2; e2 += x[s + i + lag] ** 2; }
    const r = c / Math.sqrt(e1 * e2 + 1e-12); if (r > best + 1e-3) { best = r; bl = lag; } if (best > 0.9 && r < best - 0.3) break;
  }
  return { midi: Math.round(69 + 12 * Math.log2(SR / bl / 440)), r: best };
}

// VSCO 2 CE：文件名里的音名八度不统一（圆号写 A0–C3，小提琴组写 G2 起），每个文件夹按实测音高投票定一个八度偏移。
// strings（弦乐合奏）把小提琴组、中提琴组、大提琴组合成一个音色：每个音取音域最合适的那一组
const VSCO_DIR = path.join(CACHE, 'src', 'vsco2');
const VSCO = {
  strings: ['Strings/Cello Section/susvib', 'Strings/Viola Section/susvib', 'Strings/Violin Section/susVib'],
  violin: ['Strings/Solo Violin/Arco Vib'], viola: ['Strings/Viola Section/susvib'], cello: ['Strings/Cello Section/susvib'],
  contrabass: ['Strings/Solo Contrabass/SusVib'], trombone: ['Brass/Tenor Trombone/sus'], horn: ['Brass/F Horn/sus'],
  trumpet: ['Brass/Trumpet/susvib'], tuba: ['Brass/Tuba/sus'],
  flute: ['Woodwinds/Flute/susvib'], oboe: ['Woodwinds/Oboe/Vib'], clarinet: ['Woodwinds/Clarinet/susLong'], bassoon: ['Woodwinds/Bassoon/vib'], piccolo: ['Woodwinds/Piccolo/Sus'],
  timpani: ['Percussion/Timpani'],
};
// VSCO 采样之间空得太远（超过 5 个半音）时，用校过音的爱荷华单音补上（圆号 C4–D5 之间 VSCO 没录）
const GAP = 5;
// VSCO 五面定音鼓的实测音高（主振动模式，FFT 测三个力度/轮换取中位）：鼓号 → midi（带小数）
const TIMPANI = { 1: 41.46, 2: 46.81, 3: 49.48, 4: 52.42, 5: 54.57 };
const vscoFiles = id => VSCO[id].flatMap(d => { const dir = path.join(VSCO_DIR, d); return fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => /\.wav$/i.test(f)).map(f => path.join(dir, f)) : []; });
const PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
function vscoBank(id) {
  if (id === 'timpani') { // 五面鼓各取强奏层，重采样到最近的半音
    const got = new Map();
    for (const [k, mm] of Object.entries(TIMPANI)) {
      const f = path.join(VSCO_DIR, 'Percussion/Timpani', `Timpani${k}_Hit_v3_rr1_Sum.wav`); if (!fs.existsSync(f)) continue;
      const m = Math.round(mm); got.set(m, { f, x: shift(decode(f, 4), m - mm) });
    }
    return got;
  }
  // 文件名形如 VlnEns_susVib_F#3_v2.wav / MOHorn_sus_A#1_v3_1.wav / LLVln_ArcoVib_A4_f.wav：取音级和力度层
  const by = new Map(); // 音级+文件名八度 → [{f, layer}]
  for (const f of vscoFiles(id)) {
    const m = path.basename(f).match(/(?:^|_)([A-G])([#b]?)(-?\d)(?:_(v\d+|pp|p|mp|mf|ff|f))?(?:_|\.)/); if (!m) continue;
    const layer = !m[4] ? 1 : m[4][0] === 'v' ? +m[4].slice(1) : { pp: 1, p: 2, mp: 3, mf: 4, f: 5, ff: 6 }[m[4]];
    const pc = (PC[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + 12) % 12, key = path.dirname(f) + '|' + m[1] + m[2] + m[3];
    (by.has(key) ? by.get(key) : by.set(key, []).get(key)).push({ f, pc, layer, name: pc + 12 * (+m[3] + 1) });
  }
  const [lo, hi] = INST_RANGE[id] || [21, 108], got = new Map(), picked = [];
  for (const vs of by.values()) { vs.sort((a, b) => a.layer - b.layer); picked.push(vs[Math.floor(vs.length / 2)]); } // 中间力度层（两层取强的那层）
  // 每个文件夹的八度偏移：逐个测音高，按「实测 − 文件名」取到 12 的整数倍后投票（单个文件会测错八度，投票不会）
  const off = new Map();
  for (const dir of new Set(picked.map(v => path.dirname(v.f)))) {
    const votes = new Map();
    for (const v of picked.filter(v => path.dirname(v.f) === dir)) { const x = decode(v.f, 3), p = pitchOf(x); if (p.r < 0.8) continue; const d = Math.round((p.midi - v.name) / 12) * 12; if (Math.abs(p.midi - v.name - d) <= 1) votes.set(d, (votes.get(d) || 0) + 1); }
    off.set(dir, [...votes].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 12);
  }
  for (const v of picked) {
    const m = v.name + off.get(path.dirname(v.f)); if (m < lo - 2 || m > hi + 2) continue;
    if (!got.has(m) || id === 'strings' && preferSection(m, v.f, got.get(m).f)) got.set(m, { f: v.f, x: tune(decode(v.f, 6), m) });
  }
  if (MISRC[id] && misFiles(id).length) { // 补空档
    const ks = [...got.keys()].sort((a, b) => a - b), dir = MISRC[id].dir;
    for (let i = 0; i + 1 < ks.length; i++) if (ks[i + 1] - ks[i] > GAP)
      for (let m = ks[i] + 2; m <= ks[i + 1] - 2; m += 2) { const f = path.join(dir, m + '.wav'); if (fs.existsSync(f)) got.set(m, { f, x: decode(f, 6) }); }
  }
  return got;
}
// 移调若干半音（线性插值重采样）
function shift(x, semis) { if (Math.abs(semis) < 0.03) return x; const k = 2 ** (semis / 12), n = Math.floor((x.length - 1) / k), y = new Float32Array(n); for (let i = 0; i < n; i++) { const t = i * k, j = Math.floor(t), f = t - j; y[i] = x[j] * (1 - f) + x[j + 1] * f; } return y; }
// 校音：在目标音附近 ±60 音分里找自相关最高的周期（抛物线插值到小数样本），偏差超过 3 音分就重采样拉回标准音高
function tune(x, m) {
  const P = SR / (440 * 2 ** ((m - 69) / 12)), s0 = Math.min(Math.floor(SR * 0.4), Math.max(0, x.length - SR)), N = Math.min(SR, x.length - s0 - Math.ceil(P * 1.1) - 2);
  if (N < 4000) return x;
  const ac = lag => { let c = 0, e1 = 0, e2 = 0; for (let i = 0; i < N; i++) { const a = x[s0 + i], b = x[s0 + i + lag]; c += a * b; e1 += a * a; e2 += b * b; } return c / Math.sqrt(e1 * e2 + 1e-12); };
  const lo = Math.floor(P * 2 ** (-0.6 / 12)), hi = Math.ceil(P * 2 ** (0.6 / 12)); let bl = lo, br = -2; const r = [];
  for (let l = lo - 1; l <= hi + 1; l++) r[l] = ac(l);
  for (let l = lo; l <= hi; l++) if (r[l] > br) { br = r[l]; bl = l; }
  if (br < 0.5) return x;
  const den = r[bl - 1] - 2 * r[bl] + r[bl + 1], lag = bl + (Math.abs(den) > 1e-9 ? 0.5 * (r[bl - 1] - r[bl + 1]) / den : 0);
  const cents = 1200 * Math.log2(P / lag); if (Math.abs(cents) < 3) return x;
  const k = 2 ** (-cents / 1200), n = Math.floor((x.length - 1) / k), y = new Float32Array(n);
  for (let i = 0; i < n; i++) { const t = i * k, j = Math.floor(t), f = t - j; y[i] = x[j] * (1 - f) + x[j + 1] * f; }
  return y;
}
// 合奏里同一个音几组都有时：低于 G3 用大提琴，G3–D5 用中提琴，再高用小提琴
function preferSection(m, fNew, fOld) { const want = m < 55 ? 'Cello' : m < 74 ? 'Viola' : 'Violin'; return fNew.includes(want) && !fOld.includes(want); }

// macOS 自带 General MIDI 音色库（Roland GS 音色），用 gmrender.swift 离线渲染：[program, 最低, 最高, 持续秒数]
export const GMSRC = {
  harpsichord: [6, 29, 89, 2.5], celesta: [8, 60, 108, 2.5], glockenspiel: [9, 72, 108, 2.5], music_box: [10, 60, 96, 2.5], vibraphone: [11, 53, 89, 3],
  marimba: [12, 45, 96, 2], xylophone: [13, 60, 108, 1.5], tubular_bells: [14, 60, 77, 4], epiano: [4, 28, 103, 3], accordion: [21, 41, 89, 4], harmonica: [22, 60, 96, 3],
  guitar: [24, 40, 84, 3], steel_guitar: [25, 40, 84, 3], violin: [40, 55, 100, 4], viola: [41, 48, 88, 4], cello: [42, 36, 76, 4], contrabass: [43, 28, 67, 4],
  tremolo: [44, 28, 96, 4], pizzicato: [45, 28, 96, 1.5], harp: [46, 24, 103, 3], timpani: [47, 36, 57, 3], choir: [52, 40, 84, 4], voice: [53, 48, 84, 4],
  muted_trumpet: [59, 54, 82, 3], oboe: [68, 58, 91, 4], english_horn: [69, 52, 81, 4], bassoon: [70, 34, 75, 4], piccolo: [72, 74, 108, 3], recorder: [74, 60, 96, 3],
  pan_flute: [75, 60, 96, 3], shakuhachi: [77, 55, 91, 3], ocarina: [79, 60, 93, 3], sitar: [104, 48, 84, 3], banjo: [105, 48, 84, 2.5], shamisen: [106, 50, 86, 2.5],
  koto: [107, 48, 91, 3], kalimba: [108, 60, 96, 2.5],
  synth_pad: [89, 36, 96, 4], synth_lead: [81, 48, 96, 3], synth_bass: [38, 24, 60, 2], e_guitar: [27, 40, 84, 3], e_bass: [33, 28, 67, 2.5], brass: [61, 40, 84, 3],
};
function gmBin() {
  const bin = path.join(CACHE, 'bin', 'gmrender2'); // 2 = 参数里带音色库路径的版本
  if (!fs.existsSync(bin)) { fs.mkdirSync(path.dirname(bin), { recursive: true }); execFileSync('swiftc', ['-O', decodeURIComponent(new URL('./gmrender.swift', import.meta.url).pathname), '-o', bin]); }
  return bin;
}

let seed = 11; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
const f0 = m => 440 * Math.pow(2, (m - 69) / 12);
function pluck(m, { dur, bright, decay, body = 0 }) {
  const N = Math.max(2, Math.round(SR / f0(m))), n = Math.round(dur * SR), out = new Float32Array(n), buf = new Float32Array(N);
  let lp = 0; for (let i = 0; i < N; i++) { lp += bright * (rnd() - lp); buf[i] = lp; }
  let idx = 0, prev = 0;
  for (let i = 0; i < n; i++) { const cur = buf[idx], v = decay * 0.5 * (cur + buf[(idx + 1) % N]); buf[idx] = v; idx = (idx + 1) % N; let s = cur; if (body) { prev += 0.08 * (s - prev); s += body * prev; } out[i] = s * 0.6; }
  return out;
}
const SYN = {
  organ: { range: [36, 84], fn: m => { const n = Math.round(3.5 * SR), out = new Float32Array(n), parts = []; for (const [mu, a] of [[1, 1], [2, 0.55], [4, 0.28], [3, 0.18]]) [[1, 1], [2, 0.42], [3, 0.22], [4, 0.12], [5, 0.07], [6, 0.04]].forEach(([h, ha]) => { const f = f0(m) * mu * h; if (f < 11000) parts.push([2 * Math.PI * f / SR, a * ha, Math.abs(rnd()) * 6]); }); let nz = 0; for (let i = 0; i < n; i++) { let s = 0; for (const [w, a, p] of parts) s += a * Math.sin(w * i + p); if (i < 0.05 * SR) { nz += 0.3 * (rnd() - nz); s += nz * 0.3 * (1 - i / (0.05 * SR)); } out[i] = s * Math.min(1, i / (0.03 * SR)) * 0.25; } return out; } },
  harpsichord: { range: [36, 84], fn: m => { const a = pluck(m, { dur: 3, bright: 0.95, decay: 0.9985 }), b = pluck(m + 12, { dur: 3, bright: 0.9, decay: 0.998 }); return a.map((x, i) => x + 0.45 * b[i]); } },
  harp: { range: [28, 91], fn: m => pluck(m, { dur: 4, bright: 0.35, decay: 0.9994 }) },
  guitar: { range: [40, 81], fn: m => pluck(m, { dur: 3.5, bright: 0.6, decay: 0.999, body: 1.2 }) },
  celesta: { range: [60, 96], fn: m => { const n = Math.round(2.5 * SR), o = new Float32Array(n), f = f0(m); for (let i = 0; i < n; i++) { const t = i / SR; o[i] = 0.5 * Math.exp(-t * 2.2) * Math.sin(2 * Math.PI * f * t) + 0.18 * Math.exp(-t * 6) * Math.sin(8 * Math.PI * f * t) + 0.05 * Math.exp(-t * 14) * Math.sin(2 * Math.PI * f * 9.8 * t); } return o; } },
};
const DRUMS = {
  36: () => { const n = 0.5 * SR, o = new Float32Array(n); let ph = 0; for (let i = 0; i < n; i++) { const t = i / SR; ph += 2 * Math.PI * (45 + 90 * Math.exp(-t * 28)) / SR; o[i] = Math.sin(ph) * Math.exp(-t * 7) * 0.9; } return o; },
  38: () => { const n = 0.35 * SR, o = new Float32Array(n); let a = 0, b = 0; for (let i = 0; i < n; i++) { const t = i / SR; a += 0.5 * (rnd() - a); b += 0.15 * (a - b); o[i] = (a - b) * Math.exp(-t * 14) * 0.9 + 0.3 * Math.sin(2 * Math.PI * 190 * t) * Math.exp(-t * 30); } return o; },
  42: () => { const n = 0.12 * SR, o = new Float32Array(n); let p = 0; for (let i = 0; i < n; i++) { const x = rnd(); o[i] = (x - p) * Math.exp(-i / SR * 45) * 0.5; p = x; } return o; },
  37: () => { const n = 0.15 * SR, o = new Float32Array(n); for (let i = 0; i < n; i++) { const t = i / SR; o[i] = (0.6 * Math.sin(2 * Math.PI * 1700 * t) + 0.4 * rnd()) * Math.exp(-t * 45) * 0.8; } return o; },
  39: () => { const n = 0.3 * SR, o = new Float32Array(n); let a = 0; for (let i = 0; i < n; i++) { const t = i / SR; a += 0.6 * (rnd() - a); const env = [0, 0.012, 0.024].reduce((s, d) => s + (t >= d ? Math.exp(-(t - d) * 60) : 0), 0) + (t > 0.03 ? Math.exp(-(t - 0.03) * 18) : 0); o[i] = a * env * 0.6; } return o; },
  46: () => { const n = 0.5 * SR, o = new Float32Array(n); let p = 0; for (let i = 0; i < n; i++) { const x = rnd(); o[i] = (x - p) * Math.exp(-i / SR * 6) * 0.45; p = x; } return o; },
  49: () => { const n = 2.5 * SR, o = new Float32Array(n); let p = 0, q = 0; for (let i = 0; i < n; i++) { const t = i / SR, x = rnd(); q += 0.5 * ((x - p) - q); o[i] = q * Math.exp(-t * 1.6) * 0.6; p = x; } return o; },
  51: () => { const n = 1.6 * SR, o = new Float32Array(n), fs = [3150, 4270, 5380, 6820, 7930, 9210]; for (let i = 0; i < n; i++) { const t = i / SR; let s = 0; for (const f of fs) s += Math.sign(Math.sin(2 * Math.PI * f * t)); o[i] = s / fs.length * Math.exp(-t * 2.4) * 0.22 + rnd() * 0.04 * Math.exp(-t * 6); } return o; },
};

function norm(x) { let pk = 0; for (const v of x) pk = Math.max(pk, Math.abs(v)); return pk ? x.map(v => v / pk * 0.9) : x; }
function renderBank(bank, msb, prog, dir, hold, ns) {
  const tmp = path.join(dir, 'raw'); fs.mkdirSync(tmp, { recursive: true });
  execFileSync(gmBin(), [String(prog), tmp, String(hold), bank, String(msb), ...ns.map(String)], { stdio: 'ignore' });
  const got = [];
  for (const m of ns) { const f = path.join(tmp, m + '.f32'); if (!fs.existsSync(f)) continue; const b = fs.readFileSync(f); const x = new Float32Array(b.buffer, b.byteOffset, b.length / 4); if (x.some(v => Math.abs(v) > 1e-4)) got.push([m, x]); }
  fs.rmSync(tmp, { recursive: true, force: true }); return got;
}
const cacheDir = (src, id) => (src === 'piano' ? path.join(CACHE, 'piano') : src === 'sf2' ? path.join(CACHE, 'sf2-' + path.basename(soundfont(), '.sf2').replace(/\W+/g, '_'), id) : path.join(CACHE, src, id));
function build(id, src) {
  const dir = cacheDir(src, id); fs.mkdirSync(dir, { recursive: true });
  const save = (m, x) => fs.writeFileSync(path.join(dir, m + '.f32'), Buffer.from(Float32Array.from(x).buffer));
  if (src === 'sf2') {
    if (id === 'drums') { const ns = [35, 36, 37, 38, 39, 40, 42, 44, 46, 49, 51, 57]; for (const [m, x] of renderBank(soundfont(), 120, 0, dir, 1.5, ns)) save(m, norm(x)); }
    else { const gm = GMSRC[id], prog = gm ? gm[0] : GBPROG[id], lo = gm ? gm[1] : INST_RANGE[id][0], hi = gm ? gm[2] : INST_RANGE[id][1], hold = gm ? gm[3] : 4;
      const ns = []; for (let m = lo; m <= hi; m += 3) ns.push(m); for (const [m, x] of renderBank(soundfont(), 121, prog, dir, hold, ns)) save(m, norm(x)); }
  } else if (id === 'piano') {
    const list = []; for (let o = 1; o <= 7; o++) for (const [nm, pc] of [['C', 0], ['Ds', 3], ['Fs', 6], ['A', 9]]) list.push([nm + o, (o + 1) * 12 + pc]);
    const miss = list.filter(([f]) => !fs.existsSync(path.join(dir, f + '.mp3')));
    if (miss.length) { // 一次并行下载，单个文件很小
      fs.writeFileSync(path.join(dir, 'dl.txt'), miss.map(([f]) => `url = "https://tonejs.github.io/audio/salamander/${f}.mp3"\noutput = "${path.join(dir, f + '.mp3')}"`).join('\n'));
      execFileSync('curl', ['-s', '-m', '50', '--parallel', '--parallel-max', '16', '-K', path.join(dir, 'dl.txt')]);
    }
    for (const [f, m] of list) { const mp3 = path.join(dir, f + '.mp3'); if (fs.existsSync(mp3) && fs.statSync(mp3).size > 1000) save(m, decode(mp3, 5)); }
  } else if (src === 'vsco') {
    for (const [m, { x }] of vscoBank(id)) save(m, norm(x));
  } else if (src === 'mis') {
    const c = MISRC[id]; for (const f of misFiles(id)) save(+f.slice(0, -4), norm(decode(path.join(c.dir, f), c.len)));
  } else if (src === 'gb') {
    const c = GBSRC[id];
    if (!fs.existsSync(c.dir)) throw new Error(`没找到 GarageBand 采样：${c.dir}。可以换别的乐器，或者先安装 GarageBand。`);
    const found = new Map();
    for (const f of fs.readdirSync(c.dir).filter(f => !f.startsWith('.') && (!c.match || c.match.test(f)))) {
      const x = decode(path.join(c.dir, f), c.len), p = pitchOf(x);
      if (p.r < 0.8 || (c.max && p.midi > c.max) || found.has(p.midi)) continue; found.set(p.midi, x);
    }
    let lastM = -99; for (const m of [...found.keys()].sort((a, b) => a - b)) if (m - lastM >= c.step) { save(m, norm(found.get(m))); lastM = m; }
  } else if (src === 'gm') {
    const [prog, lo, hi, hold] = GMSRC[id], ns = []; for (let m = lo; m <= hi; m += 3) ns.push(m);
    for (const [m, x] of renderBank(DLS, 121, prog, dir, hold, ns)) save(m, norm(x));
  } else if (SYN[id] && id !== 'drums') { for (let m = SYN[id].range[0]; m <= SYN[id].range[1]; m += 3) save(m, norm(SYN[id].fn(m))); }
  else if (id === 'drums') { for (const [m, fn] of Object.entries(DRUMS)) save(m, norm(fn())); }
  else throw new Error('不认识的乐器：' + id);
  if (!fs.readdirSync(dir).some(f => f.endsWith('.f32'))) throw new Error(`${id} 的音色没做出来（来源 ${src}）。可以换别的乐器，或者检查音色库文件`);
  fs.writeFileSync(path.join(dir, 'ok'), new Date().toISOString());
}
export function load(id) {
  const src = sourceOf(id), dir = cacheDir(src, id);
  if (!fs.existsSync(path.join(dir, 'ok'))) build(id, src);
  return fs.readdirSync(dir).filter(f => f.endsWith('.f32')).map(f => { const b = fs.readFileSync(path.join(dir, f)); return { midi: +f.slice(0, -4), data: new Float32Array(b.buffer, b.byteOffset, b.length / 4) }; }).sort((a, b) => a.midi - b.midi);
}
