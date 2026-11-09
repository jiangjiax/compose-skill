// 写标准 MIDI 文件（格式 1，每个声部一条音轨），GarageBand / Logic / MuseScore 都能直接打开看谱、换音色。
// 时间按「秒」写入（固定 480 tick/拍、tempo 60 → 1 拍 = 1 秒），这样摇摆、自由速度都能原样保留。

// 本 skill 的乐器 → General MIDI 音色号
export const GM = { piano: 0, epiano: 4, harpsichord: 6, celesta: 8, glockenspiel: 9, music_box: 10, vibraphone: 11, marimba: 12, xylophone: 13, tubular_bells: 14, organ: 19, accordion: 21, harmonica: 22, guitar: 24, steel_guitar: 25, bass: 32, violin: 40, viola: 41, cello: 42, contrabass: 43, tremolo: 44, pizzicato: 45, harp: 46, timpani: 47, strings: 48, choir: 52, voice: 53, trumpet: 56, trombone: 57, tuba: 58, muted_trumpet: 59, horn: 60, sax: 65, oboe: 68, english_horn: 69, bassoon: 70, clarinet: 71, piccolo: 72, flute: 73, recorder: 74, pan_flute: 75, shakuhachi: 77, ocarina: 79, sitar: 104, banjo: 105, shamisen: 106, koto: 107, kalimba: 108, dizi: 73, erhu: 110, guzheng: 107, pipa: 106, drums: -1 };

const vlq = n => { const b = [n & 0x7f]; while ((n >>= 7)) b.unshift((n & 0x7f) | 0x80); return b; };
const u32 = n => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const u16 = n => [(n >>> 8) & 255, n & 255];
const chunk = (id, data) => [...Buffer.from(id), ...u32(data.length), ...data];

// tracks: [{ name, inst, notes: [{p, s(秒), e(秒), v}] }]
export function writeMidi(tracks) {
  const TPQ = 480, out = [];
  const tempo = [0, 0xff, 0x51, 0x03, 0x0f, 0x42, 0x40]; // 60 BPM：1 拍 = 1 秒
  out.push(chunk('MTrk', [...tempo, 0, 0xff, 0x2f, 0]));
  let ch = 0;
  for (const tr of tracks) {
    const drum = GM[tr.inst] === -1;
    let c = 9;
    if (!drum) { if (ch === 9) ch++; c = ch % 16; ch++; }
    const ev = [];
    for (const n of tr.notes) {
      const on = Math.round(n.s * TPQ), off = Math.max(on + 1, Math.round(n.e * TPQ)), vel = Math.max(1, Math.min(127, Math.round(n.v * 127)));
      ev.push([on, 1, [0x90 | c, n.p, vel]], [off, 0, [0x80 | c, n.p, 0]]);
    }
    ev.sort((a, b) => a[0] - b[0] || a[1] - b[1]); // 同一刻先关后开，叠着的同音不会被提前截断
    const data = [0, 0xff, 0x03, ...vlq(Buffer.byteLength(tr.name)), ...Buffer.from(tr.name)];
    if (!drum) data.push(0, 0xc0 | c, GM[tr.inst] ?? 0);
    let last = 0;
    for (const [t, , bytes] of ev) { data.push(...vlq(t - last), ...bytes); last = t; }
    data.push(0, 0xff, 0x2f, 0);
    out.push(chunk('MTrk', data));
  }
  return Buffer.from([...chunk('MThd', [...u16(1), ...u16(out.length), ...u16(TPQ)]), ...out.flat()]);
}
