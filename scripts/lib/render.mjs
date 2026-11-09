// 离线渲染：音符 + 乐器 → 立体声音频（带混响、响度统一到 -16 LUFS）
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { load } from './samples.mjs';
import { INSTRUMENTS, soundOf } from './theory.mjs';

const SR = 44100;
// 有些音色天生很响（铜管、风琴、手风琴），混音时压一点，免得盖住旋律
const LOUD = { organ: 0.7, accordion: 0.7, trumpet: 0.75, trombone: 0.8, tuba: 0.8, timpani: 0.85, tremolo: 0.8, choir: 0.85, tubular_bells: 0.7, glockenspiel: 0.7 };
const REL = { piano: 0.25, harpsichord: 0.15, organ: 0.12, celesta: 0.3, strings: 0.35, harp: 0.4, guitar: 0.3, bass: 0.15, flute: 0.2, clarinet: 0.2, sax: 0.2, horn: 0.3, trumpet: 0.2, trombone: 0.25, tuba: 0.25, drums: 0.1 };

// 拉的、吹的、唱的乐器能一直响：音符比采样长时，把采样中段（35%–90%）交叉淡化循环接长，而不是到头淡出
const SUSTAIN = new Set(['cello', 'violin', 'viola', 'contrabass', 'strings', 'tremolo', 'flute', 'piccolo', 'recorder', 'oboe', 'english_horn', 'clarinet', 'bassoon', 'sax', 'horn', 'trumpet', 'muted_trumpet', 'trombone', 'tuba', 'brass', 'choir', 'voice', 'organ', 'accordion', 'harmonica', 'synth_pad', 'pan_flute', 'ocarina', 'shakuhachi']);
const looped = new Map();
function extend(data, need, key) {
  if (data.length >= need) return data;
  const k = key + ':' + need; if (looped.has(k)) return looped.get(k);
  const a = Math.floor(data.length * 0.35), b = Math.floor(data.length * 0.9), X = Math.min(Math.floor(0.15 * SR), Math.floor((b - a) / 3)), seg = b - a - X;
  const out = new Float32Array(need + 2); out.set(data.subarray(0, b));
  let w = b; // 已写到哪里；每次从 a 接一段，开头 X 个样本和上一段的尾巴交叉淡化（等功率）
  while (w < need + 2) {
    for (let i = 0; i < X && w - X + i < out.length; i++) { const t = i / X, j = w - X + i; out[j] = out[j] * Math.cos(t * Math.PI / 2) + data[a + i] * Math.sin(t * Math.PI / 2); }
    for (let i = X; i < seg + X && w + i - X < out.length; i++) out[w + i - X] = data[a + i];
    w += seg;
  }
  looped.set(k, out); return out;
}

// notes: [{p, s(秒), e(秒), v, role}]；mix: {role: {inst, pan, vol}}
// opts.scale：固定的整体音量系数（做分轨时用总混的系数，保证各轨相对音量一致）；opts.wav：输出不做响度统一的 wav
export function renderAudio(notes, mix, outFile, opts = {}) {
  const banks = {}; for (const r of Object.keys(mix)) { const snd = soundOf(mix[r].inst); banks[snd] ||= load(snd); }
  const end = Math.max(...notes.map(n => n.e)) + 3, total = Math.ceil(end * SR), L = new Float32Array(total), R = new Float32Array(total);
  let seed = 3; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (const n of notes) {
    const m = mix[n.role]; if (!m || m.mute) continue;
    const snd = soundOf(m.inst), bank = banks[snd], drum = INSTRUMENTS[m.inst]?.drum;
    let s = drum ? (bank.find(x => x.midi === n.p) || bank.find(x => x.midi === ({ 46: 42, 44: 42, 49: 51, 57: 49, 37: 38, 39: 38, 40: 38, 35: 36 })[n.p]) || bank[0]) : bank.reduce((a, b) => (Math.abs(b.midi - n.p) < Math.abs(a.midi - n.p) ? b : a));
    const ratio = drum ? 1 : Math.pow(2, (n.p - s.midi) / 12), rel = Math.round((REL[snd] || 0.2) * SR);
    if (SUSTAIN.has(snd)) s = { ...s, data: extend(s.data, Math.ceil(((n.e - n.s) * SR + rel) * ratio) + 4, snd + s.midi) };
    const hold = drum ? s.data.length : Math.round((n.e - n.s) * SR), len = Math.min(hold + rel, Math.floor((s.data.length - 2) / ratio));
    const v = Math.min(1, (n.v ?? 0.7) * (0.95 + rnd() * 0.08)), g = 0.3 * Math.pow(v, 1.5) * (m.vol ?? 1) * (LOUD[snd] ?? 1), pan = m.pan ?? 0;
    const gl = g * Math.cos((pan + 1) * Math.PI / 4), gr = g * Math.sin((pan + 1) * Math.PI / 4), fc = 1500 + 10000 * v * v, a = 1 - Math.exp(-2 * Math.PI * fc / SR);
    const st = Math.round((n.s + (rnd() - 0.5) * 0.008) * SR), fadeN = Math.round(0.08 * SR); let y = 0;
    for (let i = 0; i < len; i++) {
      const pos = i * ratio, k = Math.floor(pos), fr = pos - k; y += a * (s.data[k] * (1 - fr) + s.data[k + 1] * fr - y);
      let w = y; if (i > hold) w *= 1 - (i - hold) / rel; if (i < 64) w *= i / 64;
      if (len < hold + rel && i > len - fadeN) w *= (len - i) / fadeN; // 采样比音符短：在采样用完前 80ms 淡出，别咔一下断掉
      const o = st + i; if (o >= 0 && o < total) { L[o] += w * gl; R[o] += w * gr; }
    }
  }
  let pk = 0; for (let i = 0; i < total; i++) pk = Math.max(pk, Math.abs(L[i]), Math.abs(R[i]));
  const scale = opts.scale ?? (pk ? 0.8 / pk : 1);
  const out = new Float32Array(total * 2); for (let i = 0; i < total; i++) { out[2 * i] = L[i] * scale; out[2 * i + 1] = R[i] * scale; }
  const tmp = path.join(os.tmpdir(), 'compose-skill-' + process.pid), raw = tmp + '.f32', ir = tmp + '-ir.wav';
  fs.writeFileSync(raw, Buffer.from(out.buffer));
  // 混响：一段 2 秒、越往后越暗的指数衰减噪声（音乐厅的「余音」）
  const n = 2 * SR, irb = new Float32Array(n * 2); let lpL = 0, lpR = 0, sd = 9; const rr = () => ((sd = (sd * 16807) % 2147483647) / 2147483647) * 2 - 1;
  for (let i = 0; i < n; i++) { const t = i / SR, env = Math.exp(-3.45 * t) * Math.min(1, t / 0.01), c = 0.25 + 0.6 * Math.exp(-t / 0.7); lpL += c * (rr() - lpL); lpR += c * (rr() - lpR); irb[2 * i] = lpL * env; irb[2 * i + 1] = lpR * env; }
  fs.writeFileSync(tmp + '-ir.f32', Buffer.from(irb.buffer));
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'f32le', '-ar', String(SR), '-ac', '2', '-i', tmp + '-ir.f32', ir]);
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'f32le', '-ar', String(SR), '-ac', '2', '-i', raw, '-i', ir, '-filter_complex',
    "[0:a]asplit[d][w];[w][1:a]afir[wr];[d][wr]amix=inputs=2:weights='1 0.35':normalize=0" + (opts.wav ? ',alimiter=limit=0.98' : ',loudnorm=I=-16:TP=-1.5:LRA=11,alimiter=limit=0.84:level=false'), '-ar', '48000', ...(opts.wav ? ['-c:a', 'pcm_s16le'] : ['-c:a', 'aac', '-b:a', '192k']), outFile]);
  for (const f of [raw, ir, tmp + '-ir.f32']) fs.rmSync(f, { force: true });
  return { end, scale };
}
